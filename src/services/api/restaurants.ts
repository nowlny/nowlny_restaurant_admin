import { apiClient } from "./client";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface Currency {
  code: string;
  name: string;
  symbol: string | null;
}

export interface RestaurantSubmission {
  id: string;
  name: string | null;
  description: string | null;
  currencyId: string;
  status: SubmissionStatus;
  rejectionReason: string | null;
  restaurantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionListResponse {
  data: RestaurantSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SubmitRestaurantApplication {
  restaurantName: string;
  description?: string;
  currencyId: string;
}

export interface UpdateRestaurantSubmission {
  name?: string;
  description?: string;
  currencyId?: string;
}

export const restaurantsService = {
  getMyRestaurant: async () => {
    const { data } = await apiClient.get("/restaurants/me");
    return data;
  },

  getMySubmissions: async (): Promise<SubmissionListResponse> => {
    const { data } = await apiClient.get<SubmissionListResponse>(
      "/restaurants/me/submission",
      { params: { page: 1, limit: 20 } },
    );
    return data;
  },

  updateMySubmission: async (
    payload: UpdateRestaurantSubmission,
  ): Promise<RestaurantSubmission> => {
    const { data } = await apiClient.patch<RestaurantSubmission>(
      "/restaurants/me/submission",
      payload,
    );
    return data;
  },

  submitApplication: async (
    payload: SubmitRestaurantApplication,
  ): Promise<RestaurantSubmission> => {
    const { data } = await apiClient.post<RestaurantSubmission>(
      "/restaurants/me/apply",
      payload,
    );
    return data;
  },

  cancelMySubmission: async (): Promise<RestaurantSubmission> => {
    const { data } = await apiClient.patch<RestaurantSubmission>(
      "/restaurants/me/submission/cancel",
    );
    return data;
  },

  getCurrencies: async (): Promise<Currency[]> => {
    const { data } = await apiClient.get<Currency[]>("/currencies");
    return data;
  },
};
