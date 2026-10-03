"use client";

import { Link2, MapPinned, Phone, Star, Truck, Users } from "lucide-react";
import type { DeliveryCompany, IntegrationStatus } from "@/services/api/integrations";
import { Busy } from "@/components/ui/Feedback";
import { intlLocale, useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { CompanyLogo, StatusBadge } from "./CompanyParts";
import styles from "../integrations.module.css";

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

interface CompanyCardProps {
  company: DeliveryCompany;
  /** This restaurant's link with the company, if any. */
  status: IntegrationStatus | null;
  requesting: boolean;
  /** Another request or unlink is in flight; keep buttons still. */
  disabled: boolean;
  onRequest: () => void;
}

export default function CompanyCard({ company, status, requesting, disabled, onRequest }: CompanyCardProps) {
  const { t, locale } = useI18n();
  const number = (value: number, digits = 0) =>
    value.toLocaleString(intlLocale(locale), { maximumFractionDigits: digits, minimumFractionDigits: digits });

  const rating = toNumber(company.rating);
  const charge = toNumber(company.deliveryCharge);
  const drivers = toNumber(company.activeDriversCount) ?? toNumber(company.driversCount);
  const zones = toNumber(company.zonesCount);

  return (
    <article className={`card ${styles.companyCard}`}>
      <div className={styles.head}>
        <CompanyLogo src={company.logo} name={company.name} />
        <div className={styles.identity}>
          <h3 className={styles.name}>{company.name || t("integrations.unnamed")}</h3>
          {company.phone && (
            <a className={styles.phone} href={`tel:${company.phone}`}>
              <Phone size={13} aria-hidden="true" />
              <span className="force-ltr">{company.phone}</span>
            </a>
          )}
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      {company.description && <p className={styles.description}>{company.description}</p>}

      <div className={styles.stats}>
        <span className={styles.stat}>
          <Star size={13} aria-hidden="true" color="var(--warning)" />
          {rating !== null && rating > 0
            ? t("integrations.rating", { rating: number(rating, 1), count: number(toNumber(company.totalRatings) ?? 0) })
            : t("integrations.no_ratings")}
        </span>
        {charge !== null && (
          <span className={styles.stat}>
            <Truck size={13} aria-hidden="true" />
            {t("integrations.delivery_charge", {
              // A delivery company charges in its own currency, not the restaurant's.
              amount: formatMoney(charge, company.currency, locale),
            })}
          </span>
        )}
        {drivers !== null && (
          <span className={styles.stat}>
            <Users size={13} aria-hidden="true" />
            {t("integrations.drivers", { count: number(drivers) })}
          </span>
        )}
        {zones !== null && (
          <span className={styles.stat}>
            <MapPinned size={13} aria-hidden="true" />
            {t("integrations.zones", { count: number(zones) })}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        {status === "accepted" || status === "pending" ? (
          <p className={styles.reason}>
            {status === "accepted" ? t("integrations.card_linked_hint") : t("integrations.card_pending_hint")}
          </p>
        ) : (
          <button type="button" className="btn-primary btn-sm" disabled={disabled} onClick={onRequest}>
            <Busy
              busy={requesting}
              label={
                <>
                  <Link2 size={16} aria-hidden="true" />
                  {status === "rejected" ? t("integrations.request_again") : t("integrations.request")}
                </>
              }
              busyLabel={t("integrations.requesting")}
            />
          </button>
        )}
      </div>
    </article>
  );
}
