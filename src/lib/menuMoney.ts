"use client";

import { useMoney } from "./money";

/**
 * Prices in the restaurant's own currency, for the menu screens.
 *
 * The menu used to print a hard-coded `$` in front of every price, which is
 * wrong for most restaurants on the platform (they price in L.L.). This is now
 * a thin name for `useMoney()` in lib/money.ts, which also gives the "≈"
 * price in the other currency that customers see under each dish.
 */
export function useMenuMoney() {
  return useMoney();
}
