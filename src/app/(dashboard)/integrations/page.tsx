"use client";

import { useEffect, useState } from "react";
import { Info, Phone, RefreshCw, Search, Truck, Unlink, X } from "lucide-react";
import {
  IntegrationsService,
  type CompanyIntegration,
  type DeliveryCompany,
  type IntegrationStatus,
} from "@/services/api/integrations";
import { getApiErrorMessage } from "@/services/api/errors";
import { Busy, useFeedback } from "@/components/ui/Feedback";
import { intlLocale, useI18n } from "@/lib/i18n";
import CompanyCard from "./components/CompanyCard";
import { CompanyLogo, StatusBadge } from "./components/CompanyParts";
import styles from "./integrations.module.css";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

const PAGE_SIZE = 20;

/**
 * Delivery partners. A restaurant browses the active delivery companies,
 * requests a link with one, and the company accepts or declines it from its
 * own app. Once accepted, orders can be dispatched to that company.
 */
export default function IntegrationsPage() {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();

  const [integration, setIntegration] = useState<CompanyIntegration | null>(null);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      IntegrationsService.getCompanies({ search: query, page: 1, limit: PAGE_SIZE }),
      IntegrationsService.getIntegration(),
    ])
      .then(([result, current]) => {
        if (cancelled) return;
        setCompanies(result.companies);
        setPage(result.page);
        setTotalPages(result.totalPages);
        setIntegration(current);
        setLoad({ status: "ready" });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch delivery companies", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setLoad({ status: "error", message: getApiErrorMessage(err, "") });
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const retry = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await IntegrationsService.getCompanies({ search: query, page: page + 1, limit: PAGE_SIZE });
      setCompanies((current) => {
        const seen = new Set(current.map((c) => c.id));
        return [...current, ...result.companies.filter((c) => !seen.has(c.id))];
      });
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Failed to load more delivery companies", err);
      toast.error(getApiErrorMessage(err, t("integrations.load_failed")));
    } finally {
      setLoadingMore(false);
    }
  };

  const statusFor = (company: DeliveryCompany): IntegrationStatus | null => {
    if (integration?.company?.id === company.id) return integration.status;
    // The list endpoint annotates companies too; the integration endpoint wins when both exist.
    return company.integrationStatus ?? null;
  };

  const requestLink = async (company: DeliveryCompany) => {
    setRequestingId(company.id);
    try {
      await IntegrationsService.requestIntegration(company.id);
      toast.success(t("integrations.requested", { company: company.name }));
      try {
        setIntegration(await IntegrationsService.getIntegration());
      } catch {
        // The request went through; a stale panel is fixed by the next reload.
        setReloadKey((n) => n + 1);
      }
    } catch (err) {
      console.error("Failed to request integration", err);
      toast.error(getApiErrorMessage(err, t("integrations.request_failed")));
    } finally {
      setRequestingId(null);
    }
  };

  const removeLink = async (current: CompanyIntegration) => {
    const name = current.company?.name || t("integrations.unnamed");
    const copy =
      current.status === "pending"
        ? { title: t("integrations.withdraw_title"), message: t("integrations.withdraw_message", { company: name }), cta: t("integrations.withdraw") }
        : current.status === "rejected"
          ? { title: t("integrations.dismiss_title"), message: t("integrations.dismiss_message", { company: name }), cta: t("integrations.dismiss") }
          : { title: t("integrations.unlink_title"), message: t("integrations.unlink_message", { company: name }), cta: t("integrations.unlink") };
    const ok = await confirm({ title: copy.title, message: copy.message, confirmLabel: copy.cta, danger: current.status !== "rejected" });
    if (!ok) return;
    setRemoving(true);
    try {
      await IntegrationsService.removeIntegration(current.id);
      setIntegration(null);
      // Drop any list annotation for that company so its card offers "Request link" again.
      setCompanies((list) =>
        list.map((c) => (c.id === current.company?.id ? { ...c, integrationStatus: null } : c)),
      );
      toast.success(current.status === "accepted" ? t("integrations.unlinked", { company: name }) : t("integrations.removed"));
    } catch (err) {
      console.error("Failed to remove integration", err);
      toast.error(getApiErrorMessage(err, t("integrations.remove_failed")));
    } finally {
      setRemoving(false);
    }
  };

  const busy = removing || requestingId !== null;

  const renderCurrent = () => {
    if (!integration) {
      return (
        <div className="notice notice-info">
          <Info size={18} aria-hidden="true" />
          <span>{t("integrations.none_linked")}</span>
        </div>
      );
    }
    const company = integration.company;
    const name = company?.name || t("integrations.unnamed");
    const requestedAt = integration.createdAt ? new Date(integration.createdAt) : null;
    const hint =
      integration.status === "accepted"
        ? t("integrations.accepted_hint")
        : integration.status === "pending"
          ? t("integrations.pending_hint")
          : t("integrations.rejected_hint");
    const action =
      integration.status === "accepted"
        ? { label: t("integrations.unlink"), icon: <Unlink size={16} aria-hidden="true" />, className: "btn-danger btn-sm" }
        : integration.status === "pending"
          ? { label: t("integrations.withdraw"), icon: <X size={16} aria-hidden="true" />, className: "btn-outline btn-sm" }
          : { label: t("integrations.dismiss"), icon: <X size={16} aria-hidden="true" />, className: "btn-outline btn-sm" };

    return (
      <div className={`card ${styles.current}`}>
        <div className={styles.head}>
          <CompanyLogo src={company?.logo} name={name} />
          <div className={styles.identity}>
            <h3 className={styles.name}>{name}</h3>
            {company?.phone && (
              <a className={styles.phone} href={`tel:${company.phone}`}>
                <Phone size={13} aria-hidden="true" />
                <span className="force-ltr">{company.phone}</span>
              </a>
            )}
          </div>
          <StatusBadge status={integration.status} />
        </div>
        <p className={styles.reason}>{hint}</p>
        {integration.status === "rejected" && integration.rejectionReason && (
          <div className="notice notice-error">
            <span>{t("integrations.rejection_reason", { reason: integration.rejectionReason })}</span>
          </div>
        )}
        {integration.status === "accepted" && company && company.allowDriverVisibility !== undefined && (
          <p className={styles.reason}>
            {company.allowDriverVisibility ? t("integrations.drivers_visible") : t("integrations.drivers_hidden")}
          </p>
        )}
        {requestedAt && !Number.isNaN(requestedAt.getTime()) && (
          <p className={styles.reason}>
            {t("integrations.requested_on", {
              date: requestedAt.toLocaleDateString(intlLocale(locale), { dateStyle: "medium" }),
            })}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={action.className}
            disabled={busy}
            onClick={() => void removeLink(integration)}
          >
            <Busy busy={removing} label={<>{action.icon}{action.label}</>} busyLabel={t("integrations.removing")} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("integrations.title")}</h1>
          <p className="page-subtitle">{t("integrations.subtitle")}</p>
        </div>
      </header>

      {load.status === "error" ? (
        <div className="empty-state" role="alert">
          <h3>{load.message || t("integrations.load_failed")}</h3>
          <button type="button" className="btn-outline" onClick={retry}>
            <RefreshCw size={18} /> {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="current-partner">
            <h2 id="current-partner" className={styles.sectionTitle}>
              {t("integrations.current_title")}
            </h2>
            {load.status === "loading" ? (
              <div className="skeleton" style={{ height: "140px", borderRadius: "var(--radius-lg)" }} />
            ) : (
              renderCurrent()
            )}
          </section>

          <section className={styles.section} aria-labelledby="browse-companies">
            <div className={styles.toolbar}>
              <h2 id="browse-companies" className={styles.sectionTitle}>
                {t("integrations.browse_title")}
              </h2>
              <div className={styles.search}>
                <Search size={18} aria-hidden className={styles.searchIcon} />
                <input
                  type="search"
                  className="form-input"
                  placeholder={t("integrations.search_placeholder")}
                  aria-label={t("integrations.search_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {load.status === "loading" ? (
              <div className={styles.grid} aria-busy="true" aria-label={t("common.loading")}>
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="skeleton" style={{ height: "200px", borderRadius: "var(--radius-lg)" }} />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="empty-state">
                <Truck size={40} color="var(--accent-primary)" aria-hidden="true" />
                <h3>{query ? t("integrations.no_results_title") : t("integrations.empty_title")}</h3>
                <p>{query ? t("integrations.no_results", { query }) : t("integrations.empty")}</p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {companies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      status={statusFor(company)}
                      requesting={requestingId === company.id}
                      disabled={busy}
                      onRequest={() => void requestLink(company)}
                    />
                  ))}
                </div>
                {page < totalPages && (
                  <div className={styles.loadMore}>
                    <button type="button" className="btn-outline" disabled={loadingMore} onClick={() => void loadMore()}>
                      <Busy busy={loadingMore} label={t("integrations.load_more")} busyLabel={t("common.loading")} />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
