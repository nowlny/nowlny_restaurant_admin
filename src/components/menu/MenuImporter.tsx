"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FolderPlus,
  KeyRound,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { apiClient } from "@/services/api/client";
import { MenuService, readId, type MenuSection } from "@/services/api/menu";
import type { ParsedMenu, ParsedOptionGroup } from "@/lib/menuParsing";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useMenuMoney } from "@/lib/menuMoney";

/**
 * What a serverless function will accept as a request body is ~4.5 MB, and
 * the file travels base64-encoded (a third bigger). Past this the upload
 * failed with an opaque 413 after the owner had already waited for it.
 */
const MAX_SCAN_BYTES = 3 * 1024 * 1024;

/** Formats Gemini reads inline. Spreadsheets (.xlsx) are not among them. */
const SCAN_ACCEPT = ".pdf,.csv,.png,.jpg,.jpeg,.webp,application/pdf,text/csv,image/png,image/jpeg,image/webp";

/** The key the previous version kept in localStorage, in plain text. */
const LEGACY_KEY_STORAGE = "nowlny_gemini_key";

const STEPS: { from: number; key: MessageKey }[] = [
  { from: 0, key: "menu.import_step_upload" },
  { from: 25, key: "menu.import_step_reading" },
  { from: 55, key: "menu.import_step_dishes" },
  { from: 80, key: "menu.import_step_structuring" },
];

interface ScanError {
  message: string;
  /** The server has no Gemini key — the owner can still use their own. */
  missingKey?: boolean;
}

const mimeFor = (file: File): string => {
  if (file.type) return file.type;
  // Some systems report CSV with no type at all.
  return /\.csv$/i.test(file.name) ? "text/csv" : "application/octet-stream";
};

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

/**
 * Whether an option group's nested `options` were actually stored.
 *
 * The create DTO documents nesting, but a deployment that ignores it leaves
 * every imported group empty — so the first group of an import is checked,
 * and the answer reused for the rest.
 */
async function optionsLanded(
  menuItemId: string,
  groupId: string,
  created: { options?: unknown } | null,
  expected: number,
): Promise<boolean> {
  if (Array.isArray(created?.options)) return created.options.length >= expected;
  const groups = await MenuService.getOptionGroupsByItem(menuItemId).catch(() => []);
  const saved = groups.find((group) => readId(group) === groupId);
  return Array.isArray(saved?.options) && saved.options.length >= expected;
}

export default function MenuImporter({
  sections,
  onImported,
  defaultOpen,
}: {
  /** The live menu, so re-importing reuses sections instead of duplicating them. */
  sections: MenuSection[];
  /** Called once the import has written everything; the page refetches. */
  onImported: () => Promise<void> | void;
  defaultOpen: boolean;
}) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const money = useMenuMoney();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(defaultOpen);
  const [fileName, setFileName] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParsedMenu | null>(null);
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepth = useRef(0);

  const [showKey, setShowKey] = useState(false);
  // Held in memory only: a key typed here is for this session's scans.
  const [ownKey, setOwnKey] = useState("");

  const [integrating, setIntegrating] = useState<{ done: number; total: number } | null>(null);

  // The previous version stored an owner's Gemini key in localStorage, where
  // any script on the origin could read it. Clear it rather than reuse it.
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_KEY_STORAGE);
    } catch {
      /* storage blocked — nothing to clean up */
    }
  }, []);

  const scan = async (file: File) => {
    if (file.size > MAX_SCAN_BYTES) {
      setScanError({
        message: t("menu.import_too_large", { size: (file.size / (1024 * 1024)).toFixed(1) }),
      });
      return;
    }

    setFileName(file.name);
    setLastFile(file);
    setParsed(null);
    setScanError(null);
    setIsParsing(true);
    setProgress(5);

    // The scan is one long request with no real progress to report, so the
    // bar creeps towards 95% to show the page hasn't frozen.
    const timer = window.setInterval(() => {
      setProgress((current) => (current < 95 ? current + Math.max(1, Math.round((95 - current) / 12)) : current));
    }, 400);

    try {
      const fileData = await readAsBase64(file);
      // Through `apiClient` with the origin as base: it attaches the bearer
      // token the route now requires, and refreshes an expired one first.
      const { data } = await apiClient.post<ParsedMenu>(
        "/api/parse-menu",
        { fileData, mimeType: mimeFor(file), ...(ownKey.trim() ? { customApiKey: ownKey.trim() } : {}) },
        { baseURL: "", timeout: 90_000 },
      );
      setProgress(100);
      const categories = Array.isArray(data?.categories) ? data.categories : [];
      if (categories.length === 0) {
        setScanError({ message: t("menu.import_nothing_found") });
      } else {
        setParsed({ categories });
      }
    } catch (error: unknown) {
      const body = axios.isAxiosError(error)
        ? (error.response?.data as { code?: string; error?: string } | undefined)
        : undefined;
      const missingKey = body?.code === "missing_key";
      if (missingKey) setShowKey(true);
      setScanError({
        message: missingKey ? t("menu.import_missing_key") : body?.error || t("parser.scan_failed"),
        missingKey,
      });
    } finally {
      window.clearInterval(timer);
      setIsParsing(false);
    }
  };

  const pickFile = (file: File | undefined) => {
    if (file && !isParsing && !integrating) void scan(file);
  };

  const discard = () => {
    setParsed(null);
    setFileName("");
    setLastFile(null);
  };

  /** Each group with its choices in one request; one at a time only if that didn't stick. */
  const writeGroups = async (
    menuItemId: string,
    groups: ParsedOptionGroup[],
    nested: { works: boolean | null },
  ): Promise<number> => {
    let failed = 0;
    for (const [index, group] of groups.entries()) {
      try {
        const options = group.options.map((option, i) => ({ ...option, sortOrder: i }));
        const created = await MenuService.createOptionGroup({
          menuItemId,
          name: group.name,
          type: group.type,
          isRequired: group.isRequired,
          sortOrder: index,
          ...(nested.works === false ? {} : { options }),
        });
        const groupId = readId(created);
        if (!groupId) throw new Error("option group created without an id");

        if (nested.works === null) {
          nested.works = await optionsLanded(menuItemId, groupId, created, options.length);
        }
        if (!nested.works) {
          for (const option of options) await MenuService.addOptionToGroup(groupId, option);
        }
      } catch {
        failed += 1;
      }
    }
    return failed;
  };

  const approve = async () => {
    if (!parsed) return;
    const total = parsed.categories.reduce((sum, category) => sum + category.items.length, 0);
    setIntegrating({ done: 0, total });

    const known = [...sections];
    const nested = { works: null as boolean | null };
    let createdItems = 0;
    let failedItems = 0;
    let failedGroups = 0;
    let done = 0;

    for (const category of parsed.categories) {
      let section = known.find((s) => s.name.trim().toLowerCase() === category.name.trim().toLowerCase());

      if (!section) {
        try {
          const created = await MenuService.createSection({ name: category.name, sortOrder: known.length });
          const id = readId(created);
          if (id) {
            section = { ...(created as MenuSection), id, name: category.name, items: [] };
            known.push(section);
          }
        } catch {
          /* counted below as failed dishes */
        }
      }

      if (!section) {
        failedItems += category.items.length;
        done += category.items.length;
        setIntegrating({ done, total });
        continue;
      }

      // After whatever the section already holds, so a re-import appends.
      const offset = section.items?.length ?? 0;
      for (const [index, item] of category.items.entries()) {
        try {
          const created = await MenuService.createItem({
            sectionId: section.id,
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            price: item.price,
            isAvailable: true,
            sortOrder: offset + index,
          });
          const itemId = readId(created);
          if (!itemId) throw new Error("dish created without an id");
          createdItems += 1;
          if (item.optionGroups?.length) {
            failedGroups += await writeGroups(itemId, item.optionGroups, nested);
          }
        } catch {
          failedItems += 1;
        }
        done += 1;
        setIntegrating({ done, total });
      }
    }

    try {
      await onImported();
    } finally {
      setIntegrating(null);
    }

    if (createdItems > 0) toast.success(t("menu.import_done", { count: createdItems }));
    if (failedItems > 0 || failedGroups > 0) {
      toast.error(t("menu.import_partial", { items: failedItems, groups: failedGroups }));
    }
    if (failedItems === 0) discard();
  };

  const dishCount = parsed?.categories.reduce((sum, c) => sum + c.items.length, 0) ?? 0;
  const step = [...STEPS].reverse().find((s) => progress >= s.from) ?? STEPS[0];
  const busy = isParsing || integrating !== null;

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }} aria-labelledby={`${fieldId}-title`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${fieldId}-body`}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "20px 24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          textAlign: "start",
        }}
      >
        <span
          style={{
            padding: "10px",
            backgroundColor: "var(--accent-2-bg)",
            color: "var(--accent-2)",
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            flexShrink: 0,
          }}
        >
          <Sparkles size={22} aria-hidden />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span id={`${fieldId}-title`} style={{ display: "block", fontSize: "17px", fontWeight: 700 }}>
            {t("parser.title")}
          </span>
          <span style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)" }}>
            {t("parser.subtitle")}
          </span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden
          style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div
          id={`${fieldId}-body`}
          style={{
            padding: "0 24px 24px",
            display: "grid",
            gridTemplateColumns: parsed ? "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" : "1fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
            {scanError && (
              <div className="notice notice-error" role="alert" style={{ flexDirection: "column" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <p style={{ fontWeight: 700, margin: 0 }}>{t("menu.import_failed_title")}</p>
                    <p style={{ margin: 0, color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
                      {scanError.message}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {lastFile && (
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => void scan(lastFile)}
                      disabled={busy || (scanError.missingKey && !ownKey.trim())}
                    >
                      {t("parser.retry")}
                    </button>
                  )}
                  <button type="button" className="btn-outline btn-sm" onClick={() => setScanError(null)}>
                    {t("parser.dismiss")}
                  </button>
                </div>
              </div>
            )}

            <label
              htmlFor={`${fieldId}-file`}
              onDragEnter={(e) => {
                e.preventDefault();
                dragDepth.current += 1;
                if (!busy) setIsDragActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setIsDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dragDepth.current = 0;
                setIsDragActive(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "32px 16px",
                border: `2px dashed ${isDragActive ? "var(--accent-2)" : "var(--border-color)"}`,
                borderRadius: "var(--radius-lg)",
                backgroundColor: isDragActive ? "var(--accent-2-bg)" : "var(--bg-sunken)",
                cursor: busy ? "not-allowed" : "pointer",
                textAlign: "center",
                transition: "border-color 0.2s ease, background-color 0.2s ease",
              }}
            >
              <UploadCloud size={40} color="var(--text-muted)" aria-hidden />
              <span style={{ fontWeight: 600 }}>{t("parser.drop_title")}</span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{t("menu.import_hint")}</span>
              {fileName && !isParsing && (
                <span style={{ fontSize: "13px", color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                  {fileName}
                </span>
              )}
              <span className="btn-outline btn-sm" style={{ marginTop: "8px" }} aria-hidden>
                {t("parser.browse")}
              </span>
              <input
                id={`${fieldId}-file`}
                ref={inputRef}
                type="file"
                accept={SCAN_ACCEPT}
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset so picking the same file again still fires.
                  e.target.value = "";
                  pickFile(file);
                }}
              />
            </label>

            {isParsing && (
              <div
                role="status"
                style={{
                  padding: "14px 16px",
                  backgroundColor: "var(--accent-2-bg)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--accent-2)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Loader2 size={16} className="animate-spin" aria-hidden /> {t(step.key)}
                  </span>
                  <span className="force-ltr">{progress}%</span>
                </div>
                <div
                  style={{ height: "6px", backgroundColor: "var(--bg-surface)", borderRadius: "4px", overflow: "hidden" }}
                >
                  <div
                    style={{
                      height: "100%",
                      backgroundColor: "var(--accent-2)",
                      width: `${progress}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                aria-expanded={showKey}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <KeyRound size={14} aria-hidden /> {t("menu.import_own_key")}
              </button>
              {showKey && (
                <div className="field" style={{ marginTop: "10px" }}>
                  <label htmlFor={`${fieldId}-key`} className="field-label">
                    {t("parser.credentials")}
                  </label>
                  <input
                    id={`${fieldId}-key`}
                    type="password"
                    autoComplete="off"
                    className="form-input force-ltr"
                    placeholder={t("parser.api_key_placeholder")}
                    value={ownKey}
                    onChange={(e) => setOwnKey(e.target.value)}
                  />
                  <p className="field-hint">{t("menu.import_own_key_hint")}</p>
                </div>
              )}
            </div>
          </div>

          {parsed && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <span
                    style={{
                      padding: "8px",
                      backgroundColor: "var(--success-bg)",
                      color: "var(--success)",
                      borderRadius: "var(--radius-sm)",
                      display: "inline-flex",
                    }}
                  >
                    <Check size={18} aria-hidden />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>{t("parser.preview_title")}</h3>
                    <p
                      style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, overflowWrap: "anywhere" }}
                    >
                      {t("parser.source", { name: fileName })}
                    </p>
                  </div>
                </div>
                <span className="badge badge-success">
                  {t("menu.import_summary", { dishes: dishCount, sections: parsed.categories.length })}
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: "420px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {parsed.categories.map((category, ci) => (
                  <div key={ci}>
                    <h4
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: "var(--accent-2)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        margin: "0 0 10px",
                      }}
                    >
                      <FolderPlus size={16} aria-hidden /> {t("parser.category", { name: category.name })}
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {category.items.map((item, ii) => (
                        <div
                          key={ii}
                          style={{
                            padding: "12px",
                            backgroundColor: "var(--bg-elevated)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "12px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "14px", margin: 0 }}>{item.name}</p>
                            {item.description && (
                              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                                {item.description}
                              </p>
                            )}
                            {item.optionGroups?.map((group, gi) => (
                              <div key={gi} style={{ marginTop: "8px" }}>
                                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-2)", margin: 0 }}>
                                  {group.name}
                                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                                    {" · "}
                                    {group.type === "radio"
                                      ? t("options.type_radio_short")
                                      : t("options.type_checkbox_short")}
                                    {group.isRequired ? ` · ${t("options.required")}` : ""}
                                  </span>
                                </p>
                                <ul
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text-secondary)",
                                    paddingInlineStart: "16px",
                                    margin: "2px 0 0",
                                  }}
                                >
                                  {group.options.map((option, oi) => (
                                    <li key={oi}>
                                      {option.name}
                                      {option.price > 0 && (
                                        <span className="force-ltr"> (+{money.format(option.price)})</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                          <span
                            className="force-ltr"
                            style={{ fontWeight: 800, color: "var(--accent-primary)", whiteSpace: "nowrap" }}
                          >
                            {money.format(item.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {integrating && (
                <p role="status" className="field-hint" style={{ marginTop: "12px" }}>
                  {t("menu.import_progress", { done: integrating.done, total: integrating.total })}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: "16px",
                  marginTop: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={discard}
                  className="btn-outline"
                  style={{ flex: "1 1 120px" }}
                  disabled={busy}
                >
                  {t("parser.discard")}
                </button>
                <button
                  type="button"
                  onClick={() => void approve()}
                  className="btn-primary"
                  style={{ flex: "2 1 200px", backgroundColor: "var(--accent-2)" }}
                  disabled={busy}
                >
                  <Busy
                    busy={integrating !== null}
                    label={
                      <>
                        <Check size={18} aria-hidden /> {t("parser.approve")}
                      </>
                    }
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
