"use client";

import React, { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { MenuService, readId, type MenuSection, type StockSchedule } from "@/services/api/menu";
import StockScheduleSelect from "@/components/menu/StockScheduleSelect";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";

/**
 * Create / edit a menu section.
 *
 * Was an inline panel that appeared above the importer — far from the section
 * being edited, so on a long menu "Edit" seemed to do nothing until you
 * scrolled back to the top.
 */
export default function SectionFormModal({
  open,
  section,
  nextSortOrder,
  onClose,
  onSaved,
  schedules,
  onStockChanged,
}: {
  open: boolean;
  /** Set when editing; null for a new section. */
  section: MenuSection | null;
  /** Where a new section goes: after the last one. */
  nextSortOrder: number;
  onClose: () => void;
  /** `null` when the API's answer couldn't be read; the page refetches. */
  onSaved: (section: MenuSection | null) => void;
  schedules: StockSchedule[];
  /** A schedule change moved the section's dishes in or out of stock: reload them. */
  onStockChanged: (sectionId: string) => void;
}) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const formId = useId();
  // Seeded once: the page mounts this fresh each time it opens.
  const [form, setForm] = useState(() => ({
    name: section?.name ?? "",
    description: section?.description ?? "",
    isActive: section ? section.isActive !== false : true,
    stockScheduleId: section?.stockScheduleId ?? null,
  }));
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    const payload = { name, description: form.description.trim(), isActive: form.isActive };

    /**
     * Attach / detach the schedule after the section itself is saved. It takes
     * effect on the dishes at once. A refusal (409: a dish in it runs a
     * one-off) is shown in the API's words; the section stays saved.
     */
    const applySchedule = async (sectionId: string): Promise<Partial<MenuSection>> => {
      if (form.stockScheduleId === (section?.stockScheduleId ?? null)) return {};
      try {
        const saved = await MenuService.setSectionStockSchedule(sectionId, form.stockScheduleId);
        onStockChanged(sectionId);
        return { stockScheduleId: saved?.stockScheduleId ?? form.stockScheduleId };
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, t("stock.attach_failed")));
        return {};
      }
    };

    setSaving(true);
    try {
      if (section) {
        const saved = await MenuService.updateSection(section.id, payload);
        const schedule = await applySchedule(section.id);
        onSaved({ ...section, ...payload, ...(saved ?? {}), ...schedule, id: section.id });
      } else {
        const created = await MenuService.createSection({ ...payload, sortOrder: nextSortOrder });
        const id = readId(created);
        const schedule = id ? await applySchedule(id) : {};
        onSaved(id ? { ...payload, sortOrder: nextSortOrder, ...created, ...schedule, id } : null);
      }
      toast.success(t("menu.section_saved"));
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t("menu.section_save_failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={section ? t("menu.edit_section") : t("menu.new_section")}
      maxWidth={480}
      dismissible={!saving}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={saving}>
            <Busy busy={saving} label={t("menu.save_section")} busyLabel={t("common.saving")} />
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div className="field">
          <label htmlFor={`${formId}-name`} className="field-label">
            {t("menu.section_name")} *
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            className="form-input"
            placeholder={t("menu.section_name_placeholder")}
            value={form.name}
            maxLength={120}
            aria-invalid={nameError}
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (nameError) setNameError(false);
            }}
          />
          {nameError && (
            <p id={`${formId}-name-error`} className="field-hint" style={{ color: "var(--error)" }}>
              {t("menu.error_name_required")}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-description`} className="field-label">
            {t("item.description")}
          </label>
          <input
            id={`${formId}-description`}
            type="text"
            className="form-input"
            placeholder={t("menu.section_description_placeholder")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <label
          htmlFor={`${formId}-active`}
          style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}
        >
          <input
            id={`${formId}-active`}
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            style={{ marginTop: "3px", accentColor: "var(--accent-primary)" }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{t("item.active")}</span>
            <span className="field-hint">{t("menu.section_active_hint")}</span>
          </span>
        </label>
        {schedules.length > 0 && (
          <StockScheduleSelect
            schedules={schedules}
            value={form.stockScheduleId}
            onChange={(stockScheduleId) => setForm({ ...form, stockScheduleId })}
            hint={t("stock.section_schedule_hint")}
          />
        )}
      </form>
    </Modal>
  );
}
