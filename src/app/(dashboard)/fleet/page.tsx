"use client";

import { useEffect, useState } from "react";
import { Bike, Clock, Pencil, RefreshCw, Search, Trash2, User, UserPlus, X } from "lucide-react";
import {
  FleetService,
  type DriverInvitation,
  type DriverStatus,
  type FleetDriver,
} from "@/services/api/fleet";
import { getApiErrorMessage } from "@/services/api/errors";
import { useFeedback } from "@/components/ui/Feedback";
import { intlLocale, useI18n } from "@/lib/i18n";
import styles from "./components/fleet.module.css";
import InviteDriverModal from "./components/InviteDriverModal";
import DriverModal from "./components/DriverModal";
import { driverName, vehicleLabel } from "./components/fleetMeta";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };
type StatusFilter = "all" | DriverStatus;

/** The roster isn't paginated in the UI; a restaurant fleet is far smaller than this. */
const PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 350;

export default function FleetPage() {
  const { t, locale } = useI18n();
  const { toast, confirm } = useFeedback();

  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [invitations, setInvitations] = useState<DriverInvitation[]>([]);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [invitesKey, setInvitesKey] = useState(0);

  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<FleetDriver | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Debounce typing into the search box before it hits the API.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = window.setTimeout(() => {
      setLoad({ status: "loading" });
      setSearch(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let cancelled = false;
    FleetService.getDrivers({
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
      page: 1,
      limit: PAGE_LIMIT,
    })
      .then((data) => {
        if (cancelled) return;
        setDrivers(data);
        setLoad({ status: "ready" });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch drivers", err);
        // Fallback copy is resolved at render, so `t` stays out of the deps.
        if (!cancelled) setLoad({ status: "error", message: getApiErrorMessage(err, "") });
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, search, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    FleetService.getPendingInvitations()
      .then((data) => {
        if (cancelled) return;
        setInvitations(data);
        setInvitationsError(null);
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch driver invitations", err);
        if (!cancelled) setInvitationsError(getApiErrorMessage(err, ""));
      });
    return () => {
      cancelled = true;
    };
  }, [invitesKey]);

  const reload = () => {
    setLoad({ status: "loading" });
    setReloadKey((n) => n + 1);
    setInvitesKey((n) => n + 1);
  };

  const changeFilter = (next: StatusFilter) => {
    if (next === statusFilter) return;
    setLoad({ status: "loading" });
    setStatusFilter(next);
  };

  const clearFilters = () => {
    setSearchInput("");
    if (statusFilter === "all" && !search) return;
    setLoad({ status: "loading" });
    setStatusFilter("all");
    setSearch("");
  };

  const handleRemove = async (driver: FleetDriver) => {
    const name = driverName(driver, t);
    const ok = await confirm({
      title: t("fleet.remove_title"),
      message: t("fleet.remove_message", { name }),
      confirmLabel: t("fleet.remove_confirm"),
      danger: true,
    });
    if (!ok) return;
    setRemovingId(driver.id);
    try {
      await FleetService.removeDriver(driver.id);
      setDrivers((current) => current.filter((d) => d.id !== driver.id));
      setManaging((current) => (current?.id === driver.id ? null : current));
      toast.success(t("fleet.removed", { name }));
    } catch (err) {
      console.error("Failed to remove driver", err);
      toast.error(getApiErrorMessage(err, t("fleet.remove_failed")));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevoke = async (invitation: DriverInvitation) => {
    const ok = await confirm({
      title: t("fleet.revoke_title"),
      message: t("fleet.revoke_message", { phone: invitation.phoneNumber }),
      confirmLabel: t("fleet.revoke_confirm"),
      danger: true,
    });
    if (!ok) return;
    setRevokingId(invitation.id);
    try {
      await FleetService.revokeInvitation(invitation.id);
      setInvitations((current) => current.filter((i) => i.id !== invitation.id));
      toast.success(t("fleet.revoked"));
    } catch (err) {
      console.error("Failed to revoke invitation", err);
      toast.error(getApiErrorMessage(err, t("fleet.revoke_failed")));
    } finally {
      setRevokingId(null);
    }
  };

  const handleUpdated = (updated: FleetDriver) => {
    // A driver switched out of the filtered status no longer belongs in the list.
    setDrivers((current) =>
      statusFilter !== "all" && updated.status !== statusFilter
        ? current.filter((d) => d.id !== updated.id)
        : current.map((d) => (d.id === updated.id ? updated : d)),
    );
  };

  const formatDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString(intlLocale(locale), { dateStyle: "medium" });
  };

  const filtered = statusFilter !== "all" || Boolean(search);
  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: t("fleet.filter_all") },
    { value: "active", label: t("fleet.filter_active") },
    { value: "inactive", label: t("fleet.filter_inactive") },
  ];

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t("fleet.title")}</h1>
          <p className="page-subtitle">{t("fleet.subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setInviting(true)}>
          <UserPlus size={20} /> {t("fleet.invite")}
        </button>
      </header>

      {(invitations.length > 0 || invitationsError !== null) && (
        <section className={styles.section} aria-labelledby="fleet-pending-title">
          <h2 id="fleet-pending-title" className={styles.sectionTitle}>
            <Clock size={16} aria-hidden="true" /> {t("fleet.pending_title")}
            {invitations.length > 0 && <span className="badge badge-warning">{invitations.length}</span>}
          </h2>
          {invitationsError !== null ? (
            <div className="notice notice-error" role="alert" style={{ alignItems: "center" }}>
              <span style={{ flex: 1 }}>{invitationsError || t("fleet.invitations_failed")}</span>
              <button type="button" className="btn-outline btn-sm" onClick={() => setInvitesKey((n) => n + 1)}>
                <RefreshCw size={16} /> {t("common.retry")}
              </button>
            </div>
          ) : (
            <ul className={styles.list} style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {invitations.map((invitation) => {
                const sent = formatDate(invitation.createdAt);
                return (
                  <li key={invitation.id} className={`card ${styles.row}`}>
                    <span className={`${styles.avatar} ${styles.avatarPending}`} aria-hidden="true">
                      <Clock size={20} />
                    </span>
                    <div className={styles.body}>
                      <span className={`${styles.name} force-ltr`}>{invitation.phoneNumber || "—"}</span>
                      <span className={styles.meta}>
                        <span>{t("fleet.pending_hint")}</span>
                        {sent && <span>{t("fleet.invited_on", { date: sent })}</span>}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => void handleRevoke(invitation)}
                        disabled={revokingId === invitation.id}
                        aria-label={t("fleet.revoke_named", { phone: invitation.phoneNumber })}
                        title={t("fleet.revoke_confirm")}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className={styles.toolbar}>
        <div className="segmented" role="group" aria-label={t("fleet.filter_label")}>
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={statusFilter === filter.value}
              onClick={() => changeFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1 1 260px", justifyContent: "flex-end" }}>
          <label className={styles.search}>
            <span className="sr-only">{t("common.search")}</span>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              className="form-input"
              placeholder={t("fleet.search_placeholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            onClick={reload}
            disabled={load.status === "loading"}
            aria-label={t("fleet.refresh")}
            title={t("fleet.refresh")}
          >
            <RefreshCw size={18} className={load.status === "loading" ? "animate-spin" : undefined} />
          </button>
        </div>
      </div>

      {load.status === "loading" ? (
        <div className={styles.list} aria-busy="true" aria-label={t("common.loading")}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: "74px", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      ) : load.status === "error" ? (
        <div className="empty-state" role="alert">
          <h3>{load.message || t("fleet.load_failed")}</h3>
          <button type="button" className="btn-outline" onClick={reload}>
            <RefreshCw size={18} /> {t("common.retry")}
          </button>
        </div>
      ) : drivers.length === 0 ? (
        filtered ? (
          <div className="empty-state">
            <Search size={36} color="var(--text-muted)" aria-hidden="true" />
            <h3>{t("fleet.no_results")}</h3>
            <button type="button" className="btn-outline" onClick={clearFilters}>
              {t("fleet.clear_filters")}
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <User size={40} color="var(--accent-primary)" aria-hidden="true" />
            <h3>{t("fleet.empty_title")}</h3>
            <p>{t("fleet.empty_body")}</p>
            <button type="button" className="btn-primary" onClick={() => setInviting(true)} style={{ marginTop: "6px" }}>
              <UserPlus size={18} /> {t("fleet.invite")}
            </button>
          </div>
        )
      ) : (
        <ul className={styles.list} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {drivers.map((driver) => {
            const name = driverName(driver, t);
            const active = driver.status === "active";
            return (
              <li key={driver.id} className={`card ${styles.row}${active ? "" : ` ${styles.rowInactive}`}`}>
                <span className={styles.avatar} aria-hidden="true">
                  <User size={20} />
                </span>
                <div className={styles.body}>
                  <span className={styles.nameLine}>
                    <span className={styles.name}>{name}</span>
                    <span className={`badge ${active ? "badge-success" : ""}`}>
                      {active ? t("fleet.status_active") : t("fleet.status_inactive")}
                    </span>
                    {active && typeof driver.isAvailable === "boolean" && (
                      <span className={`badge ${driver.isAvailable ? "badge-info" : ""}`}>
                        {driver.isAvailable ? t("fleet.available") : t("fleet.unavailable")}
                      </span>
                    )}
                  </span>
                  <span className={styles.meta}>
                    <span className="force-ltr">{driver.phoneNumber || "—"}</span>
                    <span>
                      <Bike size={14} aria-hidden="true" /> {vehicleLabel(driver, t)}
                      {" · "}
                      <span className="force-ltr">{driver.vehiclePlate || t("fleet.no_plate")}</span>
                    </span>
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => setManaging(driver)}
                    aria-label={t("fleet.manage_named", { name })}
                  >
                    <Pencil size={16} aria-hidden="true" /> {t("fleet.manage")}
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => void handleRemove(driver)}
                    disabled={removingId === driver.id}
                    aria-label={t("fleet.remove_named", { name })}
                    title={t("fleet.remove_confirm")}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {inviting && (
        <InviteDriverModal onClose={() => setInviting(false)} onInvited={() => setInvitesKey((n) => n + 1)} />
      )}

      {managing && (
        <DriverModal
          key={managing.id}
          driver={managing}
          removing={removingId === managing.id}
          onClose={() => setManaging(null)}
          onUpdated={handleUpdated}
          onRemove={(driver) => void handleRemove(driver)}
        />
      )}
    </div>
  );
}
