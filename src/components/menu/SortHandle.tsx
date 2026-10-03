"use client";

import React from "react";
import { GripVertical } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** `[a, b, c]` with the item at `from` moved to `to`. */
export function moveInArray<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Grab affordance for a sortable row.
 *
 * The handle — not the whole card — carries `draggable`, because a draggable
 * ancestor makes the text inside the card unselectable and swallows taps on
 * its buttons. ArrowUp/ArrowDown move the row too, since native HTML5 drag and
 * drop is unreachable from the keyboard (and from touch screens).
 */
export default function SortHandle({
  label,
  disabled,
  disabledHint,
  onDragStart,
  onDragEnd,
  onMove,
  size = 18,
}: {
  /** Already-translated name of the row, e.g. "Grills". */
  label: string;
  disabled?: boolean;
  /** Why sorting is off right now — shown as the tooltip. */
  disabledHint?: string;
  onDragStart: (e: React.DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
  /** -1 = up, +1 = down. */
  onMove: (delta: -1 | 1) => void;
  size?: number;
}) {
  const { t } = useI18n();
  return (
    <span
      role="button"
      className="drag-handle"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (disabled || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        onMove(e.key === "ArrowUp" ? -1 : 1);
      }}
      aria-label={t("menu.sort_handle_aria", { name: label })}
      title={disabled ? disabledHint : t("menu.sort_handle_title")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: "4px",
        borderRadius: "var(--radius-sm)",
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "not-allowed" : undefined,
      }}
    >
      <GripVertical size={size} aria-hidden />
    </span>
  );
}

/**
 * Starts a drag using the whole row as the ghost image rather than the tiny
 * grip. Firefox aborts a drag that carries no payload, hence the setData.
 */
export function beginRowDrag(e: React.DragEvent<HTMLElement>, id: string) {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", id);
  const card = e.currentTarget.closest("[data-drag-card]");
  if (card) e.dataTransfer.setDragImage(card, 16, 16);
}
