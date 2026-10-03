import { apiClient } from './client';

export interface Story {
  id: string;
  /** The picture, or — for a video story — its poster frame. Legacy video stories kept the clip here. */
  imageUrl: string;
  /** Set on video stories. */
  videoUrl?: string | null;
  caption?: string | null;
  /** Display position (0 = first) once the owner has reordered their stories. */
  sortOrder?: number;
  createdAt?: string;
  expiresAt?: string;
}

/** `CreateRestaurantStoryDto` / `UpdateRestaurantStoryDto`. */
export interface StoryPayload {
  imageUrl: string;
  /**
   * `null` turns an existing video story back into a photo story; the DTO's
   * `@IsOptional` lets null through where an empty string would fail `@IsUrl`.
   */
  videoUrl?: string | null;
  caption?: string;
}

/** `GET /restaurants/me/stories/{id}/viewers` — a unique count, not a list of people. */
export interface StoryViewers {
  storyId: string;
  count: number;
}

export const StoriesService = {
  /** The public listing — it returns only stories that haven't expired. */
  getOwnStories: async (restaurantId: string): Promise<Story[]> => {
    const { data } = await apiClient.get(`/restaurants/${restaurantId}/stories`);
    return Array.isArray(data) ? data : data?.data || [];
  },
  createStory: async (payload: StoryPayload): Promise<Story> => {
    const { data } = await apiClient.post('/restaurants/me/stories', payload);
    return data;
  },
  updateStory: async (storyId: string, payload: Partial<StoryPayload>): Promise<Story> => {
    const { data } = await apiClient.patch(`/restaurants/me/stories/${storyId}`, payload);
    return data;
  },
  deleteStory: async (storyId: string) => {
    await apiClient.delete(`/restaurants/me/stories/${storyId}`);
  },
  /**
   * `PUT /restaurants/me/stories/reorder` with `{ orderedIds }` — every active
   * story's id in display order, as the mobile app sends it.
   */
  reorderStories: async (orderedIds: string[]) => {
    await apiClient.put('/restaurants/me/stories/reorder', { orderedIds });
  },
  getStoryViewers: async (storyId: string): Promise<StoryViewers> => {
    const { data } = await apiClient.get(`/restaurants/me/stories/${storyId}/viewers`);
    return { storyId, count: Number(data?.count) || 0 };
  },
};
