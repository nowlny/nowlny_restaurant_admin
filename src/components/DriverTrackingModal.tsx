"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Radio,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { orderCode, statusLabel } from "@/components/orders/orderMeta";
import {
  createDeliveryTrackingSocket,
  DriverLocation,
} from "@/services/api/deliveryTracking";
import {
  isOrderStatus,
  OrderAddress,
  OrderStatus,
  RestaurantOrder,
} from "@/services/api/orders";
import { intlLocale, useI18n, type Locale, type MessageKey } from "@/lib/i18n";

/**
 * Socket errors are held as a key plus the server's own wording: the socket
 * effect runs once per order and must not close over `t`, which is a new
 * function on every render.
 */
type TrackingNotice = { key: MessageKey; text?: string } | null;

const DriverTrackingMap = dynamic(() => import("@/components/DriverTrackingMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "360px",
        display: "grid",
        placeItems: "center",
        borderRadius: "14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
      }}
    >
      <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
    </div>
  ),
});

type ConnectionState = "connecting" | "live" | "reconnecting" | "error";

interface DriverTrackingModalProps {
  order: RestaurantOrder;
  onClose: () => void;
  onOrderStatus: (orderId: string, status: OrderStatus) => void;
}

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? parsed
    : null;
};

const toPoint = (address: OrderAddress | string | null | undefined) => {
  if (!address || typeof address === "string") return null;
  const latitude = toNumber(address.latitude);
  const longitude = toNumber(address.longitude);
  return latitude == null || longitude == null ? null : { latitude, longitude };
};

const seedDriverLocation = (order: RestaurantOrder): DriverLocation | null => {
  const latitude = toNumber(order.driver?.lastLatitude);
  const longitude = toNumber(order.driver?.lastLongitude);
  if (latitude == null || longitude == null || !order.driver) return null;
  return {
    orderId: order.id,
    driverId: order.driver.id,
    latitude,
    longitude,
    heading: null,
    timestamp: order.driver.lastLocationAt ?? null,
  };
};

function formatLastSeen(
  timestamp: string | null,
  now: number,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  locale: Locale,
) {
  if (!timestamp) return t("tracking.waiting_first_fix");
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(timestamp).getTime()) / 1_000),
  );
  if (!Number.isFinite(elapsedSeconds)) return t("tracking.time_unavailable");
  if (elapsedSeconds < 15) return t("tracking.updated_now");
  if (elapsedSeconds < 60)
    return t("tracking.updated_seconds", { count: elapsedSeconds });
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes === 1) return t("tracking.updated_minute");
  if (minutes < 60) return t("tracking.updated_minutes", { count: minutes });
  return t("tracking.last_update", {
    time: new Date(timestamp).toLocaleString(intlLocale(locale)),
  });
}

export default function DriverTrackingModal({
  order,
  onClose,
  onOrderStatus,
}: DriverTrackingModalProps) {
  const { t, locale } = useI18n();
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    () => seedDriverLocation(order),
  );
  const [liveStatus, setLiveStatus] = useState<OrderStatus>(order.status);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [trackingError, setTrackingError] = useState<TrackingNotice>(null);
  const [now, setNow] = useState(() => Date.now());

  const destination = useMemo(
    () => toPoint(order.deliveryAddress),
    [order.deliveryAddress],
  );
  const restaurant = useMemo(
    () => toPoint(order.restaurant?.address),
    [order.restaurant?.address],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: ReturnType<typeof createDeliveryTrackingSocket> | null = null;

    try {
      socket = createDeliveryTrackingSocket();
      const activeSocket = socket;

      const subscribe = () => {
        setConnectionState("connecting");
        setTrackingError(null);
        activeSocket.emit("track", { orderId: order.id }, (acknowledgement) => {
          if (disposed) return;
          if (acknowledgement?.error) {
            setConnectionState("error");
            setTrackingError({
              key: "tracking.error_unavailable",
              text: acknowledgement.error,
            });
            return;
          }
          setConnectionState("live");
          if (isOrderStatus(acknowledgement?.status)) {
            setLiveStatus(acknowledgement.status);
            onOrderStatus(order.id, acknowledgement.status);
          }
        });
      };

      activeSocket.on("connect", subscribe);
      activeSocket.on("driver.location", (payload) => {
        if (payload.orderId !== order.id) return;
        setDriverLocation(payload);
        setNow(Date.now());
        setConnectionState("live");
      });
      activeSocket.on("order.status", (payload) => {
        if (payload.orderId !== order.id || !isOrderStatus(payload.status)) return;
        setLiveStatus(payload.status);
        onOrderStatus(order.id, payload.status);
      });
      activeSocket.on("error", (payload) => {
        const message = typeof payload === "string" ? payload : payload?.message;
        setConnectionState("error");
        setTrackingError({ key: "tracking.error_unavailable", text: message });
      });
      activeSocket.on("connect_error", (error) => {
        setConnectionState("reconnecting");
        setTrackingError({
          key: "tracking.error_reconnecting",
          text: error.message,
        });
      });
      activeSocket.on("disconnect", () => {
        if (!disposed) setConnectionState("reconnecting");
      });
      activeSocket.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      queueMicrotask(() => {
        if (disposed) return;
        setConnectionState("error");
        setTrackingError({ key: "tracking.error_unavailable", text: message });
      });
    }

    return () => {
      disposed = true;
      if (socket) {
        if (socket.connected) socket.emit("untrack", { orderId: order.id });
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [onOrderStatus, order.id]);

  const hasMapPoint = Boolean(driverLocation || destination || restaurant);
  const timestamp = driverLocation?.timestamp ?? null;
  const locationAge = timestamp ? now - new Date(timestamp).getTime() : Infinity;
  const isFresh = Number.isFinite(locationAge) && locationAge < 120_000;
  const driver = order.driver;
  const trackingErrorText = trackingError
    ? trackingError.text || t(trackingError.key)
    : "";
  const connectionLabel =
    connectionState === "live"
      ? isFresh
        ? t("tracking.live")
        : t("tracking.connected")
      : connectionState === "reconnecting"
        ? t("tracking.reconnecting")
        : connectionState === "error"
          ? t("tracking.unavailable")
          : t("tracking.connecting");

  return (
    <Modal open stacked onClose={onClose} maxWidth={860} title={t("tracking.title")}>
      <div>
        <p style={{ margin: "0 0 4px", color: "var(--text-muted)", fontSize: "12px" }}>
          <span className="force-ltr">{orderCode(order)}</span>
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              color:
                connectionState === "error"
                  ? "var(--error)"
                  : connectionState === "live"
                    ? "var(--success)"
                    : "var(--warning)",
              background:
                connectionState === "error"
                  ? "var(--error-bg)"
                  : connectionState === "live"
                    ? "var(--success-bg)"
                    : "var(--warning-bg)",
            }}
          >
            {connectionState === "connecting" || connectionState === "reconnecting" ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <Radio size={13} />
            )}
            {connectionLabel}
          </span>
          <span
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--accent-2)",
              background: "var(--accent-2-bg)",
            }}
          >
            {statusLabel(t, liveStatus)}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              color: "var(--text-secondary)",
              fontSize: "12px",
            }}
          >
            <Clock3 size={13} /> {formatLastSeen(timestamp, now, t, locale)}
          </span>
        </div>

        {trackingErrorText && (
          <div role="alert" className="notice notice-error" style={{ marginBottom: "16px" }}>
            {trackingErrorText}
          </div>
        )}

        {hasMapPoint ? (
          <DriverTrackingMap
            driver={driverLocation}
            destination={destination}
            restaurant={restaurant}
            restaurantLogo={order.restaurant?.logo ?? null}
          />
        ) : (
          <div
            style={{
              minHeight: "260px",
              display: "grid",
              placeItems: "center",
              padding: "24px",
              textAlign: "center",
              borderRadius: "14px",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div>
              <MapPin size={30} style={{ marginBottom: "10px" }} />
              <p style={{ margin: 0, fontWeight: 700 }}>{t("tracking.waiting_title")}</p>
              <p style={{ margin: "5px 0 0", fontSize: "13px" }}>
                {t("tracking.waiting_body")}
              </p>
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", gap: "9px", alignItems: "center" }}>
              <Bike size={18} color="var(--accent-primary)" />
              <div>
                <p style={{ margin: 0, fontWeight: 750 }}>
                  {driver?.fullName || t("tracking.assigned_driver")}
                </p>
                <p style={{ margin: "3px 0 0", color: "var(--text-secondary)", fontSize: "12px" }}>
                  {[driver?.vehicleType, driver?.vehiclePlate].filter(Boolean).join(" · ") ||
                    t("tracking.vehicle_unavailable")}
                </p>
              </div>
            </div>
            {driver?.phoneNumber && (
              <a
                href={`tel:${driver.phoneNumber}`}
                style={{
                  marginTop: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--accent-primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <Phone size={14} /> {t("tracking.call_driver")}
              </a>
            )}
          </div>

          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
              <Navigation size={18} color="var(--success)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 750 }}>{t("tracking.destination")}</p>
                <p style={{ margin: "3px 0 0", color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.45 }}>
                  {typeof order.deliveryAddress === "string"
                    ? order.deliveryAddress
                    : [
                        order.deliveryAddress?.building,
                        order.deliveryAddress?.street,
                        order.deliveryAddress?.city,
                      ]
                        .filter(Boolean)
                        .join(", ") || t("tracking.destination_unavailable")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
