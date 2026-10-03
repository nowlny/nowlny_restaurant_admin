"use client";

import React, { useId } from "react";
import type { StockSchedule } from "@/services/api/menu";
import { useI18n } from "@/lib/i18n";

/** Pick the stock schedule a dish or section follows, or none. */
export default function StockScheduleSelect({
  schedules,
  value,
  onChange,
  hint,
}: {
  schedules: StockSchedule[];
  value: string | null;
  onChange: (id: string | null) => void;
  hint?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {t("stock.schedule")}
      </label>
      <select
        id={id}
        className="form-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t("stock.no_schedule")}</option>
        {schedules.map((schedule) => (
          <option key={schedule.id} value={schedule.id}>
            {schedule.name}
          </option>
        ))}
      </select>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
