"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Bell, BellOff, BellRing, EyeOff, Volume2, X } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import AcceptOrderModal from "./AcceptOrderModal";
import RejectOrderModal from "./RejectOrderModal";
import { cashChangeText, formatClock, formatMoney, orderCode, orderTotal } from "./orderMeta";
import styles from "./orders.module.css";
import alertStyles from "./LiveOrderAlert.module.css";
import { OrdersService, type RestaurantOrder } from "@/services/api/orders";
import { getApiErrorMessage, isApiNotFound, isApiStatus } from "@/services/api/errors";
import { getSessionSnapshot, subscribeToSession } from "@/services/api/session";
import { eventOrderId, orderSocket } from "@/lib/orderSocket";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useRestaurant } from "@/lib/restaurantContext";

/* ---------------------------------------------------------------------------
   App-wide ringing alert for orders waiting on an answer — the web twin of the
   mobile app's NewOrderAlertHost + useRestaurantOrderSocket.

   The server's pending list is the source of truth, refetched on a timer, on
   tab focus and on every socket event; `order.new` adds an order the instant
   it arrives, ahead of the next fetch. The oldest pending order is shown and
   rings until it is accepted, rejected, hidden for this session, or the server
   says it is no longer pending (`order.updated` / `order.cancelled`).

   Browsers refuse audio until the page has had a user gesture. The first
   click/keypress anywhere "primes" the audio element (a muted play), and the
   alert shows an "Enable sound" button whenever playback was refused.
--------------------------------------------------------------------------- */

const PENDING_POLL_MS = 20_000;
const SILENCE_MS = 60_000;
const RING_SRC = "/sounds/new_order_ring.m4a";
/** sessionStorage: the operator opted into the ringtone this tab session. */
const SOUND_PREF_KEY = "nowlny_order_sound";
/** sessionStorage: "Not now" on the setup prompt. */
const SETUP_DISMISSED_KEY = "nowlny_order_alert_setup_dismissed";

/**
 * Fired on `window` whenever orders change under the alert (socket event or an
 * answer given here). Pages holding their own order lists can listen and
 * refetch; the alert itself also listens, so a page can ask it to re-check.
 */
export const ORDERS_CHANGED_EVENT = "nowlny:orders-changed";
const SELF = "live-order-alert";

type Permission = NotificationPermission | "unsupported";
type LiveEntry = { order: RestaurantOrder; at: number };

const createdAtOf = (order: RestaurantOrder) => Date.parse(order.createdAt ?? "") || 0;

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the choice just isn't remembered */
  }
}

const readPermission = (): Permission =>
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";

/** Menu names can arrive as plain strings or as `{ en, ar }`. */
function localized(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const pick = record[locale] ?? record.en ?? record.ar ?? record.name;
    return typeof pick === "string" ? pick : pick ? localized(pick, locale) : "";
  }
  return "";
}

function announceChange(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(ORDERS_CHANGED_EVENT, { detail: { source: SELF, ...detail } }));
}

/** Mounted once in the dashboard shell; inert until a restaurant is verified. */
export default function LiveOrderAlert() {
  const { restaurant } = useRestaurant();
  if (!restaurant) return null;
  // Keyed so a different restaurant (account switch) starts from a clean queue.
  return <LiveOrderAlertHost key={restaurant.id ?? "restaurant"} />;
}

function LiveOrderAlertHost() {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const { restaurant } = useRestaurant();
  const titleId = useId();

  // ── Queue state ─────────────────────────────────────────────────────────
  const [fetched, setFetched] = useState<{ orders: RestaurantOrder[]; at: number } | null>(null);
  const [live, setLive] = useState<Record<string, LiveEntry>>({});
  /** Orders answered / cancelled, with when — hides them from a list fetched earlier. */
  const [cleared, setCleared] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, RestaurantOrder>>({});
  const [detailsFailed, setDetailsFailed] = useState<ReadonlySet<string>>(() => new Set());

  // ── UI state ────────────────────────────────────────────────────────────
  const [sub, setSub] = useState<{ kind: "accept" | "reject"; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [silence, setSilence] = useState<{ id: string; until: number } | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [soundOptedIn, setSoundOptedIn] = useState(() => readSession(SOUND_PREF_KEY) === "on");
  const [permission, setPermission] = useState<Permission>(readPermission);
  const [setupDismissed, setSetupDismissed] = useState(
    () => readSession(SETUP_DISMISSED_KEY) === "1",
  );

  const inFlightRef = useRef(false);
  const againRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());
  const notificationRef = useRef<Notification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const acceptBtnRef = useRef<HTMLButtonElement>(null);
  const headIdRef = useRef<string | null>(null);
  // Latest `t`/`toast` for long-lived listeners; `t` is a new closure each render.
  const tRef = useRef(t);
  const toastRef = useRef(toast);
  useEffect(() => {
    tRef.current = t;
    toastRef.current = toast;
  });

  // ── Server truth ────────────────────────────────────────────────────────
  const refreshPending = useCallback(async () => {
    if (inFlightRef.current) {
      againRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      do {
        againRef.current = false;
        const at = Date.now();
        try {
          const orders = await OrdersService.getOrders({ status: "pending", limit: 50 });
          setFetched({ orders: orders.filter((order) => order.status === "pending"), at });
        } catch {
          // Keep the last good list; the next tick tries again. A 401 has
          // already been through the refresh interceptor.
        }
      } while (againRef.current);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const clearOrder = useCallback((id: string) => {
    if (!id) return;
    setCleared((current) => ({ ...current, [id]: Date.now() }));
    setLive((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  // Poll as a safety net for a missed or absent socket. Not paused while the
  // tab is hidden: ringing in a background tab is the whole point (browsers
  // throttle hidden timers to about once a minute, which is still a net).
  useEffect(() => {
    const initial = window.setTimeout(() => void refreshPending(), 0);
    const interval = window.setInterval(() => void refreshPending(), PENDING_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refreshPending();
    };
    const onExternalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      if (detail?.source !== SELF) void refreshPending();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(ORDERS_CHANGED_EVENT, onExternalChange);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(ORDERS_CHANGED_EVENT, onExternalChange);
    };
  }, [refreshPending]);

  // ── Socket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    orderSocket.connect();

    const unsubscribe = orderSocket.subscribe((event, payload) => {
      const id = eventOrderId(payload);
      announceChange({ event, orderId: id });

      switch (event) {
        case "order.new": {
          // Without an id there is nothing to accept or reject.
          if (!id) break;
          const incoming = (payload.order ?? {}) as Partial<RestaurantOrder>;
          setLive((current) => ({
            ...current,
            [id]: {
              order: {
                ...current[id]?.order,
                ...incoming,
                id,
                status: "pending",
                createdAt: incoming.createdAt ?? current[id]?.order.createdAt ?? new Date().toISOString(),
              },
              at: Date.now(),
            },
          }));
          break;
        }
        case "order.cancelled": {
          if (id && id === headIdRef.current) {
            const code = orderCode({ id, orderNumber: payload.order?.orderNumber });
            toastRef.current.info(tRef.current("liveorders.cancelled_by_customer", { code }));
          }
          clearOrder(id);
          break;
        }
        case "order.updated": {
          // Answered on another device, auto-rejected, … — stop ringing.
          const status = String(payload.status ?? payload.order?.status ?? "").toLowerCase();
          if (status && status !== "pending") clearOrder(id);
          break;
        }
        default:
          break;
      }
      void refreshPending();
    });

    // Signed out in another tab / refresh failed: drop the socket.
    const unsubscribeSession = subscribeToSession(() => {
      if (getSessionSnapshot() === "authenticated") orderSocket.connect();
      else orderSocket.disconnect();
    });

    return () => {
      unsubscribe();
      unsubscribeSession();
      orderSocket.disconnect();
    };
  }, [clearOrder, refreshPending]);

  // ── The queue: oldest pending first ─────────────────────────────────────
  const queue = useMemo(() => {
    const fetchedAt = fetched?.at ?? 0;
    const byId = new Map<string, RestaurantOrder>();
    for (const order of fetched?.orders ?? []) {
      if (!((cleared[order.id] ?? 0) > fetchedAt)) byId.set(order.id, order);
    }
    for (const [id, entry] of Object.entries(live)) {
      if ((cleared[id] ?? 0) > entry.at) continue;
      const known = byId.get(id);
      if (known) byId.set(id, { ...entry.order, ...known });
      // Newer than the last fetch — trust the socket until the next one.
      else if (entry.at > fetchedAt) byId.set(id, entry.order);
    }
    return [...byId.values()]
      .filter((order) => !hidden.has(order.id))
      .sort((a, b) => createdAtOf(a) - createdAtOf(b));
  }, [fetched, live, cleared, hidden]);

  const head = queue[0] ?? null;
  const headId = head?.id ?? null;
  const order = useMemo(
    () => (head ? { ...head, ...details[head.id] } : null),
    [head, details],
  );
  const waiting = Math.max(0, queue.length - 1);

  useEffect(() => {
    headIdRef.current = headId;
  }, [headId]);

  // A socket payload may carry only the id; load the items to decide on.
  const hasItems = Boolean(order?.items && order.items.length > 0);
  const needsDetails = Boolean(headId && !hasItems && !details[headId] && !detailsFailed.has(headId));
  useEffect(() => {
    if (!needsDetails || !headId) return;
    let cancelled = false;
    OrdersService.getOrderById(headId)
      .then((full) => {
        if (cancelled) return;
        setDetails((current) => ({ ...current, [headId]: full }));
        if (full.status && full.status !== "pending") clearOrder(headId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isApiNotFound(error)) clearOrder(headId);
        setDetailsFailed((current) => new Set(current).add(headId));
      });
    return () => {
      cancelled = true;
    };
  }, [needsDetails, headId, clearOrder]);

  const retryDetails = () => {
    if (!headId) return;
    setDetailsFailed((current) => {
      const next = new Set(current);
      next.delete(headId);
      return next;
    });
  };

  // An order on screen in a visible tab counts as "seen" (idempotent server-side).
  useEffect(() => {
    if (!headId) return;
    const report = () => {
      if (document.hidden || seenRef.current.has(headId)) return;
      seenRef.current.add(headId);
      OrdersService.markSeen(headId).catch(() => seenRef.current.delete(headId));
    };
    report();
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, [headId]);

  // ── Sound ───────────────────────────────────────────────────────────────
  const silenced = Boolean(silence && silence.id === headId);
  const subOpen = Boolean(sub && sub.id === headId);
  const shouldRing = Boolean(headId) && !subOpen && !silenced;

  useEffect(() => {
    if (!silence) return;
    const timer = window.setTimeout(() => setSilence(null), Math.max(0, silence.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [silence]);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(RING_SRC);
      audio.loop = true;
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const startRinging = useCallback(() => {
    const audio = getAudio();
    audio.muted = false;
    if (!audio.paused) return;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => setSoundBlocked(false))
      .catch((error: unknown) => {
        // NotAllowedError: no user gesture yet. Anything else (decode, network)
        // is not something a click fixes, so it isn't surfaced as "blocked".
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setSoundBlocked(true);
        }
      });
  }, [getAudio]);

  const stopRinging = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  useEffect(() => {
    ringingRef.current = shouldRing;
    if (!shouldRing) {
      stopRinging();
      return;
    }
    startRinging();
    return () => stopRinging();
  }, [shouldRing, startRinging, stopRinging]);

  /** Muted play inside a gesture: unlocks the element for later (Safari needs it per element). */
  const primeAudio = useCallback(() => {
    const audio = getAudio();
    if (ringingRef.current) {
      startRinging();
      return;
    }
    if (!audio.paused) return;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        if (!ringingRef.current) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }, [getAudio, startRinging]);

  // The first gesture anywhere on the page unlocks audio for the rest of it.
  useEffect(() => {
    const onGesture = () => {
      primeAudio();
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
  }, [primeAudio]);

  // Blocked earlier but a later gesture got through: retry on the next one.
  useEffect(() => {
    if (!soundBlocked || !shouldRing) return;
    const retry = () => startRinging();
    document.addEventListener("pointerdown", retry, true);
    document.addEventListener("keydown", retry, true);
    return () => {
      document.removeEventListener("pointerdown", retry, true);
      document.removeEventListener("keydown", retry, true);
    };
  }, [soundBlocked, shouldRing, startRinging]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
      notificationRef.current?.close();
    },
    [],
  );

  const enableSound = () => {
    writeSession(SOUND_PREF_KEY, "on");
    setSoundOptedIn(true);
    primeAudio();
  };

  const enableNotifications = () => {
    if (permission === "unsupported") return;
    void Notification.requestPermission().then(setPermission, () => setPermission(readPermission()));
  };

  // ── Desktop notification + tab title ────────────────────────────────────
  const currency = order?.restaurant?.currency ?? restaurant?.currency;
  const itemCount = (order?.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const totalText = order ? formatMoney(locale, orderTotal(order), currency) : "";
  const changeText = order ? cashChangeText(t, locale, order, currency) : null;
  const code = order ? orderCode(order) : "";
  const notifyTitle = code ? t("liveorders.notification_title", { code }) : "";
  const notifyBody = code ? t("liveorders.notification_body", { count: itemCount, total: totalText }) : "";

  useEffect(() => {
    if (!headId || permission !== "granted") return;
    if (notifiedRef.current.has(headId)) return;
    if (!document.hidden && document.hasFocus()) return;
    notifiedRef.current.add(headId);
    try {
      notificationRef.current?.close();
      const notification = new Notification(notifyTitle, {
        body: notifyBody,
        tag: `nowlny-order-${headId}`,
        requireInteraction: true,
        icon: "/favicon.ico",
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      notificationRef.current = notification;
    } catch {
      // Some browsers (Android Chrome) only allow notifications from a service worker.
    }
  }, [headId, permission, notifyTitle, notifyBody]);

  // Close it once the order is answered or replaced, or the tab gets focus.
  useEffect(() => {
    const close = () => {
      notificationRef.current?.close();
      notificationRef.current = null;
    };
    window.addEventListener("focus", close);
    return () => {
      window.removeEventListener("focus", close);
      close();
    };
  }, [headId]);

  const flashText = t("liveorders.title_flash");
  useEffect(() => {
    if (!headId) return;
    // Inserted after the orders page's "(3) " counter, which that page strips
    // with an anchored regex — putting ours first would break its cleanup.
    const marker = `● ${flashText} · `;
    const strip = () => {
      if (document.title.includes(marker)) document.title = document.title.replace(marker, "");
    };
    let on = false;
    const tick = () => {
      strip();
      on = !on;
      if (!on) return;
      const prefix = document.title.match(/^\(\d+\)\s*/)?.[0] ?? "";
      document.title = prefix + marker + document.title.slice(prefix.length);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(interval);
      strip();
    };
  }, [headId, flashText]);

  // ── Focus: move into the alert when an order appears, give it back after ─
  useEffect(() => {
    if (!headId) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !(previous && panel.contains(previous))) {
      (acceptBtnRef.current ?? panel).focus();
    }
    return () => {
      if (previous?.isConnected && !panel?.contains(previous)) previous.focus();
    };
  }, [headId]);

  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // ── Answers ─────────────────────────────────────────────────────────────
  const handleStale = (error: unknown, id: string, fallback: MessageKey) => {
    // 409: answered elsewhere / auto-rejected in the meantime.
    if (isApiStatus(error, 409) || isApiNotFound(error)) {
      clearOrder(id);
      setSub(null);
    }
    toast.error(getApiErrorMessage(error, t(fallback)));
    void refreshPending();
  };

  const confirmAccept = async (prepTimeMinutes: number) => {
    if (!order || busy) return;
    const id = order.id;
    setBusy(true);
    try {
      await OrdersService.acceptOrder(id, prepTimeMinutes);
      clearOrder(id);
      setSub(null);
      toast.success(t("orders.accepted_success"));
      announceChange({ event: "accepted", orderId: id });
    } catch (error) {
      handleStale(error, id, "orders.accept_failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = async (reason: string) => {
    if (!order || busy) return;
    const id = order.id;
    setBusy(true);
    try {
      await OrdersService.rejectOrder(id, reason);
      clearOrder(id);
      setSub(null);
      toast.success(t("orders.rejected_success"));
      announceChange({ event: "rejected", orderId: id });
    } catch (error) {
      handleStale(error, id, "orders.reject_failed");
    } finally {
      setBusy(false);
    }
  };

  const hideOrder = () => {
    if (!headId) return;
    setHidden((current) => new Set(current).add(headId));
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const soundNeeded = !soundOptedIn;
  const notificationsNeeded = permission === "default";
  const showSetup = !order && !setupDismissed && (soundNeeded || notificationsNeeded);

  if (!order) {
    if (!showSetup) return null;
    return (
      <section className={alertStyles.setup} aria-labelledby={titleId}>
        <h2 id={titleId}>
          <Bell size={18} aria-hidden /> {t("liveorders.setup_title")}
        </h2>
        <p>{t("liveorders.setup_body")}</p>
        <div className={alertStyles.tools}>
          {soundNeeded && (
            <button type="button" className="btn-primary btn-sm" onClick={enableSound}>
              <Volume2 size={16} aria-hidden /> {t("liveorders.enable_sound")}
            </button>
          )}
          {notificationsNeeded && (
            <button type="button" className="btn-outline btn-sm" onClick={enableNotifications}>
              <BellRing size={16} aria-hidden /> {t("liveorders.enable_notifications")}
            </button>
          )}
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => {
              writeSession(SETUP_DISMISSED_KEY, "1");
              setSetupDismissed(true);
            }}
          >
            {t("liveorders.setup_dismiss")}
          </button>
        </div>
      </section>
    );
  }

  const items = order.items ?? [];
  const loadingDetails = needsDetails;
  const failedDetails = !hasItems && detailsFailed.has(order.id);
  const received = formatClock(locale, order.createdAt);

  return (
    <>
      <div className="modal-overlay">
        <div
          ref={panelRef}
          className={`modal-panel ${alertStyles.panel}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-desc`}
          tabIndex={-1}
          style={{ maxWidth: 520 }}
          onKeyDown={trapTab}
        >
          <div className={alertStyles.header}>
            <span className={`${alertStyles.bell}${shouldRing ? ` ${alertStyles.ringing}` : ""}`} aria-hidden>
              {silenced ? <BellOff size={24} /> : <BellRing size={24} />}
            </span>
            <div className={alertStyles.heading}>
              <h2 id={titleId}>{t("liveorders.title")}</h2>
              <p id={`${titleId}-desc`}>{t("liveorders.subtitle")}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={hideOrder}
              aria-label={t("liveorders.hide")}
              title={`${t("liveorders.hide")} — ${t("liveorders.hide_hint")}`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {soundBlocked && shouldRing && (
              <div className="notice notice-warning" role="status">
                <Volume2 size={18} aria-hidden />
                <span style={{ flex: 1 }}>{t("liveorders.sound_blocked")}</span>
                <button type="button" className="btn-primary btn-sm" onClick={enableSound}>
                  {t("liveorders.enable_sound")}
                </button>
              </div>
            )}

            <div className={alertStyles.summary}>
              <span className={`${alertStyles.code} force-ltr`}>{code}</span>
              <span className={`${alertStyles.total} force-ltr`}>{totalText}</span>
            </div>
            <div className={alertStyles.meta}>
              {received && <span>{t("liveorders.received", { time: received })}</span>}
              {itemCount > 0 && <span className="badge">{t("liveorders.items_count", { count: itemCount })}</span>}
              {waiting > 0 && (
                <span className="badge badge-warning">{t("liveorders.waiting_more", { count: waiting })}</span>
              )}
            </div>

            {loadingDetails && <p className={alertStyles.muted} role="status">{t("liveorders.loading_details")}</p>}
            {failedDetails && (
              <div className="notice notice-error">
                <span style={{ flex: 1 }}>{t("liveorders.details_failed")}</span>
                <button type="button" className="btn-outline btn-sm" onClick={retryDetails}>
                  {t("common.retry")}
                </button>
              </div>
            )}

            {items.length > 0 && (
              <div className={`${styles.items} ${alertStyles.itemsBox}`} aria-label={t("orders.items")}>
                {items.map((item, index) => (
                  <div key={index} className={styles.item}>
                    <div className={`${styles.itemQty} force-ltr`}>{item.quantity}x</div>
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>
                        {localized(item.menuItem?.name, locale) ||
                          localized(item.name, locale) ||
                          t("orders.item_fallback")}
                      </span>
                      {item.selectedOptions &&
                        Object.entries(item.selectedOptions).map(([key, value]) => (
                          <div key={key} className={styles.itemOption}>
                            {(Array.isArray(value) ? value : [value])
                              .map((option) => localized(option, locale))
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        ))}
                      {item.notes && (
                        <div className={styles.itemNote}>
                          <strong>{t("orders.item_note")}</strong> {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {changeText && (
              <div className={alertStyles.note}>
                <strong>{t("ordersx.pay_cash")}</strong>
                {changeText}
              </div>
            )}

            {order.customerNotes && (
              <div className={alertStyles.note}>
                <strong>{t("liveorders.customer_note")}</strong>
                {order.customerNotes}
              </div>
            )}

            <div className={alertStyles.tools}>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setSilence({ id: order.id, until: Date.now() + SILENCE_MS })}
                disabled={silenced}
              >
                <BellOff size={16} aria-hidden />
                {silenced ? t("liveorders.silenced") : t("liveorders.silence")}
              </button>
              <button type="button" className="btn-outline btn-sm" onClick={hideOrder}>
                <EyeOff size={16} aria-hidden /> {t("liveorders.hide")}
              </button>
              {permission === "default" && (
                <button type="button" className="btn-outline btn-sm" onClick={enableNotifications}>
                  <BellRing size={16} aria-hidden /> {t("liveorders.enable_notifications")}
                </button>
              )}
              <Link href="/orders" className="btn-outline btn-sm" onClick={hideOrder}>
                {t("liveorders.view_order")}
              </Link>
            </div>
          </div>

          <div className={alertStyles.footer}>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setSub({ kind: "reject", id: order.id })}
              disabled={busy}
            >
              {t("orders.reject")}
            </button>
            <button
              ref={acceptBtnRef}
              type="button"
              className={`btn-primary ${alertStyles.accept}`}
              onClick={() => setSub({ kind: "accept", id: order.id })}
              disabled={busy}
            >
              {t("orders.accept")}
            </button>
          </div>
        </div>
      </div>

      {subOpen && sub?.kind === "accept" && (
        <AcceptOrderModal
          key={order.id}
          order={order}
          busy={busy}
          onConfirm={(minutes) => void confirmAccept(minutes)}
          onClose={() => setSub(null)}
        />
      )}
      {subOpen && sub?.kind === "reject" && (
        <RejectOrderModal
          key={order.id}
          order={order}
          busy={busy}
          onConfirm={(reason) => void confirmReject(reason)}
          onClose={() => setSub(null)}
        />
      )}
    </>
  );
}
