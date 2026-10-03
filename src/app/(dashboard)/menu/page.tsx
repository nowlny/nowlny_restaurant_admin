"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, Edit2, Eye, Plus, Search, Trash2, X } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import MenuImporter from "@/components/menu/MenuImporter";
import SortHandle, { beginRowDrag, moveInArray } from "@/components/menu/SortHandle";
import { MenuService, type MenuItem, type MenuSection, type StockSchedule } from "@/services/api/menu";
import { scheduleFor } from "@/lib/stock";
import { orderSocket } from "@/lib/orderSocket";
import { getApiErrorMessage, isApiStatus } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { useRestaurant } from "@/lib/restaurantContext";
import MenuItemModal from "./components/MenuItemModal";
import MenuItemCard from "./components/MenuItemCard";
import OptionGroupsDrawer from "./components/OptionGroupsDrawer";
import SectionFormModal from "./components/SectionFormModal";
import StockUntilModal from "./components/StockUntilModal";

interface SectionWithItems extends MenuSection {
  items: MenuItem[];
}

type DragRef = { kind: "section"; id: string } | { kind: "item"; id: string; sectionId: string };

const byOrder = <T extends { sortOrder?: number }>(list: T[]) =>
  list.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/** Tagged with their section, which the list endpoint doesn't always echo. */
const fetchSectionItems = async (sectionId: string) =>
  byOrder(await MenuService.getItemsBySection(sectionId)).map((item) => ({ ...item, sectionId }));

const matches = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query);

export default function MenuPage() {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const { restaurant } = useRestaurant();
  const restaurantId = restaurant?.id ?? null;

  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [sectionModal, setSectionModal] = useState<{ open: boolean; section: MenuSection | null }>({
    open: false,
    section: null,
  });
  const [itemModal, setItemModal] = useState<{ open: boolean; sectionId: string; item: MenuItem | null }>({
    open: false,
    sectionId: "",
    item: null,
  });
  const [optionsItem, setOptionsItem] = useState<MenuItem | null>(null);
  const [stockPending, setStockPending] = useState<Set<string>>(() => new Set());
  const [stockSchedules, setStockSchedules] = useState<StockSchedule[]>([]);
  /** The dish whose "out of stock until…" dialog is open. */
  const [stockUntilItem, setStockUntilItem] = useState<MenuItem | null>(null);

  // ─── Loading ─────────────────────────────────────────────────────────────

  const loadMenu = useCallback(async () => {
    if (!restaurantId) return;
    setLoadError("");
    try {
      const data = byOrder(await MenuService.getSectionsByRestaurant(restaurantId));
      const withItems = await Promise.all(
        data.map(async (section) => ({ ...section, items: await fetchSectionItems(section.id) })),
      );
      setSections(withItems);
      setStatus("ready");
      // Only labels the dishes: a failure here must not fail the menu.
      MenuService.getStockSchedules(restaurantId)
        .then(setStockSchedules)
        .catch(() => setStockSchedules([]));
    } catch (err: unknown) {
      // A failed load must never read as "you have no sections" — that is how
      // owners ended up re-creating a menu that was there all along.
      setLoadError(getApiErrorMessage(err, ""));
      setStatus("error");
    }
  }, [restaurantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMenu(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMenu]);

  /** One section's dishes again — when an API answer was too thin to patch from. */
  const refreshSection = async (sectionId: string) => {
    try {
      const items = await fetchSectionItems(sectionId);
      setSections((current) => current.map((s) => (s.id === sectionId ? { ...s, items } : s)));
    } catch {
      await loadMenu();
    }
  };

  // ─── Sections ────────────────────────────────────────────────────────────

  const handleSectionSaved = (saved: MenuSection | null) => {
    if (!saved) {
      void loadMenu();
      return;
    }
    setSections((current) =>
      current.some((s) => s.id === saved.id)
        ? current.map((s) => (s.id === saved.id ? { ...s, ...saved, items: s.items } : s))
        : [...current, { ...saved, items: [] }],
    );
  };

  const handleDeleteSection = async (section: SectionWithItems) => {
    const ok = await confirm({
      title: t("menu.confirm_delete_section"),
      message:
        section.items.length > 0
          ? t("menu.delete_section_with_items", { name: section.name, count: section.items.length })
          : section.name,
      danger: true,
    });
    if (!ok) return;
    try {
      await MenuService.deleteSection(section.id);
      setSections((current) => current.filter((s) => s.id !== section.id));
      toast.success(t("menu.section_deleted"));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.delete_failed")));
    }
  };

  // ─── Dishes ──────────────────────────────────────────────────────────────

  const handleItemSaved = (saved: MenuItem | null, sectionId: string) => {
    if (!saved?.id) {
      void refreshSection(sectionId);
      return;
    }
    setSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;
        const exists = section.items.some((item) => item.id === saved.id);
        return {
          ...section,
          items: exists
            ? section.items.map((item) => (item.id === saved.id ? { ...item, ...saved, sectionId } : item))
            : [...section.items, { ...saved, sectionId }],
        };
      }),
    );
  };

  const patchItem = (itemId: string, patch: Partial<MenuItem>) =>
    setSections((current) =>
      current.map((section) => ({
        ...section,
        items: section.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      })),
    );

  const handleDeleteItem = async (item: MenuItem, sectionId: string) => {
    const ok = await confirm({ title: t("menu.confirm_delete_item"), message: item.name, danger: true });
    if (!ok) return;
    try {
      await MenuService.deleteItem(item.id);
      setSections((current) =>
        current.map((s) => (s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== item.id) } : s)),
      );
      toast.success(t("menu.item_deleted"));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.delete_failed")));
    }
  };

  /** Optimistic: the switch flips at once and flips back if the API refuses. */
  const handleToggleStock = async (item: MenuItem) => {
    if (stockPending.has(item.id)) return;
    const next = item.isAvailable === false;
    patchItem(item.id, { isAvailable: next });
    setStockPending((current) => new Set(current).add(item.id));
    try {
      const saved = await MenuService.setItemStock(item.id, { isAvailable: next });
      // The stock endpoint resolves schedules, so its answer is the truth.
      if (saved && typeof saved.isAvailable === "boolean") patchItem(item.id, { isAvailable: saved.isAvailable });
    } catch (err: unknown) {
      patchItem(item.id, { isAvailable: !next });
      toast.error(
        getApiErrorMessage(err, isApiStatus(err, 409) ? t("menu.stock_scheduled") : t("menu.stock_failed")),
      );
    } finally {
      setStockPending((current) => {
        const copy = new Set(current);
        copy.delete(item.id);
        return copy;
      });
    }
  };

  /** A one-off: out of stock until a time, back on its own. */
  const handleStockUntil = async (item: MenuItem, until: Date): Promise<boolean> => {
    try {
      const saved = await MenuService.setItemStock(item.id, { isAvailable: false, until: until.toISOString() });
      patchItem(item.id, saved ? { ...saved, id: item.id } : { isAvailable: false, outOfStockUntil: until.toISOString() });
      return true;
    } catch (err: unknown) {
      // 409: the dish follows a schedule. The API says so in its own words.
      toast.error(getApiErrorMessage(err, t("menu.stock_failed")));
      return false;
    }
  };

  // Live stock: a change from any device, a one-off lapsing or a schedule
  // edge lands here without a refetch.
  useEffect(
    () =>
      orderSocket.subscribeMenuStock(({ items }) => {
        const byId = new Map(items.map((update) => [update.id, update]));
        setSections((current) =>
          current.map((section) => ({
            ...section,
            items: section.items.map((item) => {
              const update = byId.get(item.id);
              return update ? { ...item, ...update, sectionId: item.sectionId } : item;
            }),
          })),
        );
      }),
    [],
  );

  // ─── Search ──────────────────────────────────────────────────────────────

  const query = search.trim().toLowerCase();
  const isFiltering = query !== "";
  const visibleSections = useMemo(() => {
    if (!isFiltering) return sections;
    return sections
      .map((section) =>
        // A section whose own name matches shows all its dishes.
        matches(section.name, query)
          ? section
          : {
              ...section,
              items: section.items.filter(
                (item) => matches(item.name, query) || matches(item.description, query),
              ),
            },
      )
      .filter((section) => section.items.length > 0 || matches(section.name, query));
  }, [sections, query, isFiltering]);

  // ─── Drag-and-drop sorting ───────────────────────────────────────────────
  //
  // The rendered list is what gets sent as the new order, so sorting is only
  // offered while that list is complete: a search hides rows, and the API
  // rejects a partial `orderedIds`.
  const canSortSections = !isFiltering && sections.length > 1;
  const canSortItems = !isFiltering;
  const sortBlockedHint = isFiltering ? t("menu.sort_blocked_search") : undefined;

  // What is in flight is held in a ref *and* in state. The ref is what the
  // drag handlers read: `dragstart` is not a discrete event, so a state update
  // made there may not have rendered before the first `dragover` — and a
  // `dragover` that never calls preventDefault() tells the browser this is not
  // a drop zone. The state copy only paints the highlighting.
  const draggingRef = useRef<DragRef | null>(null);
  const [dragging, setDragging] = useState<DragRef | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const clearDrag = () => {
    draggingRef.current = null;
    setDragging(null);
    setDropTargetId(null);
  };

  const startDrag = (e: React.DragEvent<HTMLSpanElement>, ref: DragRef) => {
    beginRowDrag(e, ref.id);
    draggingRef.current = ref;
    setDragging(ref);
  };

  const moveSection = async (sectionId: string, toIndex: number) => {
    const from = sections.findIndex((s) => s.id === sectionId);
    if (from < 0 || toIndex < 0 || toIndex >= sections.length || from === toIndex) return;
    const previous = sections;
    const next = moveInArray(sections, from, toIndex);
    setSections(next);
    try {
      await MenuService.reorderSections(next.map((s) => s.id));
    } catch (err: unknown) {
      setSections(previous); // the server still has the old order
      toast.error(getApiErrorMessage(err, t("menu.sort_failed")));
    }
  };

  const moveItem = async (sectionId: string, itemId: string, toIndex: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const from = section.items.findIndex((i) => i.id === itemId);
    if (from < 0 || toIndex < 0 || toIndex >= section.items.length || from === toIndex) return;
    const previous = sections;
    const nextItems = moveInArray(section.items, from, toIndex);
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, items: nextItems } : s)));
    try {
      await MenuService.reorderItems(sectionId, nextItems.map((i) => i.id));
    } catch (err: unknown) {
      setSections(previous);
      toast.error(getApiErrorMessage(err, t("menu.sort_failed")));
    }
  };

  /** Dropping a dish on another section re-parents it, then renumbers both. */
  const moveItemToSection = async (itemId: string, fromId: string, toId: string, toIndex: number) => {
    if (fromId === toId) return;
    const source = sections.find((s) => s.id === fromId);
    const target = sections.find((s) => s.id === toId);
    const item = source?.items.find((i) => i.id === itemId);
    if (!source || !target || !item) return;

    const nextSource = source.items.filter((i) => i.id !== itemId);
    const nextTarget = target.items.slice();
    nextTarget.splice(Math.max(0, Math.min(toIndex, nextTarget.length)), 0, { ...item, sectionId: toId });
    setSections(
      sections.map((s) =>
        s.id === fromId ? { ...s, items: nextSource } : s.id === toId ? { ...s, items: nextTarget } : s,
      ),
    );

    try {
      await MenuService.updateItem(itemId, { sectionId: toId });
      await MenuService.reorderItems(toId, nextTarget.map((i) => i.id));
      if (nextSource.length > 0) await MenuService.reorderItems(fromId, nextSource.map((i) => i.id));
      toast.success(t("menu.item_moved", { name: item.name, section: target.name }));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.sort_failed")));
      // The re-parent may have landed before a reorder failed, so the
      // optimistic state can't simply be rolled back — refetch the truth.
      await loadMenu();
    }
  };

  const sectionAccepts = (source: DragRef | null, sectionId: string) => {
    if (!source) return false;
    if (source.kind === "section") return canSortSections && source.id !== sectionId;
    return canSortItems && source.sectionId !== sectionId;
  };

  const itemAccepts = (source: DragRef | null, itemId: string) =>
    !!source && source.kind === "item" && canSortItems && source.id !== itemId;

  const handleDropOnSection = (sectionId: string) => {
    const source = draggingRef.current;
    clearDrag();
    if (!sectionAccepts(source, sectionId) || !source) return;
    if (source.kind === "section") {
      void moveSection(source.id, sections.findIndex((s) => s.id === sectionId));
      return;
    }
    // A dish dropped on a section's header or empty space lands at the end.
    const target = sections.find((s) => s.id === sectionId);
    void moveItemToSection(source.id, source.sectionId, sectionId, target?.items.length ?? 0);
  };

  const handleDropOnItem = (targetId: string, targetSectionId: string) => {
    const source = draggingRef.current;
    clearDrag();
    if (!source || !itemAccepts(source, targetId) || source.kind !== "item") return;
    const toIndex = sections.find((s) => s.id === targetSectionId)?.items.findIndex((i) => i.id === targetId) ?? -1;
    if (toIndex < 0) return;
    if (source.sectionId === targetSectionId) void moveItem(targetSectionId, source.id, toIndex);
    else void moveItemToSection(source.id, source.sectionId, targetSectionId, toIndex);
  };

  /** Which side of the row the drop line goes on. */
  const dropSide = (list: { id: string }[], sourceId: string, targetId: string) => {
    const from = list.findIndex((entry) => entry.id === sourceId);
    const to = list.findIndex((entry) => entry.id === targetId);
    // From another section, the dish is inserted *at* the target's index.
    return from < 0 || from > to ? "drop-before" : "drop-after";
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const openNewSection = () => setSectionModal({ open: true, section: null });

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">{t("menu.title")}</h1>
          <p className="page-subtitle">{t("menu.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Link className="btn-outline" href="/menu/stock-schedules">
            <CalendarClock size={20} aria-hidden /> {t("stock.schedules_title")}
          </Link>
          <Link className="btn-outline" href="/menu/preview">
            <Eye size={20} aria-hidden /> {t("menu.customer_preview")}
          </Link>
          <button type="button" className="btn-primary" onClick={openNewSection}>
            <Plus size={20} aria-hidden /> {t("menu.add_section")}
          </button>
        </div>
      </header>

      {status === "ready" && (
        <MenuImporter sections={sections} onImported={loadMenu} defaultOpen={sections.length === 0} />
      )}

      {status === "ready" && sections.length > 0 && (
        <div style={{ position: "relative" }}>
          <label htmlFor="menu-search" className="sr-only">
            {t("menu.search_label")}
          </label>
          <Search
            size={18}
            aria-hidden
            style={{
              position: "absolute",
              insetInlineStart: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            id="menu-search"
            type="search"
            className="form-input"
            placeholder={t("menu.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingInlineStart: "42px", paddingInlineEnd: search ? "44px" : undefined }}
          />
          {search && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSearch("")}
              aria-label={t("menu.search_clear")}
              style={{ position: "absolute", insetInlineEnd: "6px", top: "50%", transform: "translateY(-50%)" }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {status === "loading" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          {[0, 1].map((i) => (
            <div key={i} className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="skeleton" style={{ height: "24px", width: "40%" }} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                  gap: "16px",
                }}
              >
                {[0, 1, 2].map((j) => (
                  <div key={j} className="skeleton" style={{ height: "112px" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <div className="notice notice-error" role="alert" style={{ flexDirection: "column", padding: "20px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t("menu.load_failed")}</p>
              {loadError && <p style={{ margin: 0, color: "var(--text-secondary)" }}>{loadError}</p>}
            </div>
          </div>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => {
              setStatus("loading");
              void loadMenu();
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : sections.length === 0 ? (
        <div className="empty-state">
          <h3>{t("menu.empty_title")}</h3>
          <p>{t("menu.empty")}</p>
          <button type="button" className="btn-primary" onClick={openNewSection}>
            <Plus size={18} aria-hidden /> {t("menu.add_section")}
          </button>
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="empty-state">
          <p>{t("menu.search_empty", { query: search.trim() })}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {visibleSections.map((section) => {
            const isSectionDragged = dragging?.kind === "section" && dragging.id === section.id;
            const isSectionTarget = dropTargetId === section.id && sectionAccepts(dragging, section.id);
            const sectionDropClass =
              isSectionTarget && dragging?.kind === "section" ? dropSide(sections, dragging.id, section.id) : "";

            return (
              <section
                key={section.id}
                data-drag-card
                aria-label={section.name}
                className={["card", isSectionDragged ? "is-dragging" : "", sectionDropClass].join(" ")}
                onDragOver={(e) => {
                  if (!sectionAccepts(draggingRef.current, section.id)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTargetId(section.id);
                }}
                onDragLeave={(e) => {
                  // Leaving into a child (a dish card) is not leaving the section.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setDropTargetId((prev) => (prev === section.id ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnSection(section.id);
                }}
                style={{
                  padding: "20px",
                  outline:
                    isSectionTarget && dragging?.kind === "item" ? "2px dashed var(--accent-primary)" : undefined,
                  outlineOffset: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid var(--border-color)",
                    paddingBottom: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <SortHandle
                    label={section.name}
                    disabled={!canSortSections}
                    disabledHint={sortBlockedHint}
                    onDragStart={(e) => startDrag(e, { kind: "section", id: section.id })}
                    onDragEnd={clearDrag}
                    onMove={(delta) =>
                      void moveSection(section.id, sections.findIndex((s) => s.id === section.id) + delta)
                    }
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0, overflowWrap: "anywhere" }}>
                        {section.name}
                      </h2>
                      <span className="badge">{section.items.length}</span>
                      {section.isActive === false && <span className="badge badge-warning">{t("menu.badge_hidden")}</span>}
                    </div>
                    {section.description && (
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                        {section.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSectionModal({ open: true, section })}
                    aria-label={t("menu.edit_section_aria", { name: section.name })}
                    title={t("common.edit")}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => void handleDeleteSection(sections.find((s) => s.id === section.id) ?? section)}
                    aria-label={t("menu.delete_section_aria", { name: section.name })}
                    title={t("common.delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {section.items.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 16px" }}>
                    {t("menu.section_empty")}
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    {section.items.map((item) => {
                      const isItemDragged = dragging?.kind === "item" && dragging.id === item.id;
                      const isItemTarget = dropTargetId === item.id && itemAccepts(dragging, item.id);
                      return (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          sortDisabled={!canSortItems}
                          sortDisabledHint={sortBlockedHint}
                          dragClassName={[
                            isItemDragged ? "is-dragging" : "",
                            isItemTarget && dragging ? dropSide(section.items, dragging.id, item.id) : "",
                          ].join(" ")}
                          stockPending={stockPending.has(item.id)}
                          onEdit={() => setItemModal({ open: true, sectionId: section.id, item })}
                          onOptions={() => setOptionsItem(item)}
                          onDelete={() => void handleDeleteItem(item, section.id)}
                          onToggleStock={() => void handleToggleStock(item)}
                          onStockUntil={() => setStockUntilItem(item)}
                          schedule={scheduleFor(item, section, stockSchedules)}
                          onDragStart={(e) => startDrag(e, { kind: "item", id: item.id, sectionId: section.id })}
                          onDragEnd={clearDrag}
                          onMove={(delta) =>
                            void moveItem(
                              section.id,
                              item.id,
                              section.items.findIndex((i) => i.id === item.id) + delta,
                            )
                          }
                          dropHandlers={{
                            onDragOver: (e) => {
                              if (!itemAccepts(draggingRef.current, item.id)) return;
                              // Without this the section also claims the drop
                              // and the dish lands at the end instead.
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                              setDropTargetId(item.id);
                            },
                            onDragLeave: () => setDropTargetId((prev) => (prev === item.id ? null : prev)),
                            onDrop: (e) => {
                              if (!itemAccepts(draggingRef.current, item.id)) return;
                              e.preventDefault();
                              e.stopPropagation();
                              handleDropOnItem(item.id, section.id);
                            },
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setItemModal({ open: true, sectionId: section.id, item: null })}
                  className="btn-outline"
                  style={{ width: "100%", borderStyle: "dashed" }}
                >
                  <Plus size={18} aria-hidden /> {t("menu.add_item_to", { section: section.name })}
                </button>
              </section>
            );
          })}
          {!isFiltering && (sections.length > 1 || sections.some((s) => s.items.length > 1)) && (
            <p className="field-hint" style={{ textAlign: "center" }}>
              {t("menu.sort_hint")}
            </p>
          )}
        </div>
      )}

      {/* Mounted per open, so each form starts from the row it was opened for. */}
      {sectionModal.open && (
        <SectionFormModal
          open
          section={sectionModal.section}
          nextSortOrder={sections.length}
          onClose={() => setSectionModal({ open: false, section: null })}
          onSaved={handleSectionSaved}
          schedules={stockSchedules}
          onStockChanged={(sectionId) => void refreshSection(sectionId)}
        />
      )}

      {itemModal.open && (
        <MenuItemModal
          isOpen
          onClose={() => setItemModal({ open: false, sectionId: "", item: null })}
          sectionId={itemModal.sectionId}
          item={itemModal.item}
          nextSortOrder={sections.find((s) => s.id === itemModal.sectionId)?.items.length ?? 0}
          onSaved={handleItemSaved}
          schedules={stockSchedules}
          sectionSchedule={stockSchedules.find(
            (s) => s.id === sections.find((section) => section.id === itemModal.sectionId)?.stockScheduleId,
          )}
        />
      )}

      {stockUntilItem && (
        <StockUntilModal
          key={stockUntilItem.id}
          item={stockUntilItem}
          onClose={() => setStockUntilItem(null)}
          onSubmit={(until) => handleStockUntil(stockUntilItem, until)}
        />
      )}

      {optionsItem && (
        <OptionGroupsDrawer
          key={optionsItem.id}
          isOpen
          onClose={() => setOptionsItem(null)}
          itemId={optionsItem.id}
          itemName={optionsItem.name}
        />
      )}
    </div>
  );
}
