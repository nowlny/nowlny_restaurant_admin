import { apiClient } from './client';

export type ReelStatus = 'active' | 'hidden';

export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  menuItemId?: string | null;
  status?: ReelStatus;
}

/** `CreateReelDto` — no `status` here; a new reel is always active. */
export interface CreateReelPayload {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  menuItemId?: string;
}

/** `UpdateReelDto`. */
export interface UpdateReelPayload extends Partial<CreateReelPayload> {
  status?: ReelStatus;
}

export const ReelsService = {
  getOwnReels: async (params?: { page?: number; limit?: number }): Promise<Reel[]> => {
    const { data } = await apiClient.get('/reels/me', { params });
    // Paginated `{ data, meta }`, though a bare array is tolerated too.
    return data?.data ? data.data : Array.isArray(data) ? data : [];
  },
  createReel: async (payload: CreateReelPayload): Promise<Reel> => {
    const { data } = await apiClient.post('/reels/me', payload);
    return data;
  },
  updateReel: async (id: string, payload: UpdateReelPayload): Promise<Reel> => {
    const { data } = await apiClient.patch(`/reels/me/${id}`, payload);
    return data;
  },
  deleteReel: async (id: string) => {
    await apiClient.delete(`/reels/me/${id}`);
  },
};
