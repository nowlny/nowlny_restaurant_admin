"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCheck, Loader2, RefreshCw, ShoppingBag } from "lucide-react";
import {
  NotificationsService,
  notificationOrderId,
  type AppNotification,
} from "@/services/api/notifications";
import { getApiErrorMessage } from "@/services/api/errors";
import { useFeedback } from "@/components/ui/Feedback";
import { intlLocale, useI18n, type Locale } from "@/lib/i18n";
import styles from "./notifications.module.css";

const PAGE_SIZE = 20;
const TICK_MS = 60_000;

type Filter = "all" | "unread";
type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "5 minutes ago" / "yesterday"; past a month, the date itself reads better. */
function relativeTime(iso: string | null | undefined, now: number, locale: Locale, justNow: string) {
  const then = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(then)) return "";
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return justNow;
  const tag = intlLocale(locale);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  if (abs < HOUR) return rtf.format(Math.round(seconds / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(seconds / HOUR), "hour");
  if (abs < WEEK) return rtf.format(Math.round(seconds / DAY), "day");
  if (abs < 30 * DAY) return rtf.format(Math.round(seconds / WEEK), "week");
  return new Date(then).toLocaleDateString(tag, { dateStyle: "medium" });
}

const fullTimestamp = (iso: string | null | undefined, locale: Locale) => {
  const then = iso ? new Date(iso) : null;
  return then && Number.isFinite(then.getTime())
    ? then.toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })
    : undefined;
};

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();

  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Bumped on every filter change / reload, so a "load more" that started
  // under the previous filter can't append its rows to the new list.
  const generationRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    NotificationsService.getMine({ page: 1, limit: PAGE_SIZE, unreadOnly: filter === "unread" })
      .then((result) => {
        if (generation !== generationRef.current) return;
        setItems(result.items);
        setPage(result.page);
        setTotalPages(result.totalPages);
        setUnreadCount(result.unreadCount);
        setNow(Date.now());
        setLoad({ status: "ready" });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch notifications", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (generation === generationRef.current) {
          setLoad({ status: "error", message: getApiErrorMessage(err, "") });
        }
      });
  }, [filter, reloadKey]);

  const retry = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setLoad({ status: "loading" });
    setLoadingMore(false);
    setFilter(next);
  };

  const loadMore = async () => {
    if (loadingMore) return;
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const result = await NotificationsService.getMine({
        page: page + 1,
        limit: PAGE_SIZE,
        unreadOnly: filter === "unread",
      });
      if (generation !== generationRef.current) return;
      setItems((current) => {
        // New notifications shift the pages, so the next page can repeat rows.
        const seen = new Set(current.map((n) => n.id));
        return [...current, ...result.items.filter((n) => !seen.has(n.id))];
      });
      setPage(result.page);
      setTotalPages(result.totalPages);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error("Failed to fetch more notifications", err);
      if (generation === generationRef.current) {
        toast.error(getApiErrorMessage(err, t("notifications.load_more_failed")));
      }
    } finally {
      if (generation === generationRef.current) setLoadingMore(false);
    }
  };

  const markRead = async (notification: AppNotification) => {
    if (notification.isRead) return;
    const setRead = (isRead: boolean) =>
      setItems((current) => current.map((n) => (n.id === notification.id ? { ...n, isRead } : n)));
    // Optimistic: the row stays put (even under "Unread") so it doesn't jump away mid-click.
    setRead(true);
    setUnreadCount((n) => Math.max(0, n - 1));
    try {
      await NotificationsService.markAsRead(notification.id);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
      setRead(false);
      setUnreadCount((n) => n + 1);
      toast.error(getApiErrorMessage(err, t("notifications.mark_failed")));
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    const snapshot = { items, unreadCount };
    setMarkingAll(true);
    setItems((current) => current.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await NotificationsService.markAllAsRead();
      toast.success(t("notifications.all_marked_read"));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
      setItems(snapshot.items);
      setUnreadCount(snapshot.unreadCount);
      toast.error(getApiErrorMessage(err, t("notifications.mark_all_failed")));
    } finally {
      setMarkingAll(false);
    }
  };

  const renderRow = (notification: AppNotification) => {
    const orderId = notificationOrderId(notification);
    const title = notification.title?.trim() || t("notifications.untitled");
    const body = (notification.body || notification.message || "").trim();
    const unread = !notification.isRead;
    const className = [styles.row, unread ? styles.unread : "", orderId || unread ? styles.interactive : ""]
      .filter(Boolean)
      .join(" ");

    const inner = (
      <>
        <span className={styles.icon} aria-hidden="true">
          {orderId ? <ShoppingBag size={18} /> : <Bell size={18} />}
          {unread && <span className={styles.dot} />}
        </span>
        <span className={styles.content}>
          <span className={styles.head}>
            <span className={styles.title}>
              {unread && <span className="sr-only">{t("notifications.unread")}: </span>}
              {title}
            </span>
            <time
              className={styles.time}
              dateTime={notification.createdAt ?? undefined}
              title={fullTimestamp(notification.createdAt, locale)}
            >
              {relativeTime(notification.createdAt, now, locale, t("notifications.just_now"))}
            </time>
          </span>
          {body && <span className={styles.body}>{body}</span>}
          {orderId && (
            <span className={styles.link}>
              {t("notifications.view_order")} <ArrowRight size={14} className="flip-in-rtl" aria-hidden="true" />
            </span>
          )}
        </span>
      </>
    );

    // `/orders?order=<id>` opens that order's details.
    if (orderId) {
      return (
        <Link href={`/orders?order=${encodeURIComponent(orderId)}`} className={className} onClick={() => void markRead(notification)}>
          {inner}
        </Link>
      );
    }
    if (unread) {
      return (
        <button type="button" className={className} onClick={() => void markRead(notification)}>
          {inner}
        </button>
      );
    }
    return <div className={className}>{inner}</div>;
  };

  const emptyUnread = filter === "unread";

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("notifications.title")}</h1>
          <p className="page-subtitle">{t("notifications.subtitle")}</p>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() => void markAllRead()}
          disabled={markingAll || unreadCount === 0 || load.status !== "ready"}
        >
          {markingAll ? <Loader2 size={18} className="animate-spin" /> : <CheckCheck size={18} />}
          {t("notifications.mark_all_read")}
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className="segmented" role="group" aria-label={t("notifications.filter_label")}>
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
            >
              {t(value === "all" ? "notifications.filter_all" : "notifications.filter_unread")}
            </button>
          ))}
        </div>
        {load.status === "ready" && (
          <p className={styles.count} aria-live="polite">
            {unreadCount > 0
              ? t("notifications.unread_count", { count: unreadCount })
              : t("notifications.all_caught_up")}
          </p>
        )}
      </div>

      {load.status === "loading" ? (
        <div className={`card ${styles.list}`} aria-busy="true" aria-label={t("common.loading")}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="skeleton" style={{ height: 14, width: "45%" }} />
                <div className="skeleton" style={{ height: 12, width: "80%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : load.status === "error" ? (
        <div className="empty-state" role="alert">
          <h3>{load.message || t("notifications.load_failed")}</h3>
          <button type="button" className="btn-outline" onClick={retry}>
            <RefreshCw size={18} /> {t("common.retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Bell size={40} color="var(--accent-primary)" aria-hidden="true" />
          <h3>{t(emptyUnread ? "notifications.empty_unread_title" : "notifications.empty_title")}</h3>
          <p>{t(emptyUnread ? "notifications.empty_unread_body" : "notifications.empty_body")}</p>
        </div>
      ) : (
        <>
          <ul className={`card ${styles.list}`}>
            {items.map((notification) => (
              <li key={notification.id}>{renderRow(notification)}</li>
            ))}
          </ul>
          {page < totalPages && (
            <div className={styles.footer}>
              <button type="button" className="btn-outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore && <Loader2 size={18} className="animate-spin" />}
                {loadingMore ? t("common.loading") : t("notifications.load_more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
