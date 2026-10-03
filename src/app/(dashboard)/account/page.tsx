"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Save,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  AccountService,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_WHATSAPP_URL,
  TERMS_URL,
  type OwnerProfile,
} from "@/services/api/account";
import { getApiErrorMessage } from "@/services/api/errors";
import { useRestaurant } from "@/lib/restaurantContext";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { Field } from "@/components/settings/FormBits";
import { useI18n } from "@/lib/i18n";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: OwnerProfile | null }
  | { status: "error"; message: string };

const FULL_NAME_MAX = 100;

export default function AccountPage() {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const { restaurant } = useRestaurant();

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccountService.getMe()
      .then((profile) => {
        if (cancelled) return;
        setLoad({ status: "ready", profile });
        setFullName(profile?.fullName ?? "");
      })
      .catch((err: unknown) => {
        console.error("Failed to load the owner profile", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setLoad({ status: "error", message: getApiErrorMessage(err, "") });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  const profile = load.status === "ready" ? load.profile : null;
  const trimmedName = fullName.trim();
  const dirty = load.status === "ready" && trimmedName !== (profile?.fullName ?? "");
  const canSave = dirty && trimmedName.length > 0 && !saving;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await AccountService.updateMe({ fullName: trimmedName });
      const next: OwnerProfile | null = updated ?? (profile ? { ...profile, fullName: trimmedName } : null);
      setLoad({ status: "ready", profile: next });
      setFullName(next?.fullName ?? trimmedName);
      toast.success(t("account.saved"));
    } catch (err) {
      console.error("Failed to update the owner profile", err);
      toast.error(getApiErrorMessage(err, t("account.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: "820px" }}>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("account.title")}</h1>
          <p className="page-subtitle">{t("account.subtitle")}</p>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* ── Owner profile ── */}
        <Section icon={UserRound} title={t("account.profile_title")} subtitle={t("account.profile_subtitle")}>
          {load.status === "loading" ? (
            <div aria-busy="true" aria-label={t("common.loading")} style={{ display: "grid", gap: "16px" }}>
              <div className="skeleton" style={{ height: "68px", borderRadius: "var(--radius-md)" }} />
              <div className="skeleton" style={{ height: "68px", borderRadius: "var(--radius-md)" }} />
            </div>
          ) : load.status === "error" ? (
            <div className="notice notice-error" role="alert" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <span>{load.message || t("account.load_failed")}</span>
              <button type="button" className="btn-outline btn-sm" onClick={retry}>
                <RefreshCw size={16} /> {t("common.retry")}
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                <Field label={t("account.full_name")}>
                  {(id) => (
                    <input
                      id={id}
                      className="form-input"
                      value={fullName}
                      maxLength={FULL_NAME_MAX}
                      autoComplete="name"
                      placeholder={t("account.full_name_placeholder")}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={saving}
                      required
                    />
                  )}
                </Field>
                <Field label={t("account.phone")} hint={t("account.phone_hint")}>
                  {(id, describedBy) => (
                    <input
                      id={id}
                      className="form-input force-ltr"
                      value={profile?.phoneNumber ?? ""}
                      readOnly
                      aria-describedby={describedBy}
                      style={{ color: "var(--text-secondary)", cursor: "default" }}
                    />
                  )}
                </Field>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-primary" disabled={!canSave}>
                  {saving ? (
                    <Busy busy label={t("common.save")} busyLabel={t("common.saving")} />
                  ) : (
                    <>
                      <Save size={18} /> {t("common.save")}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Section>

        {/* ── Restaurant identity (edited in Settings) ── */}
        {restaurant && (
          <Section icon={Store} title={t("account.restaurant_title")} subtitle={t("account.restaurant_subtitle")}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              {restaurant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URLs; next/image has no remotePatterns for them
                <img
                  src={restaurant.logo}
                  alt=""
                  width={56}
                  height={56}
                  style={{ borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent-light)",
                    color: "var(--accent-primary)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Store size={24} />
                </span>
              )}
              <div style={{ flex: 1, minWidth: "160px" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "16px", overflowWrap: "anywhere" }}>
                  {restaurant.name}
                </p>
                {restaurant.phone && (
                  <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>
                    <span className="force-ltr">{restaurant.phone}</span>
                  </p>
                )}
              </div>
              <Link href="/settings" className="btn-outline btn-sm">
                {t("account.edit_restaurant")}
              </Link>
            </div>
          </Section>
        )}

        {/* ── Help ── */}
        <Section icon={LifeBuoy} title={t("account.help_title")} subtitle={t("account.help_subtitle")}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            <LinkRow icon={Phone} href={`tel:${SUPPORT_PHONE}`} label={t("account.contact_call")} value={SUPPORT_PHONE_DISPLAY} ltrValue />
            <LinkRow icon={MessageCircle} href={SUPPORT_WHATSAPP_URL} label={t("account.contact_whatsapp")} value={SUPPORT_PHONE_DISPLAY} ltrValue external />
            <LinkRow icon={Mail} href={`mailto:${SUPPORT_EMAIL}`} label={t("account.contact_email")} value={SUPPORT_EMAIL} ltrValue />
          </ul>
        </Section>

        {/* ── Legal ── */}
        <Section icon={FileText} title={t("account.legal_title")}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            <LinkRow icon={FileText} href={TERMS_URL} label={t("account.terms")} value={t("account.terms_hint")} external />
          </ul>
        </Section>

        {/* ── Danger zone ── */}
        <section className="card" style={{ padding: "20px", borderColor: "rgba(239, 68, 68, 0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--error)" }}>
                {t("account.delete_title")}
              </h2>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                {t("account.delete_body")}
              </p>
            </div>
            <Link href="/delete-account" className="btn-outline btn-sm" style={{ color: "var(--error)", borderColor: "var(--error)" }}>
              <Trash2 size={16} /> {t("account.delete_cta")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="card" style={{ padding: "20px" }} aria-label={title}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
        <span style={{ color: "var(--accent-primary)", display: "inline-flex", paddingTop: "2px" }}>
          <Icon size={20} aria-hidden />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function LinkRow({
  icon: Icon,
  href,
  label,
  value,
  ltrValue,
  external,
}: {
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  href: string;
  label: string;
  value: string;
  /** Phone numbers and addresses stay left-to-right in Arabic. */
  ltrValue?: boolean;
  /** Opens in a new tab. */
  external?: boolean;
}) {
  const { t } = useI18n();
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 14px",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          color: "inherit",
          textDecoration: "none",
          background: "var(--bg-elevated)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--accent-light)",
            color: "var(--accent-primary)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} aria-hidden />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 600 }}>{label}</span>
          <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "14px", overflowWrap: "anywhere" }}>
            {ltrValue ? <span className="force-ltr">{value}</span> : value}
          </span>
        </span>
        {external ? (
          <>
            <ExternalLink size={16} aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span className="sr-only">{t("account.opens_new_tab")}</span>
          </>
        ) : (
          <ChevronRight size={18} aria-hidden className="flip-in-rtl" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        )}
      </a>
    </li>
  );
}
