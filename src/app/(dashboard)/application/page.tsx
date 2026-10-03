"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clock3,
  Loader2,
  RefreshCw,
  Store,
  XCircle,
} from "lucide-react";
import { getApiErrorMessage } from "@/services/api/errors";
import {
  Currency,
  RestaurantSubmission,
  restaurantsService,
} from "@/services/api/restaurants";
import { intlLocale, useI18n, type MessageKey } from "@/lib/i18n";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { Field, Notice as NoticeBanner } from "@/components/settings/FormBits";

/** Key + optional server text — the load effect must not close over `t`. */
type Notice = { key: MessageKey; text?: string } | null;

interface ApplicationForm {
  restaurantName: string;
  description: string;
  currencyId: string;
}

const EMPTY_FORM: ApplicationForm = {
  restaurantName: "",
  description: "",
  currencyId: "",
};

export default function ApplicationPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();
  const [submission, setSubmission] = useState<RestaurantSubmission | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Notice>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      restaurantsService.getMySubmissions(),
      restaurantsService.getCurrencies(),
    ])
      .then(([submissionResponse, activeCurrencies]) => {
        if (cancelled) return;
        const latestSubmission = submissionResponse.data[0] ?? null;

        if (latestSubmission?.status === "approved") {
          router.replace("/");
          return;
        }

        setSubmission(latestSubmission);
        setSubmissionCount(submissionResponse.total);
        setCurrencies(activeCurrencies);
        const defaultCurrency =
          latestSubmission?.currencyId ||
          activeCurrencies.find((currency) => currency.code === "USD")?.code ||
          activeCurrencies[0]?.code ||
          "";
        setForm({
          restaurantName: latestSubmission?.name ?? "",
          description: latestSubmission?.description ?? "",
          currencyId: defaultCurrency,
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError({
          key: "application.load_failed",
          text: getApiErrorMessage(loadError, ""),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.restaurantName.trim() || !form.currencyId) {
      setError({ key: "application.required" });
      return;
    }

    setSaving(true);
    try {
      let updatedSubmission: RestaurantSubmission;
      if (submission?.status === "pending") {
        updatedSubmission = await restaurantsService.updateMySubmission({
          restaurantName: form.restaurantName.trim(),
          description: form.description.trim(),
          currencyId: form.currencyId,
        });
        toast.success(t("application.updated"));
      } else {
        updatedSubmission = await restaurantsService.submitApplication({
          restaurantName: form.restaurantName.trim(),
          description: form.description.trim() || undefined,
          currencyId: form.currencyId,
        });
        toast.success(t("application.submitted"));
      }
      setSubmission(updatedSubmission);
    } catch (saveError: unknown) {
      setError({
        key: "application.save_failed",
        text: getApiErrorMessage(saveError, ""),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: t("appx.cancel_title"),
      message: t("appx.cancel_body"),
      confirmLabel: t("appx.cancel_confirm"),
      cancelLabel: t("appx.keep"),
      danger: true,
    });
    if (!confirmed) return;
    setError(null);
    setCancelling(true);
    try {
      setSubmission(await restaurantsService.cancelMySubmission());
      toast.success(t("appx.cancelled"));
    } catch (cancelError: unknown) {
      setError({ key: "appx.cancel_failed", text: getApiErrorMessage(cancelError, "") });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "420px", display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" />
      </div>
    );
  }

  const errorText = error ? error.text || t(error.key) : "";
  const isPending = submission?.status === "pending";
  const isRejected = submission?.status === "rejected";
  const isCancelled = submission?.status === "cancelled";

  return (
    <div
      className="animate-fade-in"
      style={{
        width: "100%",
        maxWidth: "760px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <section className="glass-panel" style={{ padding: "clamp(18px, 5vw, 28px)" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              display: "grid",
              placeItems: "center",
              color: isRejected ? "var(--error)" : "var(--warning)",
              background: isRejected ? "var(--error-bg)" : "var(--warning-bg)",
              flexShrink: 0,
            }}
          >
            {isRejected ? <AlertCircle size={27} /> : isCancelled ? <Store size={27} /> : <Clock3 size={27} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: "0 0 6px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {t("application.eyebrow")}
            </p>
            <h1 style={{ margin: "0 0 10px", fontSize: "clamp(22px, 5vw, 28px)" }}>
              {isPending
                ? t("application.title_pending")
                : isRejected
                  ? t("application.title_rejected")
                  : isCancelled
                    ? t("application.title_cancelled")
                    : t("application.title_new")}
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {isPending
                ? t("application.body_pending")
                : t("application.body_other")}
            </p>
          </div>
        </div>

        {isRejected && submission.rejectionReason && (
          <div style={{ marginTop: "20px" }}>
            <NoticeBanner tone="error">
              <strong>{t("application.review_note")}</strong> {submission.rejectionReason}
            </NoticeBanner>
          </div>
        )}
      </section>

      <section className="glass-panel" style={{ padding: "clamp(18px, 5vw, 28px)" }}>
        {errorText && (
          <div style={{ marginBottom: "20px" }}>
            <NoticeBanner tone="error">{errorText}</NoticeBanner>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          <Field label={t("application.name")}>
            {(id) => (
            <input
              id={id}
              className="form-input"
              value={form.restaurantName}
              onChange={(event) =>
                setForm((current) => ({ ...current, restaurantName: event.target.value }))
              }
              required
            />
            )}
          </Field>

          <Field label={t("application.description")}>
            {(id) => (
            <textarea
              id={id}
              className="form-input"
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={t("application.description_placeholder")}
            />
            )}
          </Field>

          <Field label={t("application.currency")}>
            {(id) => (
            <select
              id={id}
              className="form-input"
              value={form.currencyId}
              onChange={(event) =>
                setForm((current) => ({ ...current, currencyId: event.target.value }))
              }
              required
            >
              <option value="" disabled>
                {t("application.currency_placeholder")}
              </option>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
            )}
          </Field>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              paddingTop: "4px",
            }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              {submissionCount > 1
                ? t("application.history_count", { count: submissionCount })
                : submission?.updatedAt
                  ? t("application.last_updated", {
                      date: new Date(submission.updatedAt).toLocaleDateString(
                        intlLocale(locale),
                      ),
                    })
                  : t("application.will_be_reviewed")}
            </span>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {isPending && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleCancel}
                  disabled={cancelling || saving}
                  style={{ color: "var(--error)" }}
                >
                  <Busy busy={cancelling} label={<><XCircle size={18} /> {t("appx.cancel")}</>} />
                </button>
              )}
              <button className="btn-primary" type="submit" disabled={saving || cancelling || currencies.length === 0}>
                <Busy
                  busy={saving}
                  label={<>{isPending ? <RefreshCw size={18} /> : <Store size={18} />} {isPending ? t("application.save_changes") : t("application.submit")}</>}
                  busyLabel={t("common.saving")}
                />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
