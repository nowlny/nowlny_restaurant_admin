"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Edit2, Plus, Trash2, X } from "lucide-react";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import SortHandle, { beginRowDrag, moveInArray } from "@/components/menu/SortHandle";
import {
  MenuService,
  type MenuItemOption,
  type MenuItemOptionGroup,
  type OptionGroupType,
} from "@/services/api/menu";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { useMenuMoney } from "@/lib/menuMoney";

interface OptionGroupsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

interface GroupForm {
  name: string;
  type: OptionGroupType;
  isRequired: boolean;
}

const byOrder = <T extends { sortOrder?: number }>(list: T[]) =>
  list.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const sortGroups = (groups: MenuItemOptionGroup[]) =>
  byOrder(groups).map((group) => ({ ...group, options: byOrder(group.options ?? []) }));

/** What is being dragged: a whole group, or one choice inside a group. */
type DragRef = { kind: "group"; id: string } | { kind: "option"; id: string; groupId: string };

/**
 * Side panel for a dish's option groups ("Choose your size", "Extras").
 *
 * Stays a drawer rather than the shared <Modal> so the dish list stays visible
 * behind it, but behaves like a dialog: Escape closes it, focus moves in and
 * back out, and the page behind doesn't scroll.
 */
export default function OptionGroupsDrawer({ isOpen, onClose, itemId, itemName }: OptionGroupsDrawerProps) {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const money = useMenuMoney();
  const titleId = useId();
  const formId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MenuItemOptionGroup[]>([]);
  const [saving, setSaving] = useState(false);

  const [editingGroup, setEditingGroup] = useState<MenuItemOptionGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>({ name: "", type: "radio", isRequired: false });
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<MenuItemOption | null>(null);
  const [optionForm, setOptionForm] = useState({ name: "", price: "" });
  const [isOptionFormOpen, setIsOptionFormOpen] = useState(false);

  // Read through a ref so the open-effect doesn't re-run on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // On the document, not the panel: a confirm dialog opened from here stops
    // its own Escape from propagating, so this only fires for the drawer.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [isOpen]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setGroups(sortGroups(await MenuService.getOptionGroupsByItem(itemId)));
    } catch (err: unknown) {
      setLoadError(getApiErrorMessage(err, t("menu.options_load_failed")));
    } finally {
      setLoading(false);
    }
    // `t` changes identity every render; the effect below must not refetch for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (!isOpen || !itemId) return;
    const timer = window.setTimeout(() => void fetchGroups(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, itemId, fetchGroups]);

  const saveGroup = async () => {
    const name = groupForm.name.trim();
    if (!name) {
      toast.error(t("menu.error_name_required"));
      return;
    }
    setSaving(true);
    try {
      if (editingGroup) {
        const saved = await MenuService.updateOptionGroup(editingGroup.id, { ...groupForm, name });
        setGroups((current) =>
          current.map((group) =>
            group.id === editingGroup.id
              ? { ...group, ...groupForm, name, ...(saved ?? {}), options: group.options }
              : group,
          ),
        );
      } else {
        const created = await MenuService.createOptionGroup({
          ...groupForm,
          name,
          menuItemId: itemId,
          sortOrder: groups.length,
        });
        if (created?.id) {
          setGroups((current) => [...current, { ...created, options: created.options ?? [] }]);
        } else {
          await fetchGroups();
        }
      }
      setIsGroupFormOpen(false);
      setEditingGroup(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.options_save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (group: MenuItemOptionGroup) => {
    const ok = await confirm({
      title: t("options.confirm_delete_group"),
      message: group.name,
      danger: true,
    });
    if (!ok) return;
    try {
      await MenuService.deleteOptionGroup(group.id);
      setGroups((current) => current.filter((g) => g.id !== group.id));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.options_delete_failed")));
    }
  };

  const saveOption = async () => {
    if (!activeGroupId) return;
    const name = optionForm.name.trim();
    const priceText = optionForm.price.trim().replace(",", ".");
    const price = priceText === "" ? 0 : Number(priceText);
    if (!name) {
      toast.error(t("menu.error_name_required"));
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t("menu.error_price_invalid"));
      return;
    }

    setSaving(true);
    try {
      const groupId = activeGroupId;
      if (editingOption) {
        const saved = await MenuService.updateOption(editingOption.id, { name, price });
        setGroups((current) =>
          current.map((group) =>
            group.id !== groupId
              ? group
              : {
                  ...group,
                  options: (group.options ?? []).map((option) =>
                    option.id === editingOption.id ? { ...option, name, price, ...(saved ?? {}) } : option,
                  ),
                },
          ),
        );
      } else {
        const group = groups.find((g) => g.id === groupId);
        const created = await MenuService.addOptionToGroup(groupId, {
          name,
          price,
          sortOrder: group?.options?.length ?? 0,
        });
        if (created?.id) {
          setGroups((current) =>
            current.map((g) => (g.id === groupId ? { ...g, options: [...(g.options ?? []), created] } : g)),
          );
        } else {
          await fetchGroups();
        }
      }
      setIsOptionFormOpen(false);
      setEditingOption(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.options_save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (groupId: string, option: MenuItemOption) => {
    const ok = await confirm({
      title: t("options.confirm_delete_option"),
      message: option.name,
      danger: true,
    });
    if (!ok) return;
    try {
      await MenuService.deleteOption(option.id);
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? { ...group, options: (group.options ?? []).filter((o) => o.id !== option.id) }
            : group,
        ),
      );
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("menu.options_delete_failed")));
    }
  };

  // ─── Sorting ─────────────────────────────────────────────────────────────
  // Same approach as the dish list: the ref is what drag handlers read (a
  // state update in `dragstart` may not have rendered by the first
  // `dragover`), the state copy only paints the highlight.
  const draggingRef = useRef<DragRef | null>(null);
  const [dragging, setDragging] = useState<DragRef | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const clearDrag = () => {
    draggingRef.current = null;
    setDragging(null);
    setDropTargetId(null);
  };

  const moveGroup = async (groupId: string, to: number) => {
    const from = groups.findIndex((g) => g.id === groupId);
    if (from < 0 || to < 0 || to >= groups.length || from === to) return;
    const previous = groups;
    const next = moveInArray(groups, from, to);
    setGroups(next);
    try {
      await MenuService.reorderOptionGroups(itemId, next.map((g) => g.id));
    } catch (err: unknown) {
      setGroups(previous);
      toast.error(getApiErrorMessage(err, t("menu.sort_failed")));
    }
  };

  const moveOption = async (groupId: string, optionId: string, to: number) => {
    const group = groups.find((g) => g.id === groupId);
    const options = group?.options ?? [];
    const from = options.findIndex((o) => o.id === optionId);
    if (!group || from < 0 || to < 0 || to >= options.length || from === to) return;
    const previous = groups;
    const nextOptions = moveInArray(options, from, to);
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, options: nextOptions } : g)));
    try {
      await MenuService.reorderOptions(groupId, nextOptions.map((o) => o.id));
    } catch (err: unknown) {
      setGroups(previous);
      toast.error(getApiErrorMessage(err, t("menu.sort_failed")));
    }
  };

  /** Where the drop indicator goes, relative to the row under the pointer. */
  const dropClass = (list: { id: string }[], targetId: string) => {
    if (!dragging || dropTargetId !== targetId || dragging.id === targetId) return "";
    const from = list.findIndex((entry) => entry.id === dragging.id);
    const to = list.findIndex((entry) => entry.id === targetId);
    if (from < 0 || to < 0) return "";
    return from > to ? "drop-before" : "drop-after";
  };

  if (!isOpen) return null;

  const iconButtonLabel = (key: "options.edit_aria" | "options.delete_aria", name: string) =>
    t(key, { name });

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: "fixed", inset: 0, backgroundColor: "var(--scrim)", zIndex: "var(--z-drawer)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-fade-in"
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          bottom: 0,
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "var(--bg-surface)",
          zIndex: "var(--z-drawer)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          outline: "none",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            position: "sticky",
            top: 0,
            backgroundColor: "var(--bg-surface)",
            zIndex: 2,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
              {t("options.title")}
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t("options.for_item", { name: itemName })}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {!isGroupFormOpen && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={() => {
                setEditingGroup(null);
                setGroupForm({ name: "", type: "radio", isRequired: false });
                setIsGroupFormOpen(true);
              }}
            >
              <Plus size={18} /> {t("options.add_group")}
            </button>
          )}

          {isGroupFormOpen && (
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                void saveGroup();
              }}
              style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <h3 style={{ fontWeight: 600, fontSize: "16px", margin: 0 }}>
                {editingGroup ? t("options.edit_group") : t("options.new_group")}
              </h3>
              <div className="field">
                <label htmlFor={`${formId}-group-name`} className="field-label">
                  {t("item.name")}
                </label>
                <input
                  id={`${formId}-group-name`}
                  type="text"
                  className="form-input"
                  placeholder={t("options.group_name_placeholder")}
                  value={groupForm.name}
                  autoFocus
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-group-type`} className="field-label">
                  {t("menu.group_type")}
                </label>
                <select
                  id={`${formId}-group-type`}
                  className="form-input"
                  value={groupForm.type}
                  onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value as OptionGroupType })}
                >
                  <option value="radio">{t("options.type_radio")}</option>
                  <option value="checkbox">{t("options.type_checkbox")}</option>
                </select>
              </div>
              <label
                htmlFor={`${formId}-group-required`}
                style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
              >
                <input
                  id={`${formId}-group-required`}
                  type="checkbox"
                  checked={groupForm.isRequired}
                  onChange={(e) => setGroupForm({ ...groupForm, isRequired: e.target.checked })}
                  style={{ accentColor: "var(--accent-primary)" }}
                />
                {t("options.required")}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" className="btn-primary btn-sm" disabled={saving} style={{ flex: 1 }}>
                  <Busy busy={saving} label={t("common.save")} busyLabel={t("common.saving")} />
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setIsGroupFormOpen(false)}
                  style={{ flex: 1 }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }} aria-busy="true">
              <span className="sr-only">{t("common.loading")}</span>
              {[0, 1].map((i) => (
                <div key={i} className="skeleton" style={{ height: "120px" }} />
              ))}
            </div>
          ) : loadError ? (
            <div className="notice notice-error" role="alert" style={{ flexDirection: "column" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <AlertCircle size={18} />
                <span>{loadError}</span>
              </div>
              <button type="button" className="btn-outline btn-sm" onClick={() => void fetchGroups()}>
                {t("common.retry")}
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 16px" }}>
              <p>{t("options.empty")}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {groups.length > 1 && <p className="field-hint">{t("menu.sort_hint")}</p>}
              {groups.map((group) => {
                const options = group.options ?? [];
                return (
                  <div
                    key={group.id}
                    data-drag-card
                    className={[
                      dragging?.kind === "group" && dragging.id === group.id ? "is-dragging" : "",
                      dragging?.kind === "group" ? dropClass(groups, group.id) : "",
                    ].join(" ")}
                    onDragOver={(e) => {
                      const source = draggingRef.current;
                      if (source?.kind !== "group" || source.id === group.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropTargetId(group.id);
                    }}
                    onDrop={(e) => {
                      const source = draggingRef.current;
                      if (source?.kind !== "group") return;
                      e.preventDefault();
                      clearDrag();
                      void moveGroup(source.id, groups.findIndex((g) => g.id === group.id));
                    }}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <SortHandle
                        label={group.name}
                        disabled={groups.length < 2}
                        onDragStart={(e) => {
                          beginRowDrag(e, group.id);
                          draggingRef.current = { kind: "group", id: group.id };
                          setDragging(draggingRef.current);
                        }}
                        onDragEnd={clearDrag}
                        onMove={(delta) =>
                          void moveGroup(group.id, groups.findIndex((g) => g.id === group.id) + delta)
                        }
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontWeight: 600, fontSize: "15px", margin: 0 }}>{group.name}</h3>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                          {group.type === "radio" ? t("options.type_radio_short") : t("options.type_checkbox_short")}
                          {" • "}
                          {group.isRequired ? t("options.required") : t("options.optional")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setEditingGroup(group);
                          setGroupForm({ name: group.name, type: group.type, isRequired: group.isRequired });
                          setIsGroupFormOpen(true);
                          panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        aria-label={iconButtonLabel("options.edit_aria", group.name)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => void deleteGroup(group)}
                        aria-label={iconButtonLabel("options.delete_aria", group.name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ padding: "8px 12px 12px" }}>
                      {options.map((option) => (
                        <div
                          key={option.id}
                          data-drag-card
                          className={[
                            dragging?.kind === "option" && dragging.id === option.id ? "is-dragging" : "",
                            dragging?.kind === "option" && dragging.groupId === group.id
                              ? dropClass(options, option.id)
                              : "",
                          ].join(" ")}
                          onDragOver={(e) => {
                            const source = draggingRef.current;
                            if (source?.kind !== "option" || source.groupId !== group.id || source.id === option.id) {
                              return;
                            }
                            // Otherwise the group card claims it as a group drop.
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = "move";
                            setDropTargetId(option.id);
                          }}
                          onDrop={(e) => {
                            const source = draggingRef.current;
                            if (source?.kind !== "option" || source.groupId !== group.id) return;
                            e.preventDefault();
                            e.stopPropagation();
                            clearDrag();
                            void moveOption(group.id, source.id, options.findIndex((o) => o.id === option.id));
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 0",
                            borderBottom: "1px dashed var(--border-color)",
                          }}
                        >
                          <SortHandle
                            label={option.name}
                            size={16}
                            disabled={options.length < 2}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              beginRowDrag(e, option.id);
                              draggingRef.current = { kind: "option", id: option.id, groupId: group.id };
                              setDragging(draggingRef.current);
                            }}
                            onDragEnd={clearDrag}
                            onMove={(delta) =>
                              void moveOption(
                                group.id,
                                option.id,
                                options.findIndex((o) => o.id === option.id) + delta,
                              )
                            }
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "14px", fontWeight: 500 }}>{option.name}</span>
                            {Number(option.price) > 0 && (
                              <span
                                className="force-ltr"
                                style={{ fontSize: "14px", color: "var(--text-secondary)", marginInlineStart: "8px" }}
                              >
                                +{money.format(option.price)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              setActiveGroupId(group.id);
                              setEditingOption(option);
                              setOptionForm({ name: option.name, price: String(option.price ?? "") });
                              setIsOptionFormOpen(true);
                            }}
                            aria-label={iconButtonLabel("options.edit_aria", option.name)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            onClick={() => void deleteOption(group.id, option)}
                            aria-label={iconButtonLabel("options.delete_aria", option.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {isOptionFormOpen && activeGroupId === group.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveOption();
                          }}
                          style={{
                            marginTop: "12px",
                            padding: "12px",
                            backgroundColor: "var(--bg-sunken)",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", gap: "8px" }}>
                            <label htmlFor={`${formId}-option-name`} className="sr-only">
                              {t("options.option_name_placeholder")}
                            </label>
                            <input
                              id={`${formId}-option-name`}
                              type="text"
                              className="form-input"
                              placeholder={t("options.option_name_placeholder")}
                              value={optionForm.name}
                              autoFocus
                              style={{ flex: 1, minWidth: 0 }}
                              onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                            />
                            <label htmlFor={`${formId}-option-price`} className="sr-only">
                              {t("options.price_placeholder")}
                            </label>
                            <input
                              id={`${formId}-option-price`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={money.decimals === 0 ? "1" : "0.01"}
                              className="form-input force-ltr"
                              placeholder={money.code || t("options.price_placeholder")}
                              style={{ width: "96px", flexShrink: 0 }}
                              value={optionForm.price}
                              onChange={(e) => setOptionForm({ ...optionForm, price: e.target.value })}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                              <Busy busy={saving} label={t("common.save")} busyLabel={t("common.saving")} />
                            </button>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              onClick={() => setIsOptionFormOpen(false)}
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveGroupId(group.id);
                            setEditingOption(null);
                            setOptionForm({ name: "", price: "" });
                            setIsOptionFormOpen(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent-primary)",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "10px",
                            padding: 0,
                          }}
                        >
                          <Plus size={14} /> {t("options.add_option")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
