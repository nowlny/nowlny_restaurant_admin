"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import type { IntegrationStatus } from "@/services/api/integrations";
import { useI18n } from "@/lib/i18n";
import styles from "../integrations.module.css";

/** The company's logo, or a truck glyph when it has none or the URL is broken. */
export function CompanyLogo({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.logo}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URLs; next/image has no remotePatterns for them
        <img src={src} alt={name} loading="lazy" decoding="async" width={52} height={52} onError={() => setFailed(true)} />
      ) : (
        <Truck size={24} aria-hidden="true" />
      )}
    </div>
  );
}

const BADGE: Record<IntegrationStatus, string> = {
  pending: "badge badge-warning",
  accepted: "badge badge-success",
  rejected: "badge badge-error",
};

const STATUS_KEY = {
  pending: "integrations.status_pending",
  accepted: "integrations.status_accepted",
  rejected: "integrations.status_rejected",
} as const;

export function StatusBadge({ status }: { status: IntegrationStatus }) {
  const { t } = useI18n();
  return <span className={BADGE[status]}>{t(STATUS_KEY[status])}</span>;
}
