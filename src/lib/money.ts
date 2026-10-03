"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, type Locale } from "./i18n";
import { useRestaurant } from "./restaurantContext";
import { SettingsService, type ExchangeRate } from "@/services/api/settings";

/* ---------------------------------------------------------------------------
   Money.

   A restaurant prices everything — dishes, add-ons, delivery fee, and so the
   orders built from them — in its own currency (`restaurant.currency`, USD or
   LBP on this platform). Every screen used to format that its own way: the
   orders board showed "LBP 750,000.00", the menu printed a bare "$", and a
   missing currency silently became dollars.

   This is the one rule set, kept in step with the customer app
   (nowlny-web/src/app/menu/lib/price.ts) so the owner sees what the customer
   sees:
   - LBP has no fraction digits, USD always shows cents.
   - A price can carry a secondary "≈" in the other of USD/LBP, converted at
     the restaurant's exchange rate (its own override, else the platform
     default).
--------------------------------------------------------------------------- */

export type CurrencyLike = { code?: string | null; symbol?: string | null } | null | undefined;

type Amount = number | string | null | undefined;

const toNumber = (value: Amount): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Fraction digits a price in this currency is written with. */
export function currencyDecimals(code?: string | null): number {
  const upper = code?.toUpperCase();
  if (!upper) return 2;
  // ISO gives the lira two minor digits, but piastres went out of use decades
  // ago — nobody writes "750,000.00 LBP".
  if (upper === "LBP") return 0;
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency: upper }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Money is always written the way the customer app and the printed receipt
 * write it — "LBP 750,000", "$12.50" — in Arabic too. Arabic's own number
 * shape ("750.000", "12,50") reads as seven hundred and fifty to anyone
 * holding the receipt, and the staff compare the two.
 */
const MONEY_LOCALE = "en-US";

/**
 * "$12.50", "LBP 750,000". An unknown or missing currency prints the bare
 * number with its symbol rather than pretending it is dollars. `locale` is
 * kept for callers and future use; the number shape is pinned (see above).
 */
export function formatMoney(value: Amount, currency: CurrencyLike, locale?: Locale): string {
  void locale;
  const amount = toNumber(value);
  const code = currency?.code?.toUpperCase() || "";
  const digits = currencyDecimals(code);
  if (code) {
    try {
      return new Intl.NumberFormat(MONEY_LOCALE, {
        style: "currency",
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    } catch {
      // A custom code Intl doesn't know — fall through to "amount symbol".
    }
  }
  const plain = new Intl.NumberFormat(MONEY_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  const unit = currency?.symbol || code;
  return unit ? `${plain} ${unit}` : plain;
}

/* ---------------------------------------------------------------------------
   Exchange rate.

   Every entry the backend returns stores "LBP per 1 USD" (e.g. 89,500),
   whichever way round `from`/`to` are — the direction names which side of
   the market it is. So a USD price shown in lira uses the USD→LBP entry, and
   a lira price shown in dollars uses LBP→USD; if only one exists it serves
   both.
--------------------------------------------------------------------------- */

const CONVERTIBLE = ["USD", "LBP"] as const;

/** LBP-per-USD for converting a `base`-currency price, or null when none applies. */
export function lbpPerUsd(rates: ExchangeRate[], base: string): number | null {
  const pair = rates.filter(
    (r) =>
      CONVERTIBLE.includes(r.fromCurrencyId?.toUpperCase() as (typeof CONVERTIBLE)[number]) &&
      CONVERTIBLE.includes(r.toCurrencyId?.toUpperCase() as (typeof CONVERTIBLE)[number]) &&
      r.fromCurrencyId.toUpperCase() !== r.toCurrencyId.toUpperCase(),
  );
  const chosen = pair.find((r) => r.fromCurrencyId.toUpperCase() === base) ?? pair[0];
  const rate = Number(chosen?.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** The same amount in the other of USD/LBP, or null when it can't be converted. */
export function convertForDisplay(
  value: Amount,
  base: string,
  rate: number | null,
): { amount: number; currency: { code: string } } | null {
  if (!rate) return null;
  const amount = toNumber(value);
  if (base === "USD") return { amount: amount * rate, currency: { code: "LBP" } };
  if (base === "LBP") return { amount: amount / rate, currency: { code: "USD" } };
  return null;
}

/**
 * The rates that apply to this restaurant: its own overrides when it has
 * any, the platform defaults otherwise. Loaded once per session and shared by
 * every price on screen; the settings page calls `invalidateExchangeRates()`
 * after editing them.
 */
let ratesRequest: Promise<ExchangeRate[]> | null = null;
const rateListeners = new Set<() => void>();

const loadRates = (): Promise<ExchangeRate[]> => {
  if (!ratesRequest) {
    ratesRequest = SettingsService.getExchangeRates()
      .catch(() => [] as ExchangeRate[])
      .then(async (own) => (own.length ? own : SettingsService.getDefaultExchangeRates()))
      .catch(() => {
        // Retry on the next mount rather than caching a failure for the session.
        ratesRequest = null;
        return [] as ExchangeRate[];
      });
  }
  return ratesRequest;
};

export function invalidateExchangeRates() {
  ratesRequest = null;
  rateListeners.forEach((listener) => listener());
}

function useExchangeRates(): ExchangeRate[] {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    rateListeners.add(bump);
    return () => {
      rateListeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let live = true;
    loadRates().then((next) => {
      if (live) setRates(next);
    });
    return () => {
      live = false;
    };
  }, [version]);

  return rates;
}

export interface DualPrice {
  primary: string;
  /** "≈ LBP 1,119,000" — null when the currency can't be converted. */
  secondary: string | null;
}

/**
 * Prices for the signed-in restaurant: formatted in its currency, with the
 * converted secondary the customer app shows under each price.
 *
 * Pass `currency` to format a record that carries its own (an order).
 */
export function useMoney(currency?: CurrencyLike) {
  const { locale } = useI18n();
  const { restaurant } = useRestaurant();
  const rates = useExchangeRates();
  const resolved = currency?.code ? currency : restaurant?.currency;
  const code = resolved?.code?.toUpperCase() || "";
  const symbol = resolved?.symbol ?? null;

  return useMemo(() => {
    const cur = { code, symbol };
    const rate = lbpPerUsd(rates, code);
    const format = (value: Amount) => formatMoney(value, cur, locale);
    const secondary = (value: Amount) => {
      const converted = convertForDisplay(value, code, rate);
      return converted ? `≈ ${formatMoney(converted.amount, converted.currency, locale)}` : null;
    };
    return {
      /** Currency code for input labels, e.g. "USD" ("" when unknown). */
      code,
      /** Fraction digits for price inputs (0 for LBP). */
      decimals: currencyDecimals(code),
      rate,
      format,
      secondary,
      dual: (value: Amount): DualPrice => ({ primary: format(value), secondary: secondary(value) }),
    };
  }, [code, symbol, rates, locale]);
}
