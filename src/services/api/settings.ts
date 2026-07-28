import { apiClient } from "./client";

export interface Currency {
  code: string;
  name: string;
  symbol: string | null;
}

export interface ExchangeRate {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
}

export interface DeliveryZonePoint {
  lat: number;
  lng: number;
}

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** Monday-first, matching how the opening-hours editor is read down the page. */
export const WEEK_DAYS: readonly WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/**
 * One day's schedule. A day missing from the array means closed — the API has
 * no "closed" flag, absence is the signal.
 */
export interface OpeningHours {
  day: WeekDay;
  is24Hours?: boolean;
  /** 24h "HH:mm". Ignored by the API when `is24Hours` is set. */
  openTime?: string | null;
  closeTime?: string | null;
}

export interface RestaurantAddress {
  id?: string;
  city: string;
  street: string;
  building?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RestaurantCategory {
  id: string;
  name: string;
}

export type RestaurantStatus =
  | "active"
  | "inactive"
  | "pending"
  | "rejected"
  | "suspended";

export interface DeliveryZone {
  id?: string;
  name?: string;
  polygon: DeliveryZonePoint[];
}

export interface RestaurantProfile {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  backgroundImageUrl: string | null;
  phone: string | null;
  website: string | null;
  deliveryFee: number | string;
  deliveryTimeMinMinutes: number | string;
  deliveryTimeMaxMinutes: number | string;
  deliveryTimeRange?: string;
  rating?: number | string;
  totalRatings?: number;
  /** Computed server-side from `openingHours` in the Beirut timezone. */
  isOpen?: boolean;
  currency: Currency | null;
  openingHours?: OpeningHours[] | null;
  restaurantAddress?: RestaurantAddress | null;
  categories?: RestaurantCategory[];
  autoSendToDeliveryCompany?: boolean;
  status?: RestaurantStatus;
  /** Populated only when `status` is `rejected`. */
  rejectionReason?: string | null;
}

export interface RestaurantFullResponse {
  deliveryZones?: Array<{
    id: string;
    name: string;
    polygon: DeliveryZonePoint[];
  }>;
}

export interface UpdateRestaurantAddress {
  city?: string;
  street?: string;
  building?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Every field is optional because `PATCH /restaurants/me` is a true partial
 * update, and each settings tab saves only its own slice. That matters for the
 * two replace-all fields: sending `categoryIds` or `deliveryZones` wipes
 * whatever the server currently holds, so a tab that does not own them must
 * leave them off the payload entirely rather than echo back a stale copy.
 */
export interface UpdateRestaurantProfile {
  name?: string;
  description?: string;
  phone?: string;
  website?: string;
  deliveryFee?: number;
  deliveryTimeMinMinutes?: number;
  deliveryTimeMaxMinutes?: number;
  currencyId?: string;
  logo?: string;
  backgroundImageUrl?: string;
  openingHours?: OpeningHours[];
  restaurantAddress?: UpdateRestaurantAddress;
  autoSendToDeliveryCompany?: boolean;
  /** Replaces ALL categories. */
  categoryIds?: string[];
  /** Replaces ALL zones; `[]` clears them. */
  deliveryZones?: DeliveryZone[];
}

export interface ProfileImageUploadResult {
  logo?: string;
  backgroundImageUrl?: string;
}

interface PaginatedResponse<T> {
  data: T[];
}

export const SettingsService = {
  getOwnRestaurant: async (): Promise<RestaurantProfile> => {
    const { data } = await apiClient.get<RestaurantProfile>("/restaurants/me");
    return data;
  },

  getFullRestaurant: async (id: string): Promise<RestaurantFullResponse> => {
    const { data } = await apiClient.get<RestaurantFullResponse>(
      `/restaurants/${id}/full`,
    );
    return data;
  },

  updateOwnRestaurant: async (
    payload: UpdateRestaurantProfile,
  ): Promise<RestaurantProfile> => {
    const { data } = await apiClient.patch<RestaurantProfile>(
      "/restaurants/me",
      payload,
    );
    return data;
  },

  uploadProfileImages: async (files: {
    logo?: File;
    backgroundImage?: File;
  }): Promise<ProfileImageUploadResult> => {
    const body = new FormData();
    if (files.logo) body.append("logo", files.logo);
    if (files.backgroundImage) {
      body.append("backgroundImage", files.backgroundImage);
    }
    const { data } = await apiClient.post<ProfileImageUploadResult>(
      "/restaurants/me/profile-images",
      body,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  getExchangeRates: async (): Promise<ExchangeRate[]> => {
    const { data } = await apiClient.get<
      ExchangeRate[] | PaginatedResponse<ExchangeRate>
    >("/restaurants/me/exchange-rate");
    return Array.isArray(data) ? data : data.data || [];
  },

  setExchangeRate: async (payload: {
    fromCurrencyId: string;
    toCurrencyId: string;
    rate: number;
  }): Promise<ExchangeRate> => {
    const { data } = await apiClient.put<ExchangeRate>(
      "/restaurants/me/exchange-rate",
      payload,
    );
    return data;
  },

  deleteExchangeRate: async (exchangeRateId?: string): Promise<void> => {
    if (exchangeRateId) {
      await apiClient.delete(
        `/restaurants/me/exchange-rate/${exchangeRateId}`,
      );
    } else {
      await apiClient.delete("/restaurants/me/exchange-rate");
    }
  },

  getCurrencies: async (): Promise<Currency[]> => {
    const { data } = await apiClient.get<
      Currency[] | PaginatedResponse<Currency>
    >("/currencies");
    return Array.isArray(data) ? data : data.data || [];
  },

  getRestaurantCategories: async (): Promise<RestaurantCategory[]> => {
    const { data } = await apiClient.get<
      RestaurantCategory[] | PaginatedResponse<RestaurantCategory>
    >("/restaurant-categories", { params: { limit: 100 } });
    return Array.isArray(data) ? data : data.data || [];
  },
};
