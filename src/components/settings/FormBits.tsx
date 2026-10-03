"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

/**
 * Label + control + optional hint, wired together.
 *
 * The old `FieldLabel` rendered a bare `<label>` beside the input with no
 * `htmlFor`, so clicking the label did nothing and screen readers announced
 * every field as unlabeled. The render prop hands the control its id.
 */
export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field" style={style}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

const NOTICE_ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
} as const;

/** The global `.notice` banner. Renders nothing for an empty message. */
export function Notice({
  tone,
  children,
  title,
}: {
  tone: keyof typeof NOTICE_ICONS;
  children?: ReactNode;
  title?: ReactNode;
}) {
  if (!children && !title) return null;
  const Icon = NOTICE_ICONS[tone];
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} />
      <div style={{ minWidth: 0 }}>
        {title && <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>}
        {children && <div style={title ? { marginTop: 4, fontSize: 13 } : undefined}>{children}</div>}
      </div>
    </div>
  );
}
