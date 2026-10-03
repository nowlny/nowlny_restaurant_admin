"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RestaurantProfile } from "@/services/api/settings";

/**
 * The signed-in owner's restaurant, fetched once by the dashboard shell.
 *
 * Dashboard, menu, stories, QR and settings each used to call `/restaurants/me`
 * again on mount even though the shell had just verified it — two identical
 * requests per navigation. Pages read it from here; settings pushes the saved
 * profile back through `setRestaurant` so the sidebar's name and logo follow.
 */
interface RestaurantContextValue {
  restaurant: RestaurantProfile | null;
  setRestaurant: (profile: RestaurantProfile) => void;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  setRestaurant: () => {},
});

export function RestaurantProvider({
  value,
  children,
}: {
  value: RestaurantContextValue;
  children: ReactNode;
}) {
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant() {
  return useContext(RestaurantContext);
}
