"use client";

import { AlertCircle, AlertTriangle, CalendarClock, Navigation, Tag, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { PickupRequest, RestaurantOrder } from "@/services/api/orders";
import { intlLocale, useI18n } from "@/lib/i18n";
import type { OrderActionHandler } from "./OrderCard";
import {
  addressText,
  badgeClass,
  cashChangeText,
  formatMoney,
  formatWhen,
  isPickupCancellable,
  mapQuery,
  maskName,
  maskPhone,
  orderCode,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  pickupStatusKey,
  statusLabel,
  statusTone,
} from "./orderMeta";
import styles from "./orders.module.css";

type CurrencyLike = { code?: string; symbol?: string | null } | null | undefined;

/**
 * Full order view. Uses the shared <Modal> (Escape, focus trap, bottom sheet
 * on phones) instead of the hand-rolled drawer that had neither.
 */
export default function OrderDetailModal({
  order,
  pickup,
  busyPickup,
  fallbackCurrency,
  onAction,
  onClose,
}: {
  order: RestaurantOrder;
  pickup?: PickupRequest;
  busyPickup: boolean;
  fallbackCurrency?: CurrencyLike;
  onAction: OrderActionHandler;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const masked = order.status === "pending" || order.status === "scheduled";
  const currency = order.restaurant?.currency ?? fallbackCurrency;
  const money = (value: number | string | null | undefined) => formatMoney(locale, value, currency);
  const changeText = cashChangeText(t, locale, order, currency);
  const when = (iso: string | null | undefined) => formatWhen(locale, iso);

  const customerName = order.customerName || order.customer?.user?.fullName || "";
  const customerPhone = order.customerPhone || order.customer?.user?.phoneNumber || "";
  const total = order.total ?? order.totalAmount ?? 0;
  const deliveryFee = Number(order.deliveryFee || 0);
  const discount = Number(order.discount || 0);

  const timeline: { label: string; value: string }[] = [
    { label: t("ordersx.t_scheduled"), value: when(order.scheduledFor) },
    { label: t("ordersx.t_placed"), value: when(order.createdAt) },
    { label: t("ordersx.t_seen"), value: when(order.seenAt) },
    {
      label: t("ordersx.t_accepted"),
      value: order.acceptedAt
        ? [
            when(order.acceptedAt),
            order.prepTimeMinutes ? t("ordersx.prep_committed", { count: order.prepTimeMinutes }) : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
    },
    {
      label: t("ordersx.t_eta"),
      value:
        order.status === "delivered" || order.status === "cancelled" || order.status === "rejected"
          ? ""
          : when(order.estimatedDeliveryAt),
    },
    { label: t("ordersx.t_out"), value: when(order.outForDeliveryAt) },
    { label: t("ordersx.t_picked"), value: when(order.pickedUpAt) },
    { label: t("ordersx.t_delivered"), value: when(order.deliveredAt) },
  ].filter((row) => row.value);

  const proofs = [
    { label: t("ordersx.proof_pickup"), url: order.pickupProofUrl },
    { label: t("ordersx.proof_delivery"), url: order.deliveryProofUrl },
  ].filter((proof): proof is { label: string; url: string } => Boolean(proof.url));

  const closedReason = order.rejectionReason || order.cancellationReason;

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={520}
      title={t("orders.detail_title", { code: orderCode(order).replace(/^#/, "") })}
      footer={
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>{t("orders.subtotal")}</span>
            <span className="force-ltr">{money(order.subtotal ?? total)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className={styles.totalRow}>
              <span>{t("ordersx.delivery_fee")}</span>
              <span className="force-ltr">{money(deliveryFee)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className={styles.totalRow}>
              <span>
                {t("ordersx.discount")}
                {order.promoCode ? ` (${order.promoCode})` : ""}
              </span>
              <span className="force-ltr" style={{ color: "var(--success)" }}>
                −{money(discount)}
              </span>
            </div>
          )}
          <div className={styles.grandTotal}>
            <span>{t("orders.total")}</span>
            <span className="force-ltr">{money(total)}</span>
          </div>
          <DetailActions order={order} pickup={pickup} busyPickup={busyPickup} onAction={onAction} />
        </div>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <span className={badgeClass(statusTone(order.status))}>{statusLabel(t, order.status)}</span>
        {order.scheduledFor && (
          <span className="badge badge-info">
            <CalendarClock size={12} />
            {t("ordersx.scheduled_for", { time: when(order.scheduledFor) })}
          </span>
        )}
        {order.status === "pending" && (order.escalationLevel ?? 0) >= 1 && (
          <span className="badge badge-error">
            <AlertTriangle size={12} /> {t("ordersx.escalated")}
          </span>
        )}
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {order.createdAt
            ? new Date(order.createdAt).toLocaleString(intlLocale(locale))
            : t("orders.time_unavailable")}
        </span>
      </div>

      {(order.autoRejectedAt || closedReason) && (
        <div className="notice notice-error" role="note">
          <XCircle size={18} aria-hidden />
          <div>
            {order.autoRejectedAt && <div>{t("ordersx.auto_rejected")}</div>}
            {closedReason && (
              <div>
                <strong>
                  {order.status === "cancelled"
                    ? t("ordersx.cancellation_reason")
                    : t("ordersx.rejection_reason")}
                  :
                </strong>{" "}
                {closedReason}
              </div>
            )}
          </div>
        </div>
      )}

      {order.deliveryAddress && (
        <div className={`${styles.mapBox} ${masked ? styles.mapLocked : ""}`}>
          <iframe
            className={styles.mapFrame}
            title={t("ordersx.map_title")}
            loading="lazy"
            tabIndex={masked ? -1 : undefined}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(t, order.deliveryAddress))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
          />
          {masked && <div className={styles.mapLockLabel}>{t("orders.map_locked")}</div>}
        </div>
      )}

      <div className={styles.infoGrid}>
        <div>
          <p className={styles.infoLabel}>{t("orders.payment")}</p>
          <p className={styles.infoValue}>{paymentMethodLabel(t, order.paymentMethod)}</p>
          {changeText && (
            <p className={styles.infoValue} style={{ color: "var(--warning)", marginTop: "4px" }}>
              {changeText}
            </p>
          )}
        </div>
        <div>
          <p className={styles.infoLabel}>{t("orders.payment_status")}</p>
          <span className={badgeClass(paymentStatusTone(order.paymentStatus))}>
            {paymentStatusLabel(t, order.paymentStatus)}
          </span>
        </div>
        {order.promoCode && (
          <div className={styles.infoFull}>
            <p className={styles.infoLabel}>{t("ordersx.promo_code")}</p>
            <p className={styles.infoValue} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={14} aria-hidden />
              <span className="force-ltr">{order.promoCode}</span>
            </p>
          </div>
        )}
        {customerName && (
          <div className={styles.infoFull}>
            <p className={styles.infoLabel}>{t("orders.customer")}</p>
            <p className={styles.infoValue}>
              {maskName(customerName, masked)}
              {customerPhone && (
                <>
                  {" • "}
                  {masked ? (
                    <span className="force-ltr">{maskPhone(customerPhone, true)}</span>
                  ) : (
                    <a className="force-ltr" href={`tel:${customerPhone}`} style={{ color: "var(--accent-primary)" }}>
                      {customerPhone}
                    </a>
                  )}
                </>
              )}
            </p>
          </div>
        )}
        {order.deliveryAddress && (
          <div className={styles.infoFull}>
            <p className={styles.infoLabel}>{t("orders.delivery_address")}</p>
            <p className={styles.infoValue} style={{ fontWeight: 500 }}>
              {addressText(t, order.deliveryAddress, masked)}
            </p>
            {!masked && typeof order.deliveryAddress === "object" && order.deliveryAddress.deliveryInstructions && (
              <p className={styles.infoValue} style={{ fontWeight: 400, color: "var(--text-secondary)", marginTop: "4px" }}>
                {order.deliveryAddress.deliveryInstructions}
              </p>
            )}
          </div>
        )}
      </div>

      {order.customerNotes && (
        <div className="notice notice-warning">
          <AlertCircle size={18} aria-hidden />
          <div>
            <strong>{t("orders.customer_note")}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--text-primary)" }}>{order.customerNotes}</p>
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>{t("ordersx.timeline")}</h3>
          <dl className={styles.timeline}>
            {timeline.map((row) => (
              <div key={row.label} style={{ display: "contents" }}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {proofs.length > 0 && (
        <section>
          <h3 className={styles.sectionTitle}>{t("ordersx.proofs")}</h3>
          <div className={styles.proofs}>
            {proofs.map((proof) => (
              <a key={proof.label} className={styles.proof} href={proof.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- driver uploads on an arbitrary CDN host */}
                <img src={proof.url} alt={proof.label} loading="lazy" />
                {proof.label}
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className={styles.sectionTitle}>{t("orders.items")}</h3>
        <div className={styles.items}>
          {(order.items || []).map((item, index) => (
            <div key={index} className={styles.item}>
              <div className={`${styles.itemQty} force-ltr`}>{item.quantity}x</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "4px", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>
                    {item.menuItem?.name || item.name || t("orders.item_fallback")}
                  </span>
                  <span className="force-ltr" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {money(item.subtotal || item.unitPrice || item.price || 0)}
                  </span>
                </div>
                {item.selectedOptions &&
                  Object.entries(item.selectedOptions).map(([key, value]) => (
                    <div key={key} className={styles.itemOption}>
                      {Array.isArray(value) ? value.join(", ") : String(value)}
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
      </section>
    </Modal>
  );
}

function DetailActions({
  order,
  pickup,
  busyPickup,
  onAction,
}: {
  order: RestaurantOrder;
  pickup?: PickupRequest;
  busyPickup: boolean;
  onAction: OrderActionHandler;
}) {
  const { t } = useI18n();

  if (order.status === "pending") {
    return (
      <div className={styles.footerActions}>
        <button type="button" className="btn-outline" style={{ color: "var(--error)", borderColor: "var(--error)" }} onClick={() => onAction("reject", order)}>
          {t("orders.reject")}
        </button>
        <button type="button" className="btn-primary" style={{ background: "var(--success)" }} onClick={() => onAction("accept", order)}>
          {t("orders.accept")}
        </button>
      </div>
    );
  }
  if (order.status === "confirmed") {
    if (!pickup) {
      return (
        <div className={styles.footerActions}>
          <button type="button" className="btn-primary" onClick={() => onAction("dispatch", order)}>
            {t("orders.dispatch")}
          </button>
        </div>
      );
    }
    return (
      <div className={styles.footerActions} style={{ alignItems: "center" }}>
        <span className="badge badge-info" style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}>
          {t(pickupStatusKey(pickup.status))}
        </span>
        {isPickupCancellable(pickup.status) && (
          <button
            type="button"
            className="btn-outline btn-sm"
            style={{ color: "var(--error)", flex: "0 0 auto" }}
            disabled={busyPickup}
            onClick={() => onAction("cancelPickup", order, pickup)}
          >
            {t("ordersx.cancel_pickup")}
          </button>
        )}
      </div>
    );
  }
  if (order.status === "out_for_delivery") {
    return (
      <div className={styles.footerActions}>
        <button type="button" className="btn-primary" onClick={() => onAction("track", order)}>
          <Navigation size={16} /> {t("orders.track_driver")}
        </button>
      </div>
    );
  }
  return null;
}
