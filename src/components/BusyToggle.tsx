"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { getBusy, setBusy, type BusyState } from "@/services/api/settings";
import { getApiErrorMessage } from "@/services/api/errors";
import { intlLocale, useI18n, type MessageKey } from "@/lib/i18n";
import { useRestaurant } from "@/lib/restaurantContext";

// The API caps `until` at 24 hours out, so the longest timed pause is well inside it.
const DURATIONS: { minutes: number | null; key: MessageKey }[] = [
  { minutes: 15, key: "shell.busy_15m" },
  { minutes: 30, key: "shell.busy_30m" },
  { minutes: 60, key: "shell.busy_1h" },
  { minutes: 120, key: "shell.busy_2h" },
  { minutes: null, key: "shell.busy_manual" },
];

/**
 * Busy mode: "stop taking new orders for a while" without touching the
 * opening hours. The backend clears `until` itself when it lapses, so an
 * owner can pause for 30 minutes and walk away — nothing here has to stay
 * open to resume.
 */
export default function BusyToggle({
  initial,
  compact = false,
}: {
  initial?: BusyState;
  /** Dot only + short label, for the phone header. */
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const { toast } = useFeedback();
  const { restaurant, setRestaurant } = useRestaurant();
  const [state, setLocalState] = useState<BusyState>(initial ?? { busy: false, until: null });

  // Mirrored into the shared profile so the home page's open/busy badge (and
  // the other copy of this toggle, phone header vs sidebar) follow along.
  const restaurantRef = useRef(restaurant);
  useEffect(() => {
    restaurantRef.current = restaurant;
  });
  const setState = useCallback(
    (next: BusyState) => {
      setLocalState(next);
      const current = restaurantRef.current;
      if (current && (Boolean(current.isBusy) !== next.busy || (current.busyUntil ?? null) !== next.until)) {
        setRestaurant({
          ...current,
          isBusy: next.busy,
          busyUntil: next.until,
          // Accepting = open and not busy; resuming only restores what the hours allow.
          isAcceptingOrders: next.busy ? false : (current.isOpen ?? current.isAcceptingOrders),
        });
      }
    },
    [setRestaurant],
  );
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(30);
  const [reason, setReason] = useState("");

  const refresh = useCallback(() => {
    getBusy().then(setState).catch(() => {
      /* the profile's copy stands in until the next try */
    });
  }, [setState]);

  // Re-read on mount and whenever the tab comes back: the server may have
  // lapsed the pause while the laptop was asleep.
  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // A timed pause flips back on screen when it lapses, without waiting on a poll.
  useEffect(() => {
    if (!state.busy || !state.until) return;
    const ms = new Date(state.until).getTime() - Date.now();
    if (ms <= 0) {
      refresh();
      return;
    }
    const timer = window.setTimeout(refresh, Math.min(ms + 1500, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [state, refresh]);

  const untilLabel = state.until
    ? new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" }).format(
        new Date(state.until),
      )
    : null;

  const resume = async () => {
    setSaving(true);
    try {
      setState(await setBusy({ busy: false }));
      toast.success(t("shell.busy_resumed"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("common.error_generic")));
    } finally {
      setSaving(false);
    }
  };

  const pause = async () => {
    setSaving(true);
    try {
      const next = await setBusy({
        busy: true,
        ...(minutes ? { until: new Date(Date.now() + minutes * 60_000).toISOString() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setState(next);
      setDialogOpen(false);
      setReason("");
      toast.info(t("shell.busy_paused_toast"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("common.error_generic")));
    } finally {
      setSaving(false);
    }
  };

  const label = state.busy
    ? untilLabel
      ? t("shell.busy_until", { time: untilLabel })
      : t("shell.busy_paused")
    : t("shell.busy_accepting");

  return (
    <>
      <button
        type="button"
        className="busy-toggle"
        data-busy={state.busy}
        disabled={saving}
        onClick={() => (state.busy ? void resume() : setDialogOpen(true))}
        title={state.busy ? t("shell.busy_resume_hint") : t("shell.busy_pause_hint")}
      >
        <span className="dot" aria-hidden="true" />
        {compact ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span>{label}</span>
        )}
        {compact && <span>{state.busy ? t("shell.busy_short_paused") : t("shell.busy_short_open")}</span>}
      </button>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("shell.busy_dialog_title")}
        maxWidth={460}
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={() => void pause()} disabled={saving}>
              <Busy busy={saving} label={t("shell.busy_confirm")} />
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>{t("shell.busy_dialog_body")}</p>
        <div className="field">
          <span className="field-label">{t("shell.busy_for")}</span>
          <div className="choice-grid">
            {DURATIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={minutes === option.minutes}
                onClick={() => setMinutes(option.minutes)}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="busy-reason">
            {t("shell.busy_reason")} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({t("common.optional")})</span>
          </label>
          <input
            id="busy-reason"
            className="form-input"
            value={reason}
            maxLength={120}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("shell.busy_reason_placeholder")}
          />
        </div>
      </Modal>
    </>
  );
}
