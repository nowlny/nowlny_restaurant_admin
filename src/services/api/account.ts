import { apiClient } from './client';

/** The signed-in owner's own user record (`GET /users/me`). */
export interface OwnerProfile {
  id: string;
  fullName: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  profileImage: string | null;
  userType?: string;
  status?: string;
  createdAt?: string;
}

/**
 * `UpdateProfileDto`. The phone number is not in it: it is the OTP login
 * identity, so it is shown read-only (as the mobile app does).
 */
export interface UpdateOwnerProfilePayload {
  fullName?: string;
  nickname?: string;
}

type RawUser = Record<string, unknown>;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/**
 * The route has answered both a bare user and `{ user, restaurant }` over
 * time, and snake_case on some auth paths — the mobile app accepts all of
 * them, so this does too.
 */
function normalizeOwner(data: unknown): OwnerProfile | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as RawUser;
  const user = (root.user && typeof root.user === 'object' ? root.user : root) as RawUser;
  if (!user.id && !user.fullName && !user.full_name && !user.phoneNumber) return null;
  return {
    id: String(user.id ?? ''),
    fullName: str(user.fullName) ?? str(user.full_name) ?? str(user.name),
    nickname: str(user.nickname),
    phoneNumber: str(user.phoneNumber) ?? str(user.phone_number) ?? str(user.phone),
    profileImage: str(user.profileImage) ?? str(user.profile_image),
    userType: str(user.userType) ?? undefined,
    status: str(user.status) ?? undefined,
    createdAt: str(user.createdAt) ?? undefined,
  };
}

export const AccountService = {
  getMe: async (): Promise<OwnerProfile | null> => {
    const { data } = await apiClient.get('/users/me');
    return normalizeOwner(data);
  },
  updateMe: async (payload: UpdateOwnerProfilePayload): Promise<OwnerProfile | null> => {
    const { data } = await apiClient.patch('/users/me', payload);
    return normalizeOwner(data);
  },
};

/** Nowlny support, as listed on the mobile app's Help screen. */
export const SUPPORT_PHONE = '+96178783668';
/** Same number grouped for reading — display only, never put it in `tel:`. */
export const SUPPORT_PHONE_DISPLAY = '+961 78 783 668';
export const SUPPORT_EMAIL = 'nowlnylb@gmail.com';
/** The same number reaches support on WhatsApp. */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, '')}`;

/** Hosted on TermsFeed so it updates without a release; the mobile app shows the same page. */
export const TERMS_URL = 'https://www.termsfeed.com/live/4fb08155-eb30-4e44-b76b-f3a3a745b852';
