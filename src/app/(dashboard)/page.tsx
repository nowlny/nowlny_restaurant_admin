"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { OrdersService } from "@/services/api/orders";
import { useRestaurant } from "@/lib/restaurantContext";
import { formatMoney } from "@/lib/money";
import { intlLocale, useI18n, type MessageKey } from "@/lib/i18n";
import StatCard from "@/components/home/StatCard";
import PerformanceChart, { parseDay, weekdayLabel, type DailyPoint } from "@/components/home/PerformanceChart";
import styles from "@/components/home/home.module.css";

type Period = "today" | "week" | "month" | "year" | "all";

const PERIODS: { value: Period; labelKey: MessageKey }[] = [
  { value: "today", labelKey: "dashboard.period.today" },
  { value: "week", labelKey: "dashboard.period.week" },
  { value: "month", labelKey: "dashboard.period.month" },
  { value: "year", labelKey: "dashboard.period.year" },
  { value: "all", labelKey: "dashboard.period.all" },
];

/** `GET /orders/restaurant/me/statistics` (RestaurantStatisticsResponseDto). */
interface Statistics {
  totalOrders: number;
  totalRevenue: number;
  currency?: { code: string; symbol: string | null } | null;
  newCustomers: number;
  avgRating: number;
  totalRatings: number;
  weeklyPerformance: DailyPoint[];
}

type StatsState =
  | { status: "loading" }
  | { status: "ready"; data: Statistics }
  | { status: "error" };

/**
 * Live trading fields from `/restaurants/me`. Read through a local type
 * because `RestaurantProfile` doesn't declare them all; each is optional so an
 * older API response simply hides the indicator.
 */
interface LiveStatus {
  isOpen?: boolean;
  isBusy?: boolean;
  isAcceptingOrders?: boolean;
  busyUntil?: string | null;
}

export default function DashboardPage() {
  const { t, locale, isRTL } = useI18n();
  const { restaurant } = useRestaurant();
  const numberLocale = intlLocale(locale);

  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<StatsState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [chartView, setChartView] = useState<"revenue" | "orders">("revenue");

  // The API answers lowercase (`pending`); the old `"PENDING"` check never matched.
  const isPending = restaurant?.status === "pending";
  const restaurantId = restaurant?.id;

  useEffect(() => {
    if (!restaurantId || isPending) return;
    let cancelled = false;
    OrdersService.getStatistics(period)
      .then((data: Statistics) => {
        if (!cancelled) setStats({ status: "ready", data });
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch dashboard statistics", err);
        if (!cancelled) setStats({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [period, restaurantId, isPending, reloadKey]);

  const choosePeriod = (next: Period) => {
    if (next === period) return;
    setStats({ status: "loading" });
    setPeriod(next);
  };

  const retry = () => {
    setStats({ status: "loading" });
    setReloadKey((n) => n + 1);
  };

  if (isPending) {
    return (
      <div className={`card animate-fade-in ${styles.pending}`}>
        <AlertCircle size={56} color="var(--warning)" aria-hidden="true" />
        <h2>{t("dashboard.pending_title")}</h2>
        <p>{t("dashboard.pending_body")}</p>
      </div>
    );
  }

  const data = stats.status === "ready" ? stats.data : null;
  const loading = stats.status === "loading";
  const failed = stats.status === "error";
  const performance = data?.weeklyPerformance ?? [];

  // Revenue is in the restaurant's currency; a missing one used to read as USD.
  const formatCurrency = (value: number) =>
    formatMoney(value, data?.currency?.code ? data.currency : restaurant?.currency, locale);
  const formatCount = (value: number) => value.toLocaleString(numberLocale);
  const statValue = (value: string) => (failed ? "—" : value);

  // Open / busy / closed at a glance. The shell keeps this profile current
  // when the owner pauses orders from the sidebar.
  const live: LiveStatus | null = restaurant;
  const liveStatus = (() => {
    if (!live) return null;
    if (live.isBusy) {
      const until = live.busyUntil ? new Date(live.busyUntil) : null;
      const label =
        until && !Number.isNaN(until.getTime())
          ? t("home.status_busy_until", {
              time: until.toLocaleTimeString(numberLocale, { hour: "numeric", minute: "2-digit" }),
            })
          : t("home.status_busy");
      return { className: "badge badge-warning", label };
    }
    const accepting = live.isAcceptingOrders ?? live.isOpen;
    if (accepting === undefined) return null;
    return accepting
      ? { className: "badge badge-success", label: t("home.status_open") }
      : { className: "badge", label: t("home.status_closed") };
  })();

  const metricLabel = chartView === "revenue" ? t("dashboard.revenue") : t("dashboard.orders");

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <header className="page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">
            {restaurant?.name
              ? t("dashboard.welcome_named", { name: restaurant.name })
              : t("dashboard.welcome")}
          </h1>
          <p className="page-subtitle">{t("dashboard.subtitle")}</p>
          {liveStatus && (
            <div className={styles.statusRow}>
              <span className={liveStatus.className} role="status">
                <span className={styles.statusDot} aria-hidden="true" />
                {liveStatus.label}
              </span>
            </div>
          )}
        </div>

        <div className="segmented" role="group">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => choosePeriod(p.value)}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.statGrid} aria-busy={loading}>
        <StatCard
          icon={ShoppingBag}
          tone="accent-2"
          label={t("dashboard.total_orders")}
          loading={loading}
          value={statValue(formatCount(data?.totalOrders ?? 0))}
        />
        <StatCard
          icon={DollarSign}
          tone="success"
          label={t("dashboard.total_revenue")}
          loading={loading}
          value={statValue(formatCurrency(data?.totalRevenue ?? 0))}
        />
        <StatCard
          icon={Users}
          tone="info"
          label={t("dashboard.new_customers")}
          loading={loading}
          value={statValue(formatCount(data?.newCustomers ?? 0))}
        />
        <StatCard
          icon={Star}
          filledIcon
          tone="warning"
          label={t("dashboard.rating")}
          loading={loading}
          value={statValue((Number(data?.avgRating) || 0).toFixed(1))}
          extra={failed ? undefined : t("dashboard.reviews_count", { count: data?.totalRatings ?? 0 })}
        />
      </div>

      <section className={`card animate-slide-up ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>{t("dashboard.chart_title")}</h2>
            <p className={styles.sectionSubtitle}>{t("dashboard.chart_subtitle")}</p>
          </div>
          <div className="segmented" role="group" aria-label={t("dashboard.chart_title")}>
            <button type="button" aria-pressed={chartView === "revenue"} onClick={() => setChartView("revenue")}>
              {t("dashboard.revenue")}
            </button>
            <button type="button" aria-pressed={chartView === "orders"} onClick={() => setChartView("orders")}>
              {t("dashboard.orders")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: "240px" }} aria-label={t("common.loading")} />
        ) : failed ? (
          <div className={styles.chartState} style={{ minHeight: "240px" }} role="alert">
            <AlertCircle size={32} color="var(--error)" aria-hidden="true" />
            <span>{t("dashboard.stats_error")}</span>
            <button type="button" className="btn-outline btn-sm" onClick={retry}>
              <RefreshCw size={16} /> {t("common.retry")}
            </button>
          </div>
        ) : performance.length === 0 ? (
          <div className={styles.chartState} style={{ minHeight: "240px" }}>
            <TrendingUp size={32} color="var(--text-muted)" aria-hidden="true" />
            <span>{t("dashboard.no_records")}</span>
          </div>
        ) : (
          <PerformanceChart
            data={performance}
            metric={chartView}
            formatValue={(v) =>
              chartView === "revenue" ? formatCurrency(v) : t("dashboard.orders_value", { count: v })
            }
            numberLocale={numberLocale}
            isRTL={isRTL}
            label={t("home.chart_aria", { metric: metricLabel })}
          />
        )}
      </section>

      {/* The same week as a table — the chart's accessible equivalent. */}
      {data && performance.length > 0 && (
        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: "12px" }}>
            {t("dashboard.breakdown_title")}
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("dashboard.col_date")}</th>
                  <th scope="col">{t("dashboard.col_day")}</th>
                  <th scope="col">{t("dashboard.col_orders")}</th>
                  <th scope="col">{t("dashboard.col_revenue")}</th>
                  <th scope="col" className={styles.end}>{t("dashboard.col_avg")}</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((d) => {
                  const orders = Number(d.orders) || 0;
                  const revenue = Number(d.revenue) || 0;
                  const parsed = parseDay(d.date);
                  return (
                    <tr key={d.date}>
                      <td style={{ fontWeight: 500 }}>
                        {parsed
                          ? parsed.toLocaleDateString(numberLocale, { day: "numeric", month: "short" })
                          : d.date}
                      </td>
                      <td>{weekdayLabel(d, numberLocale)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCount(orders)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(revenue)}</td>
                      <td className={styles.end} style={{ color: "var(--text-secondary)" }}>
                        {formatCurrency(orders ? revenue / orders : 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
