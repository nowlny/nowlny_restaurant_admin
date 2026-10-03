import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./home.module.css";

/** Colour family from globals.css — each has a matching `--{tone}-bg` tint. */
export type StatTone = "accent-2" | "success" | "info" | "warning";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone: StatTone;
  loading?: boolean;
  /** A line under the value, e.g. "(320 reviews)". */
  extra?: ReactNode;
  /** Filled glyph (the rating star). */
  filledIcon?: boolean;
}

/** One headline number on the home dashboard. */
export default function StatCard({ icon: Icon, label, value, tone, loading, extra, filledIcon }: StatCardProps) {
  return (
    <div className={`card ${styles.statCard}`}>
      <div
        className={styles.statIcon}
        style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}
        aria-hidden="true"
      >
        <Icon size={22} fill={filledIcon ? "currentColor" : "none"} />
      </div>
      <div className={styles.statText}>
        <p className={styles.statLabel}>{label}</p>
        {loading ? (
          <div className="skeleton" style={{ height: "28px", width: "70%", maxWidth: "120px" }} />
        ) : (
          <>
            <p className={styles.statValue} title={typeof value === "string" ? value : undefined}>
              {value}
            </p>
            {extra && <span className={styles.statExtra}>{extra}</span>}
          </>
        )}
      </div>
    </div>
  );
}
