"use client";

import { Inbox, Loader2, RefreshCw } from "lucide-react";
import type { RestaurantOrder } from "@/services/api/orders";
import { useI18n } from "@/lib/i18n";
import OrderCard, { type OrderActionHandler } from "./OrderCard";
import styles from "./orders.module.css";

type CurrencyLike = { code?: string; symbol?: string | null } | null | undefined;

/** Flat card grid for the scheduled and closed views — no actions, tap for details. */
export default function OrderList({
  orders,
  loading = false,
  error,
  hint,
  emptyText,
  onRefresh,
  selectedId,
  fallbackCurrency,
  onAction,
}: {
  orders: RestaurantOrder[];
  loading?: boolean;
  error?: string | null;
  hint?: string;
  emptyText: string;
  onRefresh?: () => void;
  selectedId: string | null;
  fallbackCurrency?: CurrencyLike;
  onAction: OrderActionHandler;
}) {
  const { t } = useI18n();

  return (
    <>
      {(hint || onRefresh) && (
        <div className={styles.listToolbar}>
          <span>{hint}</span>
          {onRefresh && (
            <button type="button" className="btn-outline btn-sm" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t("ordersx.refresh")}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {loading && orders.length === 0 ? (
        <div className={styles.list} aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="skeleton" style={{ height: "120px" }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <Inbox size={28} aria-hidden />
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              variant="list"
              selected={selectedId === order.id}
              fallbackCurrency={fallbackCurrency}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </>
  );
}
