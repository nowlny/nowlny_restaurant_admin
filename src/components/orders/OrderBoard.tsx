"use client";

import { useState, type CSSProperties } from "react";
import { Inbox } from "lucide-react";
import type { PickupRequest, RestaurantOrder } from "@/services/api/orders";
import { useI18n } from "@/lib/i18n";
import OrderCard, { type OrderActionHandler } from "./OrderCard";
import { TONE_COLOR, statusLabel, statusMeta } from "./orderMeta";
import styles from "./orders.module.css";

export const BOARD_STATUSES = [
  "pending",
  "confirmed",
  "out_for_delivery",
  "delivered",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type BoardBuckets = Record<BoardStatus, RestaurantOrder[]>;

type CurrencyLike = { code?: string; symbol?: string | null } | null | undefined;

interface OrderBoardProps {
  buckets: BoardBuckets;
  pickupByOrderId: Map<string, PickupRequest>;
  freshIds: ReadonlySet<string>;
  selectedId: string | null;
  busyPickupId: string | null;
  fallbackCurrency?: CurrencyLike;
  onAction: OrderActionHandler;
}

/** Four status columns on desktop; one column at a time behind pill tabs on phones. */
export default function OrderBoard({
  buckets,
  pickupByOrderId,
  freshIds,
  selectedId,
  busyPickupId,
  fallbackCurrency,
  onAction,
}: OrderBoardProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<BoardStatus>("pending");
  const freshCount = buckets.pending.reduce(
    (count, order) => count + (freshIds.has(order.id) ? 1 : 0),
    0,
  );

  return (
    <>
      <div
        className={`mobile-only ${styles.mobileTabs}`}
        role="group"
        aria-label={t("ordersx.status_tabs")}
        style={{ display: "none" }}
      >
        {BOARD_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={styles.mobileTab}
            aria-pressed={activeTab === status}
            onClick={() => setActiveTab(status)}
            style={{ "--tone": TONE_COLOR[statusMeta(status)!.tone] } as CSSProperties}
          >
            {statusLabel(t, status)} ({buckets[status].length})
            {status === "pending" && freshCount > 0 && (
              <span className={styles.countPill}>{freshCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className={`kanban-grid ${styles.board}`}>
        {BOARD_STATUSES.map((status) => {
          const meta = statusMeta(status)!;
          const Icon = meta.icon;
          const orders = buckets[status];
          return (
            <section
              key={status}
              aria-labelledby={`orders-col-${status}`}
              className={`kanban-column ${styles.column} ${activeTab === status ? "active-mobile-tab" : ""}`}
              style={{ "--tone": TONE_COLOR[meta.tone] } as CSSProperties}
            >
              <div className={styles.columnHeader}>
                <h2 id={`orders-col-${status}`} className={styles.columnTitle}>
                  <Icon size={18} aria-hidden />
                  {statusLabel(t, status)}
                  {status === "pending" && freshCount > 0 && (
                    <span className="badge badge-accent">
                      {t("ordersx.new_count", { count: freshCount })}
                    </span>
                  )}
                </h2>
                <span className={styles.columnCount}>{orders.length}</span>
              </div>
              <div
                className={`${styles.columnBody} ${status === "delivered" ? styles.columnBodyMuted : ""}`}
              >
                {orders.length === 0 ? (
                  <div className={styles.columnEmpty}>
                    <Inbox size={22} aria-hidden />
                    {t("ordersx.empty_column")}
                  </div>
                ) : (
                  orders.map((order) => {
                    const pickup = pickupByOrderId.get(order.id);
                    return (
                      <OrderCard
                        key={order.id}
                        order={order}
                        pickup={pickup}
                        selected={selectedId === order.id}
                        fresh={freshIds.has(order.id)}
                        busy={pickup !== undefined && busyPickupId === pickup.id}
                        fallbackCurrency={fallbackCurrency}
                        onAction={onAction}
                      />
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
