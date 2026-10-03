"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Edit2, Plus, Trash2 } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import { MenuService, WEEK_DAYS, type StockSchedule } from "@/services/api/menu";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { useRestaurant } from "@/lib/restaurantContext";
import { weekdayName } from "@/lib/stock";
import StockScheduleModal, { type SectionWithItems } from "./StockScheduleModal";

const byOrder = <T extends { sortOrder?: number }>(list: T[]) =>
  list.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/**
 * Weekly stock schedules ("Breakfast": in stock 07:00–11:00). There is no
 * pause switch: a schedule is stopped by deleting it.
 */
export default function StockSchedulesPage() {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const { restaurant } = useRestaurant();
  const restaurantId = restaurant?.id ?? null;

  const [schedules, setSchedules] = useState<StockSchedule[]>([]);
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<{ schedule: StockSchedule | null } | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [scheduleList, sectionList] = await Promise.all([
        MenuService.getStockSchedules(restaurantId),
        MenuService.getSectionsByRestaurant(restaurantId),
      ]);
      const withItems = await Promise.all(
        byOrder(sectionList).map(async (section) => ({
          ...section,
          items: byOrder(await MenuService.getItemsBySection(section.id).catch(() => [])),
        })),
      );
      setSchedules(scheduleList);
      setSections(withItems);
      setStatus("ready");
    } catch (err: unknown) {
      setLoadError(getApiErrorMessage(err, t("stock.load_failed")));
      setStatus("error");
    }
  }, [restaurantId, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleDelete = async (schedule: StockSchedule) => {
    const ok = await confirm({
      title: t("stock.delete_title", { name: schedule.name }),
      message: t("stock.delete_confirm"),
      danger: true,
    });
    if (!ok) return;
    try {
      await MenuService.deleteStockSchedule(schedule.id);
      setSchedules((current) => current.filter((s) => s.id !== schedule.id));
      toast.success(t("stock.deleted"));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("stock.delete_failed")));
    }
  };

  const windowsSummary = (schedule: StockSchedule) =>
    WEEK_DAYS.flatMap((day) => {
      const window = schedule.windows.find((w) => w.day === day);
      return window ? [`${weekdayName(day, locale, "short")} ${window.startTime}–${window.endTime}`] : [];
    });

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <Link href="/menu" className="field-hint" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} className="flip-in-rtl" aria-hidden /> {t("nav.menu")}
          </Link>
          <h1 className="page-title">{t("stock.schedules_title")}</h1>
          <p className="page-subtitle">{t("stock.schedules_subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing({ schedule: null })} disabled={status !== "ready"}>
          <Plus size={20} aria-hidden /> {t("stock.new_schedule")}
        </button>
      </header>

      {status === "loading" && <p className="field-hint">{t("common.loading")}</p>}

      {status === "error" && (
        <div className="empty-state" role="alert">
          <h3>{loadError}</h3>
          <button type="button" className="btn-outline" onClick={() => void load()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {status === "ready" && schedules.length === 0 && (
        <div className="empty-state">
          <CalendarClock size={40} aria-hidden style={{ color: "var(--accent-primary)" }} />
          <h3>{t("stock.no_schedules")}</h3>
          <p>{t("stock.no_schedules_desc")}</p>
          <button type="button" className="btn-primary" onClick={() => setEditing({ schedule: null })}>
            <Plus size={18} aria-hidden /> {t("stock.new_schedule")}
          </button>
        </div>
      )}

      {status === "ready" && schedules.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "16px",
          }}
        >
          {schedules.map((schedule) => (
            <article key={schedule.id} className="card" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  {schedule.name}
                </h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setEditing({ schedule })}
                  aria-label={t("stock.edit_aria", { name: schedule.name })}
                  title={t("common.edit")}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={() => void handleDelete(schedule)}
                  aria-label={t("stock.delete_aria", { name: schedule.name })}
                  title={t("common.delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <span
                className="badge"
                style={{
                  alignSelf: "flex-start",
                  color: schedule.type === "available_during" ? "var(--success)" : "var(--error)",
                }}
              >
                {schedule.type === "available_during" ? t("stock.type_available") : t("stock.type_out")}
              </span>
              <ul className="force-ltr" style={{ margin: 0, paddingInlineStart: "18px", fontSize: "13px", color: "var(--text-secondary)" }}>
                {windowsSummary(schedule).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="field-hint" style={{ margin: 0 }}>
                {t("stock.applies_to_count", {
                  sections: schedule.sectionIds.length,
                  items: schedule.itemIds.length,
                })}
              </p>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <StockScheduleModal
          key={editing.schedule?.id ?? "new"}
          schedule={editing.schedule}
          sections={sections}
          otherSchedules={schedules.filter((s) => s.id !== editing.schedule?.id)}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
