"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./home.module.css";

export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Short English weekday from the API; used only if `date` can't be parsed. */
  day: string;
  orders: number;
  revenue: number;
}

interface PerformanceChartProps {
  data: DailyPoint[];
  metric: "revenue" | "orders";
  /** Full value for the tooltip (currency or "12 orders"). */
  formatValue: (value: number) => string;
  /** Locale tag for axis numbers and weekday names. */
  numberLocale: string;
  isRTL: boolean;
  label: string;
}

/** `YYYY-MM-DD` as a local date — `new Date("2026-06-16")` would be UTC midnight, a day early west of GMT. */
export function parseDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function weekdayLabel(point: DailyPoint, locale: string): string {
  const parsed = parseDay(point.date);
  return parsed ? parsed.toLocaleDateString(locale, { weekday: "short" }) : point.day;
}

/** A round axis top: 4 gridline steps of 1/2/2.5/5 × 10ⁿ. */
function niceMax(raw: number, integer: boolean): number {
  const target = Math.max(raw, integer ? 4 : 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= target) ?? target;
  return (integer ? Math.max(1, Math.ceil(step)) : step) * 4;
}

const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1];

/**
 * The 7-day trend. Drawn at the container's real pixel width (measured with a
 * ResizeObserver) rather than a fixed 800×280 viewBox, which scaled the axis
 * text down to ~5px on a phone. Mirrored in RTL so time runs right-to-left,
 * with the value axis on the right.
 */
export default function PerformanceChart({ data, metric, formatValue, numberLocale, isRTL, label }: PerformanceChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const narrow = width < 480;
  const height = narrow ? 220 : 280;
  const padTop = 16;
  const padBottom = 30;
  const padAxis = narrow ? 40 : 56; // room for the value labels
  const padEnd = 14;
  const plotWidth = Math.max(width - padAxis - padEnd, 1);
  const plotHeight = height - padTop - padBottom;

  const color = metric === "revenue" ? "var(--success)" : "var(--accent-2)";
  const values = data.map((d) => Number(metric === "revenue" ? d.revenue : d.orders) || 0);
  const maxValue = niceMax(Math.max(...values, 0), metric === "orders");
  const compact = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });

  // Laid out left-to-right, then flipped for Arabic.
  const xFor = (i: number) => {
    const ltr = padAxis + (data.length > 1 ? (i * plotWidth) / (data.length - 1) : plotWidth / 2);
    return isRTL ? width - ltr : ltr;
  };
  const yFor = (v: number) => padTop + plotHeight - (v / maxValue) * plotHeight;
  const points = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const baseline = padTop + plotHeight;

  const linePath = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
    : "";

  // Thin the weekday labels when they'd collide; the newest day always shows.
  const spacing = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
  const labelEvery = spacing < 46 ? 2 : 1;
  const last = data.length - 1;

  const axisX = isRTL ? width - padAxis + 8 : padAxis - 8;
  const hitWidth = Math.max(spacing, 24);
  const active = hovered !== null && hovered < points.length ? points[hovered] : null;

  return (
    <div ref={boxRef} className={styles.chartBox} style={{ height }} onPointerLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          // Physical coordinates throughout; `direction` would flip text-anchor.
          style={{ direction: "ltr", display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {GRID_STEPS.map((g) => {
            const y = yFor(g * maxValue);
            return (
              <g key={g}>
                <line
                  x1={isRTL ? padEnd : padAxis}
                  x2={isRTL ? width - padAxis : width - padEnd}
                  y1={y}
                  y2={y}
                  style={{ stroke: "var(--border-color)" }}
                  strokeWidth={1}
                />
                <text
                  x={axisX}
                  y={y + 4}
                  textAnchor={isRTL ? "start" : "end"}
                  style={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 }}
                >
                  {compact.format(g * maxValue)}
                </text>
              </g>
            );
          })}

          {data.map((d, i) =>
            (last - i) % labelEvery === 0 ? (
              <text
                key={d.date || i}
                x={points[i].x}
                y={height - 8}
                textAnchor="middle"
                style={{
                  fill: hovered === i ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {weekdayLabel(d, numberLocale)}
              </text>
            ) : null,
          )}

          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={padTop}
              y2={baseline}
              style={{ stroke: "var(--text-muted)" }}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hovered === i ? 6 : 4}
              style={{ fill: color, stroke: "var(--bg-surface)", transition: "r 0.15s ease" }}
              strokeWidth={2}
            />
          ))}

          {/* Hit targets a full column wide — far bigger than the dots, and
              `pointerdown` makes a tap work on phones, which have no hover. */}
          {points.map((p, i) => (
            <rect
              key={i}
              x={p.x - hitWidth / 2}
              y={padTop}
              width={hitWidth}
              height={plotHeight + padBottom}
              fill="transparent"
              onPointerEnter={() => setHovered(i)}
              onPointerDown={() => setHovered(i)}
            />
          ))}
        </svg>
      )}

      {active && hovered !== null && (
        <div
          className={styles.tooltip}
          style={{
            // Kept inside the card so it never spills off a phone screen.
            left: Math.min(Math.max(active.x, 80), Math.max(width - 80, 80)),
            top: Math.max(active.y - 68, 0),
          }}
        >
          <span className={styles.tooltipTitle}>
            {weekdayLabel(data[hovered], numberLocale)} · {parseDay(data[hovered].date)?.toLocaleDateString(numberLocale, { day: "numeric", month: "short" }) ?? data[hovered].date}
          </span>
          <span className={styles.tooltipValue} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            {formatValue(values[hovered])}
          </span>
        </div>
      )}
    </div>
  );
}
