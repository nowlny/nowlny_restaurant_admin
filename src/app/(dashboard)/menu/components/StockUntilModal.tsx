"use client";

import React, { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy } from "@/components/ui/Feedback";
import type { MenuItem } from "@/services/api/menu";
import { useI18n } from "@/lib/i18n";
import { nextOccurrence, toHHmm } from "@/lib/stock";

/** Quick "out for…" choices, in hours. */
const PRESET_HOURS = [1, 2, 4];

/**
 * Out of stock until a time: a one-off that ends on its own. Only offered for a
 * dish that follows no schedule — the API refuses it otherwise (409).
 */
export default function StockUntilModal({
  item,
  onClose,
  onSubmit,
}: {
  item: MenuItem;
  onClose: () => void;
  /** Resolves true once saved; the modal then closes. */
  onSubmit: (until: Date) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const formId = useId();
  // Seeded once: the page mounts this fresh for each dish.
  const [time, setTime] = useState(() => toHHmm(new Date(Date.now() + 2 * 3600_000)));
  const [saving, setSaving] = useState(false);

  const submit = async (until: Date) => {
    setSaving(true);
    const ok = await onSubmit(until);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("stock.out_until_heading", { name: item.name })}
      maxWidth={420}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={saving || !time}>
            <Busy busy={saving} label={t("stock.set_until")} busyLabel={t("common.saving")} />
          </button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (time) void submit(nextOccurrence(time));
        }}
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        <div className="field">
          <span className="field-label">{t("stock.out_for")}</span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {PRESET_HOURS.map((hours) => (
              <button
                key={hours}
                type="button"
                className="btn-outline"
                disabled={saving}
                onClick={() => void submit(new Date(Date.now() + hours * 3600_000))}
                style={{ flex: "1 1 0" }}
              >
                {t("stock.hours", { count: hours })}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${formId}-time`} className="field-label">
            {t("stock.until_time")}
          </label>
          <input
            id={`${formId}-time`}
            type="time"
            className="form-input force-ltr"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          <p className="field-hint">{t("stock.until_hint")}</p>
        </div>
      </form>
    </Modal>
  );
}
