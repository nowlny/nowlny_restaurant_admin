"use client";

import React, { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import {
  MenuService,
  WEEK_DAYS,
  type MenuItem,
  type MenuSection,
  type StockSchedule,
  type StockScheduleType,
  type WeekDay,
} from "@/services/api/menu";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { weekdayName } from "@/lib/stock";

interface DayWindow {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface SectionWithItems extends MenuSection {
  items: MenuItem[];
}

const initialDays = (schedule: StockSchedule | null): Record<WeekDay, DayWindow> =>
  Object.fromEntries(
    WEEK_DAYS.map((day) => {
      const window = schedule?.windows.find((w) => w.day === day);
      return [
        day,
        window
          ? { enabled: true, startTime: window.startTime, endTime: window.endTime }
          : { enabled: false, startTime: "07:00", endTime: "11:00" },
      ];
    }),
  ) as Record<WeekDay, DayWindow>;

const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * Create / edit a weekly stock schedule. Saving takes effect at once: its
 * dishes move to the schedule's current state straight away.
 */
export default function StockScheduleModal({
  schedule,
  sections,
  otherSchedules,
  onClose,
  onSaved,
}: {
  /** null for a new schedule. */
  schedule: StockSchedule | null;
  sections: SectionWithItems[];
  /** For "on another schedule" labels — saving moves those here. */
  otherSchedules: StockSchedule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const formId = useId();
  // Seeded once: the page mounts this fresh for each schedule it opens.
  const [name, setName] = useState(schedule?.name ?? "");
  const [type, setType] = useState<StockScheduleType>(schedule?.type ?? "available_during");
  const [days, setDays] = useState(() => initialDays(schedule));
  const [sectionIds, setSectionIds] = useState(() => new Set(schedule?.sectionIds ?? []));
  const [itemIds, setItemIds] = useState(() => new Set(schedule?.itemIds ?? []));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const otherName = (id?: string | null) => (id ? otherSchedules.find((s) => s.id === id)?.name : undefined);
  const setDay = (day: WeekDay, patch: Partial<DayWindow>) =>
    setDays((current) => ({ ...current, [day]: { ...current[day], ...patch } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const windows = WEEK_DAYS.filter((day) => days[day].enabled).map((day) => ({
      day,
      startTime: days[day].startTime,
      endTime: days[day].endTime,
    }));
    if (!name.trim()) return setError(t("stock.name_required"));
    if (windows.length === 0) return setError(t("stock.window_required"));
    const same = windows.find((w) => w.startTime === w.endTime);
    if (same) return setError(t("stock.same_time", { day: weekdayName(same.day, locale) }));
    setError("");

    const payload = {
      name: name.trim(),
      type,
      windows,
      itemIds: [...itemIds],
      sectionIds: [...sectionIds],
    };
    setSaving(true);
    try {
      if (schedule) await MenuService.updateStockSchedule(schedule.id, payload);
      else await MenuService.createStockSchedule(payload);
      toast.success(t("stock.saved"));
      onSaved();
      onClose();
    } catch (err: unknown) {
      // 400 (overlapping windows) and 409 (duplicate name, a dish running a
      // one-off) explain themselves.
      setError(getApiErrorMessage(err, t("stock.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const checkboxStyle = { accentColor: "var(--accent-primary)", marginTop: "3px" } as const;

  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? t("stock.edit_schedule") : t("stock.new_schedule")}
      maxWidth={640}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={saving}>
            <Busy busy={saving} label={t("common.save")} busyLabel={t("common.saving")} />
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="field">
          <label htmlFor={`${formId}-name`} className="field-label">
            {t("stock.schedule_name")} *
          </label>
          <input
            id={`${formId}-name`}
            className="form-input"
            value={name}
            maxLength={80}
            placeholder={t("stock.schedule_name_placeholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          <legend className="field-label" style={{ marginBottom: "8px" }}>
            {t("stock.type_title")}
          </legend>
          {(
            [
              ["available_during", t("stock.type_available_short"), t("stock.type_available_hint")],
              ["out_of_stock_during", t("stock.type_out_short"), t("stock.type_out_hint")],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name={`${formId}-type`}
                checked={type === value}
                onChange={() => setType(value)}
                style={checkboxStyle}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>{label}</span>
                <span className="field-hint">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="field-label">{t("stock.times_title")}</legend>
          <p className="field-hint" style={{ marginBlock: "4px 10px" }}>
            {t("stock.times_hint")}
          </p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  paddingBlock: "8px",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 140px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={days[day].enabled}
                    onChange={(e) => setDay(day, { enabled: e.target.checked })}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  <span style={{ color: days[day].enabled ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {weekdayName(day, locale)}
                  </span>
                </label>
                {days[day].enabled && (
                  <span className="force-ltr" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="time"
                      className="form-input"
                      aria-label={t("stock.start_time_aria", { day: weekdayName(day, locale) })}
                      value={days[day].startTime}
                      onChange={(e) => setDay(day, { startTime: e.target.value })}
                      style={{ width: "auto" }}
                    />
                    <span aria-hidden>–</span>
                    <input
                      type="time"
                      className="form-input"
                      aria-label={t("stock.end_time_aria", { day: weekdayName(day, locale) })}
                      value={days[day].endTime}
                      onChange={(e) => setDay(day, { endTime: e.target.value })}
                      style={{ width: "auto" }}
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="field-label">{t("stock.applies_to")}</legend>
          <p className="field-hint" style={{ marginBlock: "4px 10px" }}>
            {t("stock.applies_to_hint")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sections.map((section) => {
              const sectionOther = otherName(section.stockScheduleId);
              return (
                <details
                  key={section.id}
                  style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}
                >
                  <summary style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", listStyle: "none" }}>
                    <input
                      type="checkbox"
                      checked={sectionIds.has(section.id)}
                      onChange={() => setSectionIds((current) => toggled(current, section.id))}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t("stock.whole_section", { name: section.name })}
                      style={{ accentColor: "var(--accent-primary)" }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{t("stock.whole_section", { name: section.name })}</span>
                      {sectionOther && !sectionIds.has(section.id) && (
                        <span className="field-hint" style={{ display: "block" }}>
                          {t("stock.on_other_schedule", { name: sectionOther })}
                        </span>
                      )}
                    </span>
                    {section.items.length > 0 && (
                      <span className="field-hint">{t("stock.dish_count", { count: section.items.length })}</span>
                    )}
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingBlockStart: "8px", paddingInlineStart: "26px" }}>
                    {section.items.map((item) => {
                      const itemOther = otherName(item.stockScheduleId);
                      return (
                        <label key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={itemIds.has(item.id)}
                            onChange={() => setItemIds((current) => toggled(current, item.id))}
                            style={checkboxStyle}
                          />
                          <span>
                            {item.name}
                            {itemOther && !itemIds.has(item.id) && (
                              <span className="field-hint" style={{ display: "block" }}>
                                {t("stock.on_other_schedule", { name: itemOther })}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--error)", fontSize: "14px" }}>
            {error}
          </p>
        )}
        <p className="field-hint" style={{ margin: 0 }}>
          {t("stock.save_hint")}
        </p>
      </form>
    </Modal>
  );
}
