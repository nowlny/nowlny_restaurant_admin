"use client";

import React from "react";
import { CalendarClock, Clock, Edit2, ListPlus, Trash2, UtensilsCrossed } from "lucide-react";
import SortHandle from "@/components/menu/SortHandle";
import type { MenuItem, StockSchedule } from "@/services/api/menu";
import { useI18n } from "@/lib/i18n";
import { stockStatusText } from "@/lib/stock";
import { useMenuMoney } from "@/lib/menuMoney";

/** The sale price, when there is a real one (lower than the regular price). */
const salePrice = (item: MenuItem): number | null => {
  const price = Number(item.price);
  const discounted = Number(item.discountedPrice);
  return Number.isFinite(discounted) && discounted > 0 && discounted < price ? discounted : null;
};

/**
 * In / out of stock, one tap from the dish list.
 *
 * Running out of something mid-service used to mean opening the edit form,
 * finding the checkbox and saving the whole dish again.
 */
function StockSwitch({
  checked,
  pending,
  name,
  onToggle,
}: {
  checked: boolean;
  pending: boolean;
  name: string;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={t("menu.stock_toggle_aria", { name })}
      disabled={pending}
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        paddingBlock: "4px",
        paddingInlineStart: "4px",
        paddingInlineEnd: "10px",
        borderRadius: "999px",
        border: "1px solid var(--border-color)",
        background: checked ? "var(--success-bg)" : "var(--bg-sunken)",
        color: checked ? "var(--success)" : "var(--text-secondary)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.7 : 1,
        whiteSpace: "nowrap",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          width: "28px",
          height: "16px",
          borderRadius: "999px",
          background: checked ? "var(--success)" : "var(--text-muted)",
          flexShrink: 0,
          transition: "background-color 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            insetInlineStart: checked ? "14px" : "2px",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "var(--bg-surface)",
            transition: "inset-inline-start 0.2s ease",
          }}
        />
      </span>
      {checked ? t("menu.in_stock") : t("menu.out_of_stock")}
    </button>
  );
}

export default function MenuItemCard({
  item,
  sortDisabled,
  sortDisabledHint,
  dragClassName,
  stockPending,
  onEdit,
  onOptions,
  onDelete,
  onToggleStock,
  onStockUntil,
  schedule,
  onDragStart,
  onDragEnd,
  onMove,
  dropHandlers,
}: {
  item: MenuItem;
  sortDisabled: boolean;
  sortDisabledHint?: string;
  /** `is-dragging` / `drop-before` / `drop-after`, decided by the page. */
  dragClassName: string;
  stockPending: boolean;
  onEdit: () => void;
  onOptions: () => void;
  onDelete: () => void;
  onToggleStock: () => void;
  /** Opens "out of stock until…" (a one-off). */
  onStockUntil: () => void;
  /** The schedule the dish follows — its own, or its section's. */
  schedule?: StockSchedule;
  onDragStart: (e: React.DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
  onMove: (delta: -1 | 1) => void;
  dropHandlers: Pick<React.HTMLAttributes<HTMLDivElement>, "onDragOver" | "onDragLeave" | "onDrop">;
}) {
  const { t, locale } = useI18n();
  const money = useMenuMoney();
  const sale = salePrice(item);
  const stockStatus = stockStatusText(item, locale);
  const available = item.isAvailable !== false;
  const hidden = item.isActive === false;

  return (
    <div
      data-drag-card
      className={dragClassName}
      {...dropHandlers}
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        padding: "12px",
        display: "flex",
        gap: "10px",
        backgroundColor: "var(--bg-elevated)",
        minWidth: 0,
      }}
    >
      <SortHandle
        label={item.name}
        disabled={sortDisabled}
        disabledHint={sortDisabledHint}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMove={onMove}
      />

      <div
        style={{
          width: "72px",
          height: "72px",
          flexShrink: 0,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          backgroundColor: "var(--bg-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          // Out of stock reads at a glance, without hunting for the switch.
          opacity: available && !hidden ? 1 : 0.5,
        }}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- hosted on the API's CDN, not a Next image domain
          <img
            src={item.image}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          // Same placeholder as the customer app: never a stock photo, which
          // reads as the dish itself.
          <UtensilsCrossed size={22} aria-hidden />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", flexWrap: "wrap" }}>
          <h4 style={{ fontWeight: 600, margin: 0, flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>
            {item.name}
          </h4>
          {hidden && <span className="badge">{t("menu.badge_hidden")}</span>}
          {item.isPopular && <span className="badge badge-accent">{t("menu.popular")}</span>}
        </div>

        {item.description && (
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "13px",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </p>
        )}

        <div className="force-ltr" style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{money.format(sale ?? item.price)}</span>
          {sale !== null && (
            <span style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "line-through" }}>
              {money.format(item.price)}
            </span>
          )}
          {/* The converted price customers see under each dish in the app. */}
          {money.secondary(sale ?? item.price) && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {money.secondary(sale ?? item.price)}
            </span>
          )}
        </div>

        {stockStatus && (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--error)" }}>{stockStatus}</p>
        )}
        {schedule && (
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--accent-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CalendarClock size={12} aria-hidden />
            {item.stockScheduleId ? schedule.name : t("stock.section_schedule", { name: schedule.name })}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
          <StockSwitch checked={available} pending={stockPending} name={item.name} onToggle={onToggleStock} />
          {/* A dish on a schedule takes no one-off: the API answers 409. */}
          {available && !schedule && (
            <button
              type="button"
              className="icon-btn"
              onClick={onStockUntil}
              disabled={stockPending}
              aria-label={t("stock.out_until_aria", { name: item.name })}
              title={t("stock.out_until_title")}
            >
              <Clock size={16} />
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="icon-btn"
            onClick={onEdit}
            aria-label={t("menu.edit_item_aria", { name: item.name })}
            title={t("common.edit")}
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOptions}
            aria-label={t("menu.options_aria", { name: item.name })}
            title={t("menu.options")}
          >
            <ListPlus size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={onDelete}
            aria-label={t("menu.delete_item_aria", { name: item.name })}
            title={t("common.delete")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
