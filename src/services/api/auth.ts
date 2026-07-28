import { apiClient } from "./client";
import type { SessionTokens } from "./session";

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
}

/**
 * Both spellings are declared because the API is not consistent about them —
 * the restaurant routes answer snake_case, others camelCase. Reading only
 * `access_token` meant a camelCase response signed nobody in and reported
 * nothing: the screen simply sat there.
 */
export interface VerifyOtpResponse extends SessionTokens {
  signup_token?: string;
  signupToken?: string;
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
