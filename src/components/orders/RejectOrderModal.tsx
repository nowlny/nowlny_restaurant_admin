"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Busy } from "@/components/ui/Feedback";
import type { RestaurantOrder } from "@/services/api/orders";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { orderCode } from "./orderMeta";
import styles from "./orders.module.css";

/**
 * Same presets, same order, as the mobile app's NewOrderAlert. The API takes a
 * free-text `reason` (RejectOrderDto) that the customer sees, so the preset is
 * sent as its translated label — exactly what mobile sends; `code` is only a
 * stable id for the caller.
 */
export const REJECT_REASONS = [
  { code: "items_unavailable", key: "liveorders.reason_items_unavailable" },
  { code: "too_busy", key: "liveorders.reason_too_busy" },
  { code: "closing_soon", key: "liveorders.reason_closing_soon" },
  { code: "out_of_area", key: "liveorders.reason_out_of_area" },
  { code: "other", key: "liveorders.reason_other" },
] as const satisfies readonly { code: string; key: MessageKey }[];

export type RejectReasonCode = (typeof REJECT_REASONS)[number]["code"];

/** Reason is required: the customer sees it. */
export default function RejectOrderModal({
  order,
  busy,
  onConfirm,
  onClose,
}: {
  order: RestaurantOrder;
  busy: boolean;
  onConfirm: (reason: string, code: RejectReasonCode) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState<RejectReasonCode | null>(null);
  const [otherText, setOtherText] = useState("");

  const preset = REJECT_REASONS.find((reason) => reason.code === code);
  const reason = code === "other" ? otherText.trim() : preset ? t(preset.key) : "";

  const submit = () => {
    if (!reason || !code || busy) return;
    onConfirm(reason, code);
  };

  return (
    <Modal
      open
      stacked
      onClose={onClose}
      dismissible={!busy}
      maxWidth={460}
      title={`${t("reject.title")} · ${orderCode(order)}`}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={submit}
            disabled={!reason || busy}
          >
            <Busy busy={busy} label={t("reject.confirm")} busyLabel={t("ordersx.rejecting")} />
          </button>
        </>
      }
    >
      <div className="field" role="group" aria-labelledby="reject-reason-label">
        <span id="reject-reason-label" className="field-label">
          {t("reject.body")}
        </span>
        <div className={styles.chips}>
          {REJECT_REASONS.map((option) => (
            <button
              key={option.code}
              type="button"
              className={styles.chip}
              aria-pressed={code === option.code}
              disabled={busy}
              onClick={() => setCode(option.code)}
            >
              {t(option.key)}
            </button>
          ))}
        </div>
      </div>
      {code === "other" && (
        <label className="field">
          <span className="field-label">{t("liveorders.reason_other_label")}</span>
          <textarea
            className="form-input"
            rows={3}
            maxLength={500}
            autoFocus
            placeholder={t("reject.placeholder")}
            value={otherText}
            disabled={busy}
            onChange={(event) => setOtherText(event.target.value)}
          />
        </label>
      )}
    </Modal>
  );
}
