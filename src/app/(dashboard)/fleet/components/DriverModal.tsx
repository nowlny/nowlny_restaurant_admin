"use client";

import { useEffect, useId, useState } from "react";
import { Info, Trash2, User } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { FleetService, type DriverStatus, type FleetDriver } from "@/services/api/fleet";
import { getApiErrorMessage } from "@/services/api/errors";
import { intlLocale, useI18n } from "@/lib/i18n";
import styles from "./fleet.module.css";
import { driverName, vehicleLabel } from "./fleetMeta";

/**
 * View one driver and switch them between active and inactive.
 *
 * `UpdateDriverDto` carries only `status`: name, vehicle and plate are the
 * driver's own profile, so they are shown here but not editable.
 */
export default function DriverModal({
  driver: initial,
  removing,
  onClose,
  onUpdated,
  onRemove,
}: {
  driver: FleetDriver;
  removing: boolean;
  onClose: () => void;
  onUpdated: (driver: FleetDriver) => void;
  onRemove: (driver: FleetDriver) => void;
}) {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const [driver, setDriver] = useState(initial);
  const [stale, setStale] = useState(false);
  const [status, setStatus] = useState<DriverStatus>(initial.status);
  const [saving, setSaving] = useState(false);
  const statusLabelId = useId();

  // The row may be minutes old; fetch the current record behind it.
  useEffect(() => {
    let cancelled = false;
    FleetService.getDriver(initial.id)
      .then((fresh) => {
        if (cancelled) return;
        setDriver(fresh);
        setStatus(fresh.status);
      })
      .catch((err: unknown) => {
        console.error("Failed to refresh driver", err);
        if (!cancelled) setStale(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  const busy = saving || removing;
  const dirty = status !== driver.status;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await FleetService.updateDriverStatus(driver.id, status);
      // Some deployments answer the PATCH with a partial body; keep what we know.
      const merged = { ...driver, ...updated, status };
      setDriver(merged);
      onUpdated(merged);
      toast.success(t("fleet.updated"));
      onClose();
    } catch (err) {
      console.error("Failed to update driver", err);
      toast.error(getApiErrorMessage(err, t("fleet.update_failed")));
    } finally {
      setSaving(false);
    }
  };

  const joined = driver.createdAt ? new Date(driver.createdAt) : null;
  const rating =
    typeof driver.rating === "number" && driver.totalRatings
      ? t("fleet.rating_value", {
          rating: driver.rating.toFixed(1),
          count: driver.totalRatings,
        })
      : t("fleet.no_ratings");

  const options: { value: DriverStatus; label: string; hint: string }[] = [
    { value: "active", label: t("fleet.status_active"), hint: t("fleet.status_active_hint") },
    { value: "inactive", label: t("fleet.status_inactive"), hint: t("fleet.status_inactive_hint") },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t("fleet.details_title")}
      maxWidth={520}
      dismissible={!busy}
      footer={
        <>
          <button
            type="button"
            className={`btn-outline ${styles.footerSpacer}`}
            style={{ color: "var(--error)" }}
            onClick={() => onRemove(driver)}
            disabled={busy}
          >
            <Busy busy={removing} label={<><Trash2 size={18} aria-hidden="true" /> {t("fleet.remove_confirm")}</>} busyLabel={t("common.deleting")} />
          </button>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={busy || !dirty}>
            <Busy busy={saving} label={t("common.save")} busyLabel={t("common.saving")} />
          </button>
        </>
      }
    >
      <div className={styles.sheet}>
        {stale && (
          <div className="notice notice-warning" role="status">
            <Info size={18} aria-hidden="true" />
            <span>{t("fleet.details_stale")}</span>
          </div>
        )}

        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            <User size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3>{driverName(driver, t)}</h3>
            <span className={`badge ${driver.status === "active" ? "badge-success" : ""}`}>
              {driver.status === "active" ? t("fleet.status_active") : t("fleet.status_inactive")}
            </span>
          </div>
        </div>

        <dl className={styles.facts}>
          <div>
            <dt>{t("fleet.phone")}</dt>
            <dd className="force-ltr">{driver.phoneNumber || "—"}</dd>
          </div>
          <div>
            <dt>{t("fleet.vehicle")}</dt>
            <dd>{vehicleLabel(driver, t)}</dd>
          </div>
          <div>
            <dt>{t("fleet.plate")}</dt>
            <dd className="force-ltr">{driver.vehiclePlate || t("fleet.no_plate")}</dd>
          </div>
          <div>
            <dt>{t("fleet.rating")}</dt>
            <dd>{rating}</dd>
          </div>
          {typeof driver.isAvailable === "boolean" && (
            <div>
              <dt>{t("fleet.availability")}</dt>
              <dd>{driver.isAvailable ? t("fleet.available") : t("fleet.unavailable")}</dd>
            </div>
          )}
          {joined && !Number.isNaN(joined.getTime()) && (
            <div>
              <dt>{t("fleet.joined")}</dt>
              <dd>{joined.toLocaleDateString(intlLocale(locale), { dateStyle: "medium" })}</dd>
            </div>
          )}
        </dl>

        <p className="field-hint">{t("fleet.profile_note")}</p>

        <div className="field">
          <span className="field-label" id={statusLabelId}>
            {t("fleet.status_label")}
          </span>
          <div className={styles.statusOptions} role="radiogroup" aria-labelledby={statusLabelId}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                className={styles.statusOption}
                onClick={() => setStatus(option.value)}
                disabled={busy}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
