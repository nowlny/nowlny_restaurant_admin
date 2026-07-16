import { apiClient } from "./client";

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
}

export interface VerifyOtpResponse {
  access_token?: string;
  refresh_token?: string;
  signup_token?: string;
}

export interface CompleteSignupData {
  fullName: string;
  signupToken: string;
  restaurantName: string;
  description?: string;
  currencyId: string;
}

export const authService = {
  requestOtp: async (phoneNumber: string): Promise<RequestOtpResponse> => {
    const { data } = await apiClient.post("/auth/restaurant/request-otp", {
      phoneNumber,
      channel: "sms",
    });
    return data;
  },

  verifyOtp: async (
    phoneNumber: string,
    code: string,
  ): Promise<VerifyOtpResponse> => {
    const { data } = await apiClient.post("/auth/restaurant/verify-otp", {
      phoneNumber,
      code,
    });
    return data;
  },

  completeSignup: async (
    signupData: CompleteSignupData,
  ): Promise<VerifyOtpResponse> => {
    const { data } = await apiClient.post(
      "/auth/restaurant/complete-signup",
      signupData,
    );
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  deleteAccount: async (): Promise<void> => {
    await apiClient.delete("/auth/me");
  },
};
