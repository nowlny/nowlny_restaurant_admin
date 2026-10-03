"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { PhoneField } from "@/app/auth/_components/AuthInputs";
import { FleetService } from "@/services/api/fleet";
import { getApiErrorMessage, isApiStatus } from "@/services/api/errors";
import { useI18n } from "@/lib/i18n";
import { toLebanesePhone } from "./fleetMeta";

/**
 * Drivers sign themselves up in the driver app; this attaches an existing
 * account by the number it registered with. The driver accepts in their app
 * before they appear in the roster, so a success lands in "Pending".
 */
export default function InviteDriverModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const formId = useId();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const phoneNumber = toLebanesePhone(phone);
    if (!phoneNumber) {
      setError(t("fleet.invalid_phone"));
      return;
    }

    setSending(true);
    setError(null);
    try {
      await FleetService.inviteDriver(phoneNumber);
      toast.success(t("fleet.invite_sent"));
      onInvited();
      onClose();
    } catch (err) {
      console.error("Failed to invite driver", err);
      // 404/409 are the two outcomes an operator can act on; spell them out
      // rather than surfacing the API's terse wording.
      if (isApiStatus(err, 404)) setError(t("fleet.invite_no_account"));
      else if (isApiStatus(err, 409)) setError(t("fleet.invite_duplicate"));
      else setError(getApiErrorMessage(err, t("fleet.invite_failed")));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("fleet.invite_title")}
      maxWidth={460}
      dismissible={!sending}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={sending}>
            {t("common.cancel")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={sending || !phone.trim()}>
            <Busy busy={sending} label={t("fleet.send_invite")} busyLabel={t("fleet.sending")} />
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p className="field-hint" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          {t("fleet.invite_hint")}
        </p>
        <PhoneField
          label={t("fleet.phone_label")}
          placeholder={t("fleet.phone_placeholder")}
          value={phone}
          onChange={(value) => {
            setPhone(value);
            if (error) setError(null);
          }}
        />
        {error && (
          <div className="notice notice-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
