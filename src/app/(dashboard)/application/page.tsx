"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Store,
} from "lucide-react";
import { getApiErrorMessage } from "@/services/api/errors";
import {
  Currency,
  RestaurantSubmission,
  restaurantsService,
} from "@/services/api/restaurants";

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
  const [submission, setSubmission] = useState<RestaurantSubmission | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        setError(
          getApiErrorMessage(
            loadError,
            "We could not load your restaurant application. Please try again.",
          ),
        );
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
    setError("");
    setSuccess("");

    if (!form.restaurantName.trim() || !form.currencyId) {
      setError("Restaurant name and currency are required.");
      return;
    }

    setSaving(true);
    try {
      let updatedSubmission: RestaurantSubmission;
      if (submission?.status === "pending") {
        updatedSubmission = await restaurantsService.updateMySubmission({
          name: form.restaurantName.trim(),
          description: form.description.trim(),
          currencyId: form.currencyId,
        });
        setSuccess("Your pending application was updated.");
      } else {
        updatedSubmission = await restaurantsService.submitApplication({
          restaurantName: form.restaurantName.trim(),
          description: form.description.trim() || undefined,
          currencyId: form.currencyId,
        });
        setSuccess("Your application was submitted for review.");
      }
      setSubmission(updatedSubmission);
    } catch (saveError: unknown) {
      setError(
        getApiErrorMessage(
          saveError,
          "We could not save your application. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "420px", display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" />
      </div>
    );
  }

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
      <section className="glass-panel" style={{ padding: "28px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              display: "grid",
              placeItems: "center",
              color: isRejected ? "var(--error)" : "var(--warning)",
              background: isRejected
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(245, 158, 11, 0.1)",
              flexShrink: 0,
            }}
          >
            {isRejected ? <AlertCircle size={27} /> : isCancelled ? <Store size={27} /> : <Clock3 size={27} />}
          </div>
          <div style={{ flex: 1 }}>
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
              Restaurant application
            </p>
            <h1 style={{ margin: "0 0 10px", fontSize: "28px" }}>
              {isPending
                ? "Your application is under review"
                : isRejected
                  ? "Your application needs changes"
                  : isCancelled
                    ? "Your application was cancelled"
                    : "Apply to join Nowlny"}
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {isPending
                ? "You can update these details while the application is pending. Restaurant tools will unlock after approval."
                : "Review your restaurant details below and submit a new application when you are ready."}
            </p>
          </div>
        </div>

        {isRejected && submission.rejectionReason && (
          <div
            role="alert"
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              borderRadius: "12px",
              color: "var(--error)",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <strong>Review note:</strong> {submission.rejectionReason}
          </div>
        )}
      </section>

      <section className="glass-panel" style={{ padding: "28px" }}>
        {error && (
          <div role="alert" style={{ marginBottom: "20px", color: "var(--error)" }}>
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            style={{
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor="application-name" style={{ fontWeight: 600 }}>
              Restaurant name
            </label>
            <input
              id="application-name"
              className="form-input"
              value={form.restaurantName}
              onChange={(event) =>
                setForm((current) => ({ ...current, restaurantName: event.target.value }))
              }
              required
            />
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor="application-description" style={{ fontWeight: 600 }}>
              Description
            </label>
            <textarea
              id="application-description"
              className="form-input"
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Tell customers what makes your restaurant special."
            />
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor="application-currency" style={{ fontWeight: 600 }}>
              Menu currency
            </label>
            <select
              id="application-currency"
              className="form-input"
              value={form.currencyId}
              onChange={(event) =>
                setForm((current) => ({ ...current, currencyId: event.target.value }))
              }
              required
            >
              <option value="" disabled>
                Select a currency
              </option>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
          </div>

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
                ? `${submissionCount} applications in your history`
                : submission?.updatedAt
                  ? `Last updated ${new Date(submission.updatedAt).toLocaleDateString()}`
                  : "Your application will be reviewed by the Nowlny team."}
            </span>
            <button className="btn-primary" type="submit" disabled={saving || currencies.length === 0}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : isPending ? <RefreshCw size={18} /> : <Store size={18} />}
              {isPending ? "Save changes" : "Submit for review"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
