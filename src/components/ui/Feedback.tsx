"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { useI18n } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Toasts and confirm dialogs.

   The dashboard used `alert()` and `confirm()` in a dozen places: they block
   the tab, can't be translated or themed, and on iOS they show the site's URL
   as the title. `useFeedback()` gives every screen the same two calls instead:

     toast.success(t("menu.saved"))
     if (await confirm({ title, message, danger: true })) { ... }
--------------------------------------------------------------------------- */

type ToastTone = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button — for deletes and other things that can't be undone. */
  danger?: boolean;
}

interface FeedbackApi {
  toast: Record<ToastTone, (message: string) => void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_MS: Record<ToastTone, number> = { success: 3500, info: 4500, error: 6500 };

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = ++nextId.current;
    // Keep the stack short; a burst of failures shouldn't cover the page.
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_MS[tone]);
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  }, []);

  const api = useMemo<FeedbackApi>(
    () => ({
      toast: {
        success: (message) => push("success", message),
        error: (message) => push("error", message),
        info: (message) => push("info", message),
      },
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          // A second confirm while one is open answers the first with "no".
          resolver.current?.(false);
          resolver.current = resolve;
          setPending(options);
        }),
    }),
    [push],
  );

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        maxWidth={420}
        stacked
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => settle(false)}>
              {pending?.cancelLabel ?? t("common.cancel")}
            </button>
            <button
              type="button"
              className={pending?.danger ? "btn-danger" : "btn-primary"}
              onClick={() => settle(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? (pending?.danger ? t("common.delete") : t("common.confirm"))}
            </button>
          </>
        }
      >
        {pending?.message && (
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {pending.message}
          </p>
        )}
      </Modal>

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              <Icon size={18} />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackContext);
  if (!api) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return api;
}

/** Inline spinner + label for a button that is mid-request. */
export function Busy({ busy, label, busyLabel }: { busy: boolean; label: ReactNode; busyLabel?: ReactNode }) {
  return busy ? (
    <>
      <Loader2 size={18} className="animate-spin" />
      {busyLabel ?? label}
    </>
  ) : (
    <>{label}</>
  );
}
