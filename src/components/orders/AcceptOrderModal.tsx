"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy } from "@/components/ui/Feedback";
import { PREP_TIME_MAX, PREP_TIME_MIN, type RestaurantOrder } from "@/services/api/orders";
import { useI18n } from "@/lib/i18n";
import { orderCode } from "./orderMeta";
import styles from "./orders.module.css";

const PREP_PRESETS = [10, 15, 20, 30, 45] as const;
const PREP_STORAGE_KEY = "nowlny_last_prep_minutes";
const DEFAULT_PREP = 20;

const isValidPrep = (value: number) =>
  Number.isInteger(value) && value >= PREP_TIME_MIN && value <= PREP_TIME_MAX;

/** The kitchen usually quotes the same time all shift, so start from the last one. */
function readLastPrep(): number {
  try {
    const stored = Number(window.localStorage.getItem(PREP_STORAGE_KEY));
    return isValidPrep(stored) ? stored : DEFAULT_PREP;
  } catch {
    return DEFAULT_PREP;
  }
}

function rememberPrep(value: number) {
  try {
    window.localStorage.setItem(PREP_STORAGE_KEY, String(value));
  } catch {
    /* private mode / blocked storage — the choice just isn't remembered */
  }
}

/**
 * Accept with a committed prep time — it feeds the customer's ETA
 * (accepted_at + prep + travel). Mounted per order, so the initial state is
 * read fresh from storage each time it opens.
 */
export default function AcceptOrderModal({
  order,
  busy,
  onConfirm,
  onClose,
}: {
  order: RestaurantOrder;
  busy: boolean;
  onConfirm: (prepTimeMinutes: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [initial] = useState(readLastPrep);
  const [minutes, setMinutes] = useState<number>(initial);
  const [custom, setCustom] = useState(
    (PREP_PRESETS as readonly number[]).includes(initial) ? "" : String(initial),
  );
  const [customMode, setCustomMode] = useState(custom !== "");

  const value = customMode ? Number(custom) : minutes;
  const valid = isValidPrep(value);

  const submit = () => {
    if (!valid || busy) return;
    rememberPrep(value);
    onConfirm(value);
  };

  return (
    <Modal
      open
      stacked
      onClose={onClose}
      dismissible={!busy}
      maxWidth={440}
      title={t("ordersx.accept_title", { code: orderCode(order) })}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: "var(--success)" }}
            onClick={submit}
            disabled={!valid || busy}
          >
            <Busy
              busy={busy}
              label={valid ? t("ordersx.accept_confirm", { count: value }) : t("orders.accept")}
              busyLabel={t("ordersx.accepting")}
            />
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        {t("ordersx.accept_body")}
      </p>
      <div className="field" role="group" aria-labelledby="accept-prep-label">
        <span id="accept-prep-label" className="field-label">
          {t("ordersx.prep_label")}
        </span>
        <div className={styles.chips}>
          {PREP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.chip}
              aria-pressed={!customMode && minutes === preset}
              onClick={() => {
                setCustomMode(false);
                setMinutes(preset);
              }}
            >
              {t("ordersx.prep_minutes", { count: preset })}
            </button>
          ))}
          <button
            type="button"
            className={styles.chip}
            aria-pressed={customMode}
            onClick={() => {
              setCustomMode(true);
              if (!custom) setCustom(String(minutes));
            }}
          >
            {t("ordersx.prep_custom")}
          </button>
        </div>
      </div>
      {customMode && (
        <label className="field">
          <span className="field-label">{t("ordersx.prep_custom_label")}</span>
          <input
            className="form-input"
            type="number"
            inputMode="numeric"
            min={PREP_TIME_MIN}
            max={PREP_TIME_MAX}
            step={1}
            value={custom}
            autoFocus
            aria-invalid={!valid}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          {!valid && <span className="field-hint" style={{ color: "var(--error)" }}>{t("ordersx.prep_invalid")}</span>}
        </label>
      )}
    </Modal>
  );
}
