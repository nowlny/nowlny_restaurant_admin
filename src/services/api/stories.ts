import { apiClient } from './client';

export const StoriesService = {
  getOwnStories: async (restaurantId: string) => {
    const { data } = await apiClient.get(`/restaurants/${restaurantId}/stories`);
    return Array.isArray(data) ? data : data.data || [];
  },
  getActiveStories: async (restaurantId: string) => {
    const { data } = await apiClient.get(`/restaurants/${restaurantId}/stories`);
    return Array.isArray(data) ? data : data.data || [];
  },
  createStory: async (payload: { imageUrl: string; caption?: string }) => {
    const { data } = await apiClient.post('/restaurants/me/stories', payload);
    return data;
  },
  updateStory: async (storyId: string, payload: { imageUrl?: string; caption?: string }) => {
    const { data } = await apiClient.patch(`/restaurants/me/stories/${storyId}`, payload);
    return data;
  },
  deleteStory: async (storyId: string) => {
    await apiClient.delete(`/restaurants/me/stories/${storyId}`);
  },
  getStoryViewers: async (storyId: string) => {
    const { data } = await apiClient.get(`/restaurants/me/stories/${storyId}/viewers`);
    return data;
  }
};
