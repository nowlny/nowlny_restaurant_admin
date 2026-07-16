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
  isOpen?: boolean;
  currency: Currency | null;
}

export interface RestaurantFullResponse {
  deliveryZones?: Array<{
    id: string;
    name: string;
    polygon: DeliveryZonePoint[];
  }>;
}

export interface UpdateRestaurantProfile {
  name: string;
  description: string;
  phone: string;
  website: string;
  deliveryFee: number;
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
  currencyId: string;
  logo?: string;
  backgroundImageUrl?: string;
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
};
