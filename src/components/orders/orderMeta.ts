import {
  CalendarClock,
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  Ban,
  type LucideIcon,
} from "lucide-react";
import type {
  OrderAddress,
  OrderStatus,
  PickupRequestStatus,
  RestaurantOrder,
} from "@/services/api/orders";
import { intlLocale, type Locale, type MessageKey } from "@/lib/i18n";
import { formatMoney as formatAppMoney, type CurrencyLike } from "@/lib/money";

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Badge tone → `.badge-*` class and the matching token for borders/icons. */
export type Tone = "warning" | "info" | "accent-2" | "success" | "error" | "neutral";

export const TONE_COLOR: Record<Tone, string> = {
  warning: "var(--warning)",
  info: "var(--info)",
  "accent-2": "var(--accent-2)",
  success: "var(--success)",
  error: "var(--error)",
  neutral: "var(--text-secondary)",
};

export const TONE_BG: Record<Tone, string> = {
  warning: "var(--warning-bg)",
  info: "var(--info-bg)",
  "accent-2": "var(--accent-2-bg)",
  success: "var(--success-bg)",
  error: "var(--error-bg)",
  neutral: "var(--bg-elevated)",
};

export const badgeClass = (tone: Tone) =>
  tone === "neutral" ? "badge" : `badge badge-${tone}`;

interface StatusMeta {
  label: MessageKey;
  tone: Tone;
  icon: LucideIcon;
}

const STATUS_META: Record<OrderStatus, StatusMeta> = {
  scheduled: { label: "ordersx.status_scheduled", tone: "neutral", icon: CalendarClock },
  pending: { label: "order_status.pending", tone: "warning", icon: Clock },
  confirmed: { label: "order_status.confirmed", tone: "info", icon: CheckCircle2 },
  out_for_delivery: { label: "order_status.out_for_delivery", tone: "accent-2", icon: Truck },
  delivered: { label: "order_status.delivered", tone: "success", icon: PackageCheck },
  cancelled: { label: "order_status.cancelled", tone: "error", icon: Ban },
  rejected: { label: "order_status.rejected", tone: "error", icon: Ban },
};

/** Never throws: a status this client doesn't know yet renders as a neutral badge. */
export function statusMeta(status: string | null | undefined): StatusMeta | null {
  return status && Object.prototype.hasOwnProperty.call(STATUS_META, status)
    ? STATUS_META[status as OrderStatus]
    : null;
}

export function statusLabel(t: Translate, status: string | null | undefined): string {
  const meta = statusMeta(status);
  return meta ? t(meta.label) : status || t("common.unknown");
}

export const statusTone = (status: string | null | undefined): Tone =>
  statusMeta(status)?.tone ?? "neutral";

const PAYMENT_METHOD_KEYS: Record<string, MessageKey> = {
  cash: "ordersx.pay_cash",
  card: "ordersx.pay_card",
  wallet: "ordersx.pay_wallet",
};

const PAYMENT_STATUS_KEYS: Record<string, MessageKey> = {
  pending: "ordersx.paystatus_pending",
  paid: "ordersx.paystatus_paid",
  failed: "ordersx.paystatus_failed",
};

export function paymentMethodLabel(t: Translate, method: string | null | undefined) {
  if (!method) return t("ordersx.pay_cash");
  const key = PAYMENT_METHOD_KEYS[method.toLowerCase()];
  return key ? t(key) : method;
}

export function paymentStatusLabel(t: Translate, status: string | null | undefined) {
  if (!status) return t("common.unknown");
  const key = PAYMENT_STATUS_KEYS[status.toLowerCase()];
  return key ? t(key) : status;
}

export const paymentStatusTone = (status: string | null | undefined): Tone =>
  status === "paid" ? "success" : status === "failed" ? "error" : "warning";

/** Same code on the card, the drawer and the dispatch modal. */
export const orderCode = (order: Pick<RestaurantOrder, "id" | "orderNumber">) =>
  order.orderNumber || `#${order.id?.slice(-6).toUpperCase() || "—"}`;

/** Pickup states during which the partner still owns the handoff. */
export const ACTIVE_PICKUP_STATUSES: readonly PickupRequestStatus[] = [
  "pending",
  "accepted",
  "driver_assigned",
  "picked_up",
];

/** The backend only lets the restaurant cancel before the partner collects. */
export const isPickupCancellable = (status: PickupRequestStatus) =>
  status === "pending" || status === "accepted" || status === "driver_assigned";

export const pickupStatusKey = (status: PickupRequestStatus): MessageKey =>
  status === "driver_assigned"
    ? "orders.partner_driver_assigned"
    : status === "accepted"
      ? "orders.pickup_accepted"
      : status === "picked_up"
        ? "ordersx.pickup_picked_up"
        : "orders.waiting_for_partner";

/**
 * Order amounts in the order's currency. Delegates to the app-wide rule in
 * lib/money.ts: this used to default a missing currency to USD and print
 * lira with two decimals ("LBP 750,000.00").
 */
export function formatMoney(
  locale: Locale,
  value: number | string | null | undefined,
  currency: CurrencyLike,
) {
  return formatAppMoney(value, currency, locale);
}

export const orderTotal = (order: RestaurantOrder) =>
  order.total ?? order.totalAmount ?? 0;

/**
 * The bill a cash customer will hand over (`changeFor`), as a line for staff:
 * "Pays with 100 — bring 23.50 change". Null when there is nothing to show
 * (not cash, or the customer chose "no need").
 */
export function cashChangeText(
  t: Translate,
  locale: Locale,
  order: RestaurantOrder,
  currency: CurrencyLike,
) {
  if (order.paymentMethod && order.paymentMethod.toLowerCase() !== "cash") return null;
  const bill = Number(order.changeFor);
  if (!Number.isFinite(bill) || bill <= 0) return null;
  const total = Number(orderTotal(order));
  const billText = formatMoney(locale, bill, currency);
  if (Number.isFinite(total) && total > 0 && bill > total) {
    return t("ordersx.change_for_due", {
      bill: billText,
      change: formatMoney(locale, bill - total, currency),
    });
  }
  return t("ordersx.change_for", { bill: billText });
}

export function formatClock(locale: Locale, iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

/** Clock time for today, date + time otherwise (scheduled orders can be days out). */
export function formatWhen(locale: Locale, iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? formatClock(locale, iso)
    : date.toLocaleString(intlLocale(locale), {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function addressText(
  t: Translate,
  address: OrderAddress | string | null | undefined,
  masked = false,
) {
  if (!address) return "";
  if (typeof address === "string") return masked ? "****" : address;
  if (masked) return `${address.city || t("orders.address_unknown_city")}, ****`;
  const parts: string[] = [];
  if (address.building) parts.push(t("orders.address_building", { value: address.building }));
  if (address.floor) parts.push(t("orders.address_floor", { value: address.floor }));
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  return parts.join(", ") || t("orders.address_on_map");
}

export function mapQuery(t: Translate, address: OrderAddress | string | null | undefined) {
  if (!address) return "";
  if (typeof address === "string") return address;
  if (address.latitude && address.longitude) return `${address.latitude},${address.longitude}`;
  return addressText(t, address);
}

/** Pending orders hide customer identity until accepted. */
export const maskName = (name: string, masked: boolean) =>
  !name ? "" : masked ? `${name.substring(0, 3)}****` : name;

export const maskPhone = (phone: string, masked: boolean) =>
  !phone ? "" : masked ? `${phone.substring(0, 5)}****` : phone;
