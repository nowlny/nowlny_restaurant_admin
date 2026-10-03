"use client";

import { memo, type CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Navigation,
  Timer,
  XCircle,
} from "lucide-react";
import type { PickupRequest, RestaurantOrder } from "@/services/api/orders";
import { useI18n } from "@/lib/i18n";
import {
  TONE_BG,
  TONE_COLOR,
  badgeClass,
  cashChangeText,
  formatClock,
  formatMoney,
  formatWhen,
  isPickupCancellable,
  orderCode,
  orderTotal,
  paymentMethodLabel,
  pickupStatusKey,
  statusLabel,
  statusTone,
} from "./orderMeta";
import styles from "./orders.module.css";

export type OrderAction =
  | "open"
  | "accept"
  | "reject"
  | "dispatch"
  | "track"
  | "cancelPickup";

export type OrderActionHandler = (
  action: OrderAction,
  order: RestaurantOrder,
  pickup?: PickupRequest,
) => void;

type CurrencyLike = { code?: string; symbol?: string | null } | null | undefined;

interface OrderCardProps {
  order: RestaurantOrder;
  pickup?: PickupRequest;
  selected?: boolean;
  /** Arrived since the previous poll and not opened yet. */
  fresh?: boolean;
  /** A request for this card is in flight (cancel pickup). */
  busy?: boolean;
  /** Show status + closing reason instead of board actions (closed list). */
  variant?: "board" | "list";
  fallbackCurrency?: CurrencyLike;
  onAction: OrderActionHandler;
}

/**
 * One order on the board. Memoised: the board re-renders on every 15s poll and
 * on each action, and only the cards whose order object changed need to.
 * The page keeps `onAction` stable and patches orders immutably, so an
 * untouched order keeps its identity and skips rendering.
 */
function OrderCard({
  order,
  pickup,
  selected = false,
  fresh = false,
  busy = false,
  variant = "board",
  fallbackCurrency,
  onAction,
}: OrderCardProps) {
  const { t, locale } = useI18n();
  const code = orderCode(order);
  const tone = statusTone(order.status);
  const toneVars = {
    "--tone": TONE_COLOR[tone],
    "--tone-bg": TONE_BG[tone],
  } as CSSProperties;
  const escalated =
    order.status === "pending" && (order.escalationLevel ?? 0) >= 1;
  const closedReason = order.rejectionReason || order.cancellationReason;
  const changeText = cashChangeText(t, locale, order, order.restaurant?.currency ?? fallbackCurrency);

  return (
    <div
      className={[
        styles.card,
        selected ? styles.cardSelected : "",
        fresh ? styles.cardFresh : "",
      ].join(" ")}
      style={toneVars}
    >
      <button
        type="button"
        className={styles.cardMain}
        onClick={() => onAction("open", order)}
        aria-label={t("ordersx.open_order", { code })}
      >
        <span className={styles.cardRow}>
          <span>
            <span className={`${styles.cardCode} force-ltr`}>{code}</span>
            <span className={styles.cardTime}>
              {formatWhen(locale, order.createdAt) || t("orders.time_unavailable")}
            </span>
          </span>
          <span className={`${styles.cardTotal} force-ltr`}>
            {formatMoney(
              locale,
              orderTotal(order),
              order.restaurant?.currency ?? fallbackCurrency,
            )}
          </span>
        </span>

        <span className={styles.cardMeta}>
          {t("orders.items_and_payment", {
            count: order.items?.length || 0,
            payment: paymentMethodLabel(t, order.paymentMethod),
          })}
        </span>

        {changeText && (
          <span className={styles.cardNote}>
            <Banknote size={12} />
            <span>{changeText}</span>
          </span>
        )}

        {(fresh || escalated || order.scheduledFor || variant === "list" ||
          (order.status === "confirmed" && order.estimatedDeliveryAt)) && (
          <span className={styles.cardBadges}>
            {variant === "list" && (
              <span className={badgeClass(tone)}>{statusLabel(t, order.status)}</span>
            )}
            {fresh && <span className="badge badge-accent">{t("ordersx.new_badge")}</span>}
            {escalated && (
              <span className="badge badge-error">
                <AlertTriangle size={12} /> {t("ordersx.escalated")}
              </span>
            )}
            {order.scheduledFor && (
              <span className="badge badge-info">
                <CalendarClock size={12} />
                {t("ordersx.scheduled_for", { time: formatWhen(locale, order.scheduledFor) })}
              </span>
            )}
            {order.status === "confirmed" && order.estimatedDeliveryAt && (
              <span className="badge">
                <Timer size={12} />
                {t("ordersx.eta", { time: formatClock(locale, order.estimatedDeliveryAt) })}
              </span>
            )}
          </span>
        )}

        {order.customerNotes && variant === "board" && (
          <span className={styles.cardNote}>
            <AlertCircle size={12} />
            <span>{order.customerNotes}</span>
          </span>
        )}

        {variant === "list" && (order.autoRejectedAt || closedReason) && (
          <span className={styles.reason}>
            {order.autoRejectedAt ? (
              t("ordersx.auto_rejected")
            ) : (
              <>
                <strong>
                  {order.status === "cancelled"
                    ? t("ordersx.cancellation_reason")
                    : t("ordersx.rejection_reason")}
                  :
                </strong>{" "}
                {closedReason}
              </>
            )}
          </span>
        )}
      </button>

      {variant === "board" && (
        <CardActions order={order} pickup={pickup} busy={busy} onAction={onAction} />
      )}
    </div>
  );
}

function CardActions({
  order,
  pickup,
  busy,
  onAction,
}: {
  order: RestaurantOrder;
  pickup?: PickupRequest;
  busy: boolean;
  onAction: OrderActionHandler;
}) {
  const { t } = useI18n();

  switch (order.status) {
    case "pending":
      return (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={`btn-outline ${styles.actionBtn} ${styles.rejectBtn}`}
            onClick={() => onAction("reject", order)}
          >
            {t("orders.reject")}
          </button>
          <button
            type="button"
            className={`btn-primary ${styles.actionBtn} ${styles.acceptBtn}`}
            onClick={() => onAction("accept", order)}
          >
            {t("orders.accept")}
          </button>
        </div>
      );
    case "confirmed":
      return pickup ? (
        <div className={styles.pickupBox}>
          <div className={styles.toneStrip}>{t(pickupStatusKey(pickup.status))}</div>
          {isPickupCancellable(pickup.status) && (
            <button
              type="button"
              className={styles.linkBtn}
              disabled={busy}
              onClick={() => onAction("cancelPickup", order, pickup)}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              {t("ordersx.cancel_pickup")}
            </button>
          )}
        </div>
      ) : (
        <button type="button" className={styles.toneBtn} onClick={() => onAction("dispatch", order)}>
          {t("orders.dispatch")}
        </button>
      );
    case "out_for_delivery":
      return (
        <button type="button" className={styles.toneBtn} onClick={() => onAction("track", order)}>
          <Navigation size={14} /> {t("orders.track_driver")}
        </button>
      );
    case "delivered":
      return (
        <div className={styles.toneStrip}>
          <CheckCircle2 size={14} /> {t("orders.completed")}
        </div>
      );
    default:
      return null;
  }
}

export default memo(OrderCard);
