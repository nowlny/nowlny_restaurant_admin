import { apiClient } from './client';

export const ReelsService = {
  getOwnReels: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/reels/me', { params });
    // Assuming the API returns { data: [...], meta: {...} } or just an array
    return data.data ? data.data : Array.isArray(data) ? data : [];
  },
  createReel: async (payload: { videoUrl: string; thumbnailUrl: string; caption?: string; menuItemId?: string }) => {
    const { data } = await apiClient.post('/reels/me', payload);
    return data;
  },
  updateReel: async (id: string, payload: { videoUrl?: string; thumbnailUrl?: string; caption?: string; menuItemId?: string; status?: string }) => {
    const { data } = await apiClient.patch(`/reels/me/${id}`, payload);
    return data;
  },
  deleteReel: async (id: string) => {
    await apiClient.delete(`/reels/me/${id}`);
  }
};
