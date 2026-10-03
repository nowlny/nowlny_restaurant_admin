"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The element focused before the current one. React's `autoFocus` moves focus
 * into a modal during commit — before any effect here runs — so by the time
 * the modal looks, `document.activeElement` is already its own button, and
 * "give focus back to the opener" would target a node about to unmount.
 */
let previousFocus: HTMLElement | null = null;
let currentFocus: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target === currentFocus) return;
      previousFocus = currentFocus;
      currentFocus = event.target as HTMLElement;
    },
    true,
  );
}

/**
 * The one modal shell.
 *
 * Each screen used to hand-roll its own overlay: four different z-indexes, no
 * gutter on phones, and only the driver map closed on Escape. This one closes
 * on Escape and on a backdrop click, traps Tab inside the panel, hands focus
 * back to whatever opened it, locks page scroll, and turns into a bottom sheet
 * under 640px (see `.modal-*` in globals.css).
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 560,
  stacked = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  /** Above another modal — a confirm dialog opened from inside a form. */
  stacked?: boolean;
  /** False while a save is in flight, so Escape can't abandon it half-done. */
  dismissible?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref so the open-effect doesn't re-run (and steal focus)
  // every time the parent passes a fresh closure.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active = document.activeElement as HTMLElement | null;
    const autoFocused = Boolean(panel && active && panel.contains(active));
    const opener = autoFocused ? previousFocus : active;
    // Hidden file inputs match a plain `input` selector but can't take
    // focus, which left focus outside the panel and broke the Tab trap.
    const first = Array.from(
      panel?.querySelectorAll<HTMLElement>(
        "[autofocus], input:not([type=hidden]):not([type=file]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      ) ?? [],
    ).find((el) => el.offsetParent !== null && !el.closest("[hidden]"));
    if (!autoFocused) (first ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    // Bound to the panel, so only the modal that holds focus — the topmost —
    // answers Escape.
    panel?.addEventListener("keydown", onKey);

    return () => {
      panel?.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`modal-overlay${stacked ? " modal-stacked" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={!dismissible}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
