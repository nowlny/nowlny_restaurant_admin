"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import DriverTrackingModal from "@/components/DriverTrackingModal";
import { useFeedback } from "@/components/ui/Feedback";
import AcceptOrderModal from "@/components/orders/AcceptOrderModal";
import DispatchModal, { type DispatchResult } from "@/components/orders/DispatchModal";
import OrderBoard, { type BoardBuckets } from "@/components/orders/OrderBoard";
import type { OrderActionHandler } from "@/components/orders/OrderCard";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import OrderList from "@/components/orders/OrderList";
import RejectOrderModal from "@/components/orders/RejectOrderModal";
import { ACTIVE_PICKUP_STATUSES } from "@/components/orders/orderMeta";
import styles from "@/components/orders/orders.module.css";
import {
  OrderStatus,
  OrdersService,
  PickupRequest,
  RestaurantOrder,
} from "@/services/api/orders";
import { getApiErrorMessage } from "@/services/api/errors";
import { intlLocale, useI18n } from "@/lib/i18n";
import { useRestaurant } from "@/lib/restaurantContext";

const POLL_MS = 15_000;

type View = "active" | "scheduled" | "closed";

const timeOf = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);

/**
 * Keep the previous object when the server copy hasn't changed, so memoised
 * cards for untouched orders skip re-rendering on every poll.
 */
function reconcileOrders(previous: RestaurantOrder[], next: RestaurantOrder[]) {
  const byId = new Map(previous.map((order) => [order.id, order]));
  return next.map((order) => {
    const old = byId.get(order.id);
    return old &&
      order.updatedAt &&
      old.updatedAt === order.updatedAt &&
      old.status === order.status &&
      old.seenAt === order.seenAt &&
      old.escalationLevel === order.escalationLevel
      ? old
      : order;
  });
}

function reconcilePickups(previous: PickupRequest[], next: PickupRequest[]) {
  const byId = new Map(previous.map((request) => [request.id, request]));
  return next.map((request) => {
    const old = byId.get(request.id);
    return old && old.status === request.status && old.driver?.id === request.driver?.id
      ? old
      : request;
  });
}

const TITLE_PREFIX = /^\(\d+\)\s*/;

export default function OrdersPage() {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const { restaurant } = useRestaurant();
  const fallbackCurrency = restaurant?.currency;

  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [pickupRequests, setPickupRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // null = no error; a string (possibly empty) = the server's wording, if any.
  // Kept free of `t` so the polling callback never has to close over it.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());

  const [view, setView] = useState<View>("active");
  const [closedOrders, setClosedOrders] = useState<RestaurantOrder[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedError, setClosedError] = useState<string | null>(null);

  // Snapshots; the live copy is looked up in `orders` so polls keep them current.
  const [selected, setSelected] = useState<RestaurantOrder | null>(null);
  const [tracking, setTracking] = useState<RestaurantOrder | null>(null);
  const [dispatching, setDispatching] = useState<RestaurantOrder | null>(null);
  const [accepting, setAccepting] = useState<RestaurantOrder | null>(null);
  const [rejecting, setRejecting] = useState<RestaurantOrder | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [busyPickupId, setBusyPickupId] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  // Bumped by every optimistic edit. A poll that started before the edit would
  // otherwise land afterwards and briefly revert it.
  const editSeqRef = useRef(0);
  const knownPendingRef = useRef<Set<string> | null>(null);
  const seenRequestedRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async (showLoader = true) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const seq = editSeqRef.current;
    if (showLoader) setLoading(true);
    try {
      const [data, requests] = await Promise.all([
        OrdersService.getOrders({ limit: 100 }),
        OrdersService.getPickupRequests().catch(() => null),
      ]);
      if (seq !== editSeqRef.current) return;

      setOrders((previous) => reconcileOrders(previous, data));
      if (requests) setPickupRequests((previous) => reconcilePickups(previous, requests));
      setLastSyncedAt(new Date());
      setLoadError(null);

      // Flag pending orders that weren't there on the previous poll. The first
      // load sets the baseline, so a page refresh doesn't light up everything.
      const pendingIds = data.filter((order) => order.status === "pending").map((order) => order.id);
      const known = knownPendingRef.current;
      const added = known ? pendingIds.filter((id) => !known.has(id)) : [];
      knownPendingRef.current = new Set(pendingIds);
      setFreshIds((previous) => {
        const stillPending = new Set(pendingIds);
        const next = new Set([...previous].filter((id) => stillPending.has(id)));
        added.forEach((id) => next.add(id));
        return next.size === previous.size && [...next].every((id) => previous.has(id))
          ? previous
          : next;
      });
    } catch (error: unknown) {
      setLoadError(getApiErrorMessage(error, ""));
    } finally {
      inFlightRef.current = false;
      if (showLoader) setLoading(false);
    }
  }, []);

  // Poll only while the tab is visible; catch up the moment it's shown again.
  useEffect(() => {
    const initial = window.setTimeout(() => void fetchOrders(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchOrders(false);
    }, POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void fetchOrders(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // The app-wide live alert answered an order or heard a socket event.
    const onOrdersChanged = () => void fetchOrders(false);
    window.addEventListener("nowlny:orders-changed", onOrdersChanged);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("nowlny:orders-changed", onOrdersChanged);
    };
  }, [fetchOrders]);

  // `/orders?order=<id>` (from a notification) opens that order once.
  useEffect(() => {
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("order");
    if (!orderId) return;
    url.searchParams.delete("order");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    // Not cancelled on cleanup: the param is already gone, so a dev-mode
    // effect re-run would never get another chance to open it.
    OrdersService.getOrderById(orderId)
      .then((order) => {
        if (order) setSelected(order);
      })
      .catch(() => {});
  }, []);

  const patchOrder = useCallback((id: string, patch: Partial<RestaurantOrder>) => {
    editSeqRef.current += 1;
    const apply = (order: RestaurantOrder) => (order.id === id ? { ...order, ...patch } : order);
    setOrders((current) => current.map(apply));
    setClosedOrders((current) => current.map(apply));
  }, []);

  const clearFresh = useCallback((id: string) => {
    setFreshIds((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  /** PATCH .../seen once per order per page session; the server keeps the first stamp. */
  const markSeen = useCallback((order: RestaurantOrder) => {
    if (order.status !== "pending" || order.seenAt) return;
    const requested = seenRequestedRef.current;
    if (requested.has(order.id)) return;
    requested.add(order.id);
    OrdersService.markSeen(order.id)
      .then((updated) => {
        const seenAt = updated?.seenAt ?? new Date().toISOString();
        setOrders((current) =>
          current.map((item) => (item.id === order.id ? { ...item, seenAt } : item)),
        );
      })
      .catch(() => {
        // Let a later poll try again rather than never reporting it.
        requested.delete(order.id);
      });
  }, []);

  const buckets = useMemo(() => {
    const next: BoardBuckets & { scheduled: RestaurantOrder[] } = {
      pending: [],
      confirmed: [],
      out_for_delivery: [],
      delivered: [],
      scheduled: [],
    };
    for (const order of orders) {
      if (order.status in next) next[order.status as keyof typeof next].push(order);
    }
    // Kitchen works first-in-first-out; the general list comes newest first.
    next.pending.sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
    next.scheduled.sort((a, b) => timeOf(a.scheduledFor) - timeOf(b.scheduledFor));
    return next;
  }, [orders]);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const pickupByOrderId = useMemo(() => {
    const map = new Map<string, PickupRequest>();
    for (const request of pickupRequests) {
      const orderId = request.order?.id;
      if (orderId && !map.has(orderId) && ACTIVE_PICKUP_STATUSES.includes(request.status)) {
        map.set(orderId, request);
      }
    }
    return map;
  }, [pickupRequests]);

  // A pending order on screen while the tab is visible counts as "seen".
  useEffect(() => {
    if (document.hidden) return;
    buckets.pending.forEach(markSeen);
  }, [buckets.pending, markSeen]);

  // "(3) Nowlny…" in the tab title while orders wait for an answer.
  const pendingCount = buckets.pending.length;
  useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, "");
    document.title = pendingCount > 0 ? `(${pendingCount}) ${base}` : base;
  }, [pendingCount]);
  useEffect(
    () => () => {
      document.title = document.title.replace(TITLE_PREFIX, "");
    },
    [],
  );

  const loadClosed = useCallback(async () => {
    setClosedLoading(true);
    setClosedError(null);
    try {
      const [rejected, cancelled] = await Promise.all([
        OrdersService.getOrders({ status: "rejected", limit: 25 }),
        OrdersService.getOrders({ status: "cancelled", limit: 25 }),
      ]);
      setClosedOrders(
        [...rejected, ...cancelled]
          .sort(
            (a, b) =>
              timeOf(b.updatedAt ?? b.createdAt) - timeOf(a.updatedAt ?? a.createdAt),
          )
          .slice(0, 40),
      );
    } catch (error) {
      setClosedError(getApiErrorMessage(error, ""));
    } finally {
      setClosedLoading(false);
    }
  }, []);

  const switchView = (next: View) => {
    setView(next);
    if (next === "closed") void loadClosed();
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleCancelPickup = async (pickup: PickupRequest) => {
    const ok = await confirm({
      title: t("ordersx.cancel_pickup_title"),
      message: t("ordersx.cancel_pickup_body", {
        company: pickup.company?.name ?? t("ordersx.delivery_partner"),
      }),
      danger: true,
      confirmLabel: t("ordersx.cancel_pickup"),
      cancelLabel: t("ordersx.cancel_pickup_keep"),
    });
    if (!ok) return;
    setBusyPickupId(pickup.id);
    try {
      await OrdersService.cancelPickupRequest(pickup.id);
      editSeqRef.current += 1;
      setPickupRequests((current) =>
        current.map((request) =>
          request.id === pickup.id ? { ...request, status: "cancelled" } : request,
        ),
      );
      toast.success(t("ordersx.pickup_cancelled"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("ordersx.pickup_cancel_failed")));
    } finally {
      setBusyPickupId(null);
      void fetchOrders(false);
    }
  };

  // Cards and the drawer get one stable callback; the latest handlers (which
  // close over `t`, a new function each render) are read through a ref.
  const actionRef = useRef<OrderActionHandler>(() => {});
  useEffect(() => {
    actionRef.current = (action, order, pickup) => {
      switch (action) {
        case "open":
          setSelected(order);
          clearFresh(order.id);
          markSeen(order);
          break;
        case "accept":
          clearFresh(order.id);
          setAccepting(order);
          break;
        case "reject":
          clearFresh(order.id);
          setRejecting(order);
          break;
        case "dispatch":
          setDispatching(order);
          break;
        case "track":
          setTracking(order);
          break;
        case "cancelPickup":
          if (pickup) void handleCancelPickup(pickup);
          break;
      }
    };
  });
  const onAction = useCallback<OrderActionHandler>(
    (action, order, pickup) => actionRef.current(action, order, pickup),
    [],
  );

  const confirmAccept = async (prepTimeMinutes: number) => {
    const order = accepting;
    if (!order) return;
    setActionBusy(true);
    try {
      const updated = await OrdersService.acceptOrder(order.id, prepTimeMinutes);
      patchOrder(order.id, {
        ...(updated ?? {}),
        status: updated?.status ?? "confirmed",
        prepTimeMinutes: updated?.prepTimeMinutes ?? prepTimeMinutes,
      });
      setAccepting(null);
      toast.success(t("orders.accepted_success"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("orders.accept_failed")));
    } finally {
      setActionBusy(false);
      // Background refresh; also picks up a 409 (answered on another device).
      void fetchOrders(false);
    }
  };

  const confirmReject = async (reason: string) => {
    const order = rejecting;
    if (!order) return;
    setActionBusy(true);
    try {
      const updated = await OrdersService.rejectOrder(order.id, reason);
      const patch = { ...(updated ?? {}), status: "rejected" as const, rejectionReason: updated?.rejectionReason ?? reason };
      patchOrder(order.id, patch);
      setClosedOrders((current) =>
        current.some((item) => item.id === order.id) ? current : [{ ...order, ...patch }, ...current],
      );
      setRejecting(null);
      toast.success(t("orders.rejected_success"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("orders.reject_failed")));
    } finally {
      setActionBusy(false);
      void fetchOrders(false);
    }
  };

  const handleDispatched = (result: DispatchResult) => {
    const order = dispatching;
    setDispatching(null);
    if (result.kind === "driver") {
      patchOrder(result.order.id, result.order);
    } else if (order) {
      editSeqRef.current += 1;
      const pickup: PickupRequest = {
        ...result.pickup,
        order: result.pickup.order ?? {
          id: order.id,
          orderNumber: order.orderNumber ?? "",
          status: order.status,
        },
      };
      setPickupRequests((current) => [pickup, ...current.filter((item) => item.id !== pickup.id)]);
    }
    void fetchOrders(false);
  };

  const handleTrackedOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => patchOrder(orderId, { status }),
    [patchOrder],
  );

  const liveOf = (snapshot: RestaurantOrder | null) =>
    snapshot
      ? ordersById.get(snapshot.id) ??
        closedOrders.find((order) => order.id === snapshot.id) ??
        snapshot
      : null;
  const selectedOrder = liveOf(selected);
  const trackingOrder = liveOf(tracking);
  const selectedId = selected?.id ?? null;

  const activeCount =
    buckets.pending.length + buckets.confirmed.length + buckets.out_for_delivery.length;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("orders.title")}</h1>
          <p className={styles.subtitle}>{t("orders.subtitle")}</p>
        </div>
        <div className={styles.headerControls}>
          <div className="segmented" role="group" aria-label={t("ordersx.view_label")}>
            <button type="button" aria-pressed={view === "active"} onClick={() => switchView("active")}>
              {t("ordersx.view_active")} ({activeCount})
              {freshIds.size > 0 && view !== "active" && (
                <span className={styles.countPill}>{freshIds.size}</span>
              )}
            </button>
            <button type="button" aria-pressed={view === "scheduled"} onClick={() => switchView("scheduled")}>
              {t("ordersx.view_scheduled")} ({buckets.scheduled.length})
            </button>
            <button type="button" aria-pressed={view === "closed"} onClick={() => switchView("closed")}>
              {t("ordersx.view_closed")}
            </button>
          </div>
          <div className={styles.liveChip}>
            <span className={`${styles.liveDot} animate-pulse`} aria-hidden />
            {lastSyncedAt
              ? t("orders.updated_at", {
                  time: lastSyncedAt.toLocaleTimeString(intlLocale(locale), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })
              : t("orders.checking")}
          </div>
        </div>
      </header>

      {loadError !== null && (
        <div className="notice notice-error" role="alert" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>{loadError || t("orders.load_failed")}</span>
          <button type="button" className="btn-outline btn-sm" onClick={() => void fetchOrders(false)}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, padding: "40px" }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" aria-label={t("common.loading")} />
        </div>
      ) : view === "active" ? (
        <OrderBoard
          buckets={buckets}
          pickupByOrderId={pickupByOrderId}
          freshIds={freshIds}
          selectedId={selectedId}
          busyPickupId={busyPickupId}
          fallbackCurrency={fallbackCurrency}
          onAction={onAction}
        />
      ) : view === "scheduled" ? (
        <OrderList
          orders={buckets.scheduled}
          emptyText={t("ordersx.scheduled_empty")}
          selectedId={selectedId}
          fallbackCurrency={fallbackCurrency}
          onAction={onAction}
        />
      ) : (
        <OrderList
          orders={closedOrders}
          loading={closedLoading}
          error={closedError === null ? null : closedError || t("ordersx.closed_load_failed")}
          hint={t("ordersx.closed_hint")}
          emptyText={t("ordersx.closed_empty")}
          onRefresh={() => void loadClosed()}
          selectedId={selectedId}
          fallbackCurrency={fallbackCurrency}
          onAction={onAction}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          pickup={pickupByOrderId.get(selectedOrder.id)}
          busyPickup={
            busyPickupId !== null && pickupByOrderId.get(selectedOrder.id)?.id === busyPickupId
          }
          fallbackCurrency={fallbackCurrency}
          onAction={onAction}
          onClose={() => setSelected(null)}
        />
      )}

      {accepting && (
        <AcceptOrderModal
          key={accepting.id}
          order={accepting}
          busy={actionBusy}
          onConfirm={(minutes) => void confirmAccept(minutes)}
          onClose={() => setAccepting(null)}
        />
      )}

      {rejecting && (
        <RejectOrderModal
          key={rejecting.id}
          order={rejecting}
          busy={actionBusy}
          onConfirm={(reason) => void confirmReject(reason)}
          onClose={() => setRejecting(null)}
        />
      )}

      {dispatching && (
        <DispatchModal
          key={dispatching.id}
          order={dispatching}
          onClose={() => setDispatching(null)}
          onDispatched={handleDispatched}
        />
      )}

      {trackingOrder && (
        <DriverTrackingModal
          order={trackingOrder}
          onClose={() => setTracking(null)}
          onOrderStatus={handleTrackedOrderStatus}
        />
      )}
    </div>
  );
}
