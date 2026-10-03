"use client";

import React, { useId, useRef, useState } from "react";
import { ImageOff, Image as ImageIcon, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getApiErrorMessage } from "@/services/api/errors";

/* ---------------------------------------------------------------------------
   Image picker.

   Dish photos used to be settable only by pasting a URL hosted somewhere else,
   so an owner with the picture on their phone had no way to attach it. This
   takes a file — dropped, browsed, or pasted from the clipboard — hands it to
   `upload`, and keeps the hosted URL it returns. Pasting a URL still works,
   behind a toggle.

   Ported from the super-admin panel's picker, restyled with this dashboard's
   tokens so it follows the theme.
--------------------------------------------------------------------------- */

export interface ImagePickerProps {
  /** Current image URL ("" when unset). */
  value: string;
  onChange: (url: string) => void;
  /** Sends the file to the API and resolves with its hosted URL. */
  upload: (file: File) => Promise<string>;
  /** Client-side guard; return a message to reject the file, or null to accept. */
  validate?: (file: File) => string | null;
  accept?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Raised when an upload starts and finishes, so a form can block submit. */
  onUploadingChange?: (isUploading: boolean) => void;
}

const smallLink: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

export default function ImagePicker({
  value,
  onChange,
  upload,
  validate,
  accept = "image/*",
  label,
  hint,
  disabled = false,
  onUploadingChange,
}: ImagePickerProps) {
  const { t } = useI18n();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);
  // Keyed by URL rather than a boolean, so picking a new photo clears the
  // "didn't load" state without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const previewFailed = !!value && failedUrl === value;

  // dragenter/dragleave fire for every child element, so a plain boolean
  // flickers the highlight off as soon as the pointer crosses the icon.
  const dragDepth = useRef(0);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handleFile = async (file: File) => {
    const message = validate?.(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      onChange(await upload(file));
      setShowUrlField(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("menu.image_upload_failed")));
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file after an error fires onChange again.
    e.target.value = "";
    if (file) void handleFile(file);
  };

  const isBusy = disabled || isUploading;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragActive(false);
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  /** Ctrl/Cmd-V of a screenshot straight into the focused drop zone. */
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isBusy) return;
    const file = Array.from(e.clipboardData.files)[0];
    if (file) {
      e.preventDefault();
      void handleFile(file);
    }
  };

  const openPicker = () => {
    if (!isBusy) inputRef.current?.click();
  };

  return (
    <div className="field">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <label htmlFor={`${fieldId}-file`} className="field-label">
          {label ?? t("menu.image_label")}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlField((prev) => !prev)}
          aria-expanded={showUrlField}
          style={{ ...smallLink, color: "var(--text-secondary)" }}
        >
          <Link2 size={14} aria-hidden />
          {showUrlField ? t("menu.image_hide_url") : t("menu.image_use_url")}
        </button>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!isBusy) setIsDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragActive(false);
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "12px",
          borderRadius: "var(--radius-md)",
          border: `2px dashed ${isDragActive ? "var(--accent-primary)" : "var(--border-color)"}`,
          backgroundColor: isDragActive ? "var(--accent-light)" : "var(--bg-sunken)",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            flexShrink: 0,
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          {value && !previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- hosted on the API's CDN, not a Next image domain
            <img
              src={value}
              alt=""
              width={72}
              height={72}
              onError={() => setFailedUrl(value)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : previewFailed ? (
            <ImageOff size={22} aria-hidden />
          ) : (
            <ImageIcon size={22} aria-hidden />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
            {previewFailed ? t("menu.image_preview_failed") : (hint ?? t("menu.image_hint"))}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={openPicker}
              disabled={isBusy}
            >
              {isUploading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <UploadCloud size={14} aria-hidden />
              )}
              {isUploading
                ? t("menu.image_uploading")
                : value
                  ? t("menu.image_replace")
                  : t("menu.image_upload")}
            </button>
            {value && !isUploading && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setError(null);
                }}
                disabled={disabled}
                style={{ ...smallLink, color: "var(--error)" }}
              >
                <Trash2 size={14} aria-hidden />
                {t("menu.image_remove")}
              </button>
            )}
          </div>
        </div>

        <input
          id={`${fieldId}-file`}
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={isBusy}
          className="sr-only"
        />
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--error)" }}>
          {error}
        </p>
      )}

      {showUrlField && (
        <div className="field" style={{ gap: "6px" }}>
          <label htmlFor={`${fieldId}-url`} className="field-label">
            {t("item.image_url")}
          </label>
          <input
            id={`${fieldId}-url`}
            type="url"
            inputMode="url"
            className="form-input force-ltr"
            placeholder="https://…"
            value={value}
            disabled={isBusy}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
