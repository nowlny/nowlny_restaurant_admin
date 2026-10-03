"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, UserRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import {
  OrdersService,
  type DeliveryIntegration,
  type PickupRequest,
  type RestaurantDriver,
  type RestaurantOrder,
} from "@/services/api/orders";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { orderCode } from "./orderMeta";
import styles from "./orders.module.css";

export type DispatchResult =
  | { kind: "driver"; order: RestaurantOrder }
  | { kind: "partner"; pickup: PickupRequest };

/** Choose between the restaurant's own fleet and the connected delivery partner. */
export default function DispatchModal({
  order,
  onClose,
  onDispatched,
}: {
  order: RestaurantOrder;
  onClose: () => void;
  onDispatched: (result: DispatchResult) => void;
}) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [drivers, setDrivers] = useState<RestaurantDriver[]>([]);
  const [integration, setIntegration] = useState<DeliveryIntegration | null>(null);
  const [driverId, setDriverId] = useState("");
  const [busy, setBusy] = useState<"driver" | "partner" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      OrdersService.getDrivers(),
      OrdersService.getDeliveryIntegration(),
    ]).then(([driverResult, integrationResult]) => {
      if (cancelled) return;
      const active = driverResult.status === "fulfilled" ? driverResult.value : [];
      setDrivers(active);
      setIntegration(integrationResult.status === "fulfilled" ? integrationResult.value : null);
      setDriverId(active.find((driver) => driver.isAvailable)?.id ?? "");
      setOptionsFailed(
        driverResult.status === "rejected" && integrationResult.status === "rejected",
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dispatchOwnDriver = async () => {
    if (!driverId) return;
    setBusy("driver");
    try {
      await OrdersService.assignDriver(order.id, driverId);
      await OrdersService.markOutForDelivery(order.id);
      const driver = drivers.find((candidate) => candidate.id === driverId);
      toast.success(t("dispatch.driver_assigned_success"));
      onDispatched({
        kind: "driver",
        order: {
          ...order,
          status: "out_for_delivery",
          outForDeliveryAt: new Date().toISOString(),
          driver: driver
            ? {
                id: driver.id,
                fullName: driver.fullName,
                phoneNumber: driver.phoneNumber,
                status: driver.status,
                vehicleType: driver.vehicleType,
                vehiclePlate: driver.vehiclePlate,
                lastLatitude: null,
                lastLongitude: null,
                lastLocationAt: null,
              }
            : order.driver,
        },
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("dispatch.driver_assign_failed")));
      setBusy(null);
    }
  };

  const dispatchPartner = async () => {
    const company = integration?.company;
    if (integration?.status !== "accepted" || !company) return;
    setBusy("partner");
    try {
      const pickup = await OrdersService.requestPickup(order.id, company.id);
      toast.success(t("dispatch.pickup_requested", { company: company.name }));
      onDispatched({ kind: "partner", pickup });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("dispatch.pickup_failed")));
      setBusy(null);
    }
  };

  return (
    <Modal
      open
      stacked
      onClose={onClose}
      dismissible={busy === null}
      maxWidth={560}
      title={t("dispatch.title")}
    >
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
        <span className="force-ltr">{orderCode(order)}</span>
      </p>

      {optionsFailed && (
        <div className="notice notice-error" role="alert">
          {t("dispatch.options_failed")}
        </div>
      )}

      {loading ? (
        <div style={{ minHeight: "180px", display: "grid", placeItems: "center" }}>
          <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
        </div>
      ) : (
        <>
          <section className={styles.dispatchSection}>
            <div className={styles.dispatchHead}>
              <UserRound size={20} color="var(--accent-primary)" aria-hidden />
              <div>
                <strong>{t("dispatch.own_driver")}</strong>
                <p className={styles.dispatchHint}>{t("dispatch.own_driver_hint")}</p>
              </div>
            </div>
            {drivers.length > 0 ? (
              <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }} className="flex-col-mobile">
                <select
                  className="form-input"
                  aria-label={t("dispatch.driver_select_label")}
                  value={driverId}
                  onChange={(event) => setDriverId(event.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">{t("dispatch.driver_select_placeholder")}</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id} disabled={!driver.isAvailable}>
                      {driver.fullName || driver.phoneNumber}
                      {driver.isAvailable ? "" : t("dispatch.driver_off_shift")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!driverId || busy !== null}
                  onClick={() => void dispatchOwnDriver()}
                >
                  <Busy busy={busy === "driver"} label={t("dispatch.assign_and_send")} />
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
                {t("dispatch.no_drivers")}
              </p>
            )}
          </section>

          <section className={styles.dispatchSection}>
            <div className={styles.dispatchHead}>
              <Building2 size={20} color="var(--info)" aria-hidden />
              <div>
                <strong>{t("dispatch.partner")}</strong>
                <p className={styles.dispatchHint}>{t("dispatch.partner_hint")}</p>
              </div>
            </div>
            {integration?.status === "accepted" && integration.company ? (
              <button
                type="button"
                className="btn-outline"
                style={{ width: "100%" }}
                disabled={busy !== null}
                onClick={() => void dispatchPartner()}
              >
                <Busy
                  busy={busy === "partner"}
                  label={t("dispatch.request_pickup", { company: integration.company.name })}
                />
              </button>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
                {integration?.status === "pending"
                  ? t("dispatch.partner_pending")
                  : t("dispatch.partner_none")}
              </p>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
