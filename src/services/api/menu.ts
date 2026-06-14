import { apiClient } from './client';

export const MenuService = {
  // Sections
  getSectionsByRestaurant: async (restaurantId: string) => {
    const { data } = await apiClient.get(`/menu/sections/restaurant/${restaurantId}`);
    return Array.isArray(data) ? data : data.data || [];
  },
  createSection: async (payload: { name: string; description?: string; sortOrder?: number; isActive?: boolean; restaurantId?: string }) => {
    const { data } = await apiClient.post('/menu/sections', payload);
    return data;
  },
  updateSection: async (sectionId: string, payload: { name?: string; description?: string; sortOrder?: number; isActive?: boolean }) => {
    const { data } = await apiClient.patch(`/menu/sections/${sectionId}`, payload);
    return data;
  },
  deleteSection: async (sectionId: string) => {
    await apiClient.delete(`/menu/sections/${sectionId}`);
  },
  reorderSections: async (orderedIds: string[]) => {
    await apiClient.put('/menu/sections/reorder', { orderedIds });
  },

  // Items
  getItemsBySection: async (sectionId: string) => {
    const { data } = await apiClient.get(`/menu/items/section/${sectionId}`);
    return Array.isArray(data) ? data : data.data || [];
  },
  createItem: async (payload: any) => {
    const { data } = await apiClient.post('/menu/items', payload);
    return data;
  },
  updateItem: async (itemId: string, payload: any) => {
    const { data } = await apiClient.patch(`/menu/items/${itemId}`, payload);
    return data;
  },
  deleteItem: async (itemId: string) => {
    await apiClient.delete(`/menu/items/${itemId}`);
  },
  reorderItems: async (sectionId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/sections/${sectionId}/items/reorder`, { orderedIds });
  },

  // Option Groups
  getOptionGroupsByItem: async (itemId: string) => {
    const { data } = await apiClient.get(`/menu/option-groups/item/${itemId}`);
    return Array.isArray(data) ? data : data.data || [];
  },
  createOptionGroup: async (payload: any) => {
    const { data } = await apiClient.post('/menu/option-groups', payload);
    return data;
  },
  updateOptionGroup: async (groupId: string, payload: any) => {
    const { data } = await apiClient.patch(`/menu/option-groups/${groupId}`, payload);
    return data;
  },
  deleteOptionGroup: async (groupId: string) => {
    await apiClient.delete(`/menu/option-groups/${groupId}`);
  },
  reorderOptionGroups: async (itemId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/items/${itemId}/option-groups/reorder`, { orderedIds });
  },

  // Options
  addOptionToGroup: async (groupId: string, payload: any) => {
    const { data } = await apiClient.post(`/menu/option-groups/${groupId}/options`, payload);
    return data;
  },
  updateOption: async (optionId: string, payload: any) => {
    const { data } = await apiClient.patch(`/menu/options/${optionId}`, payload);
    return data;
  },
  deleteOption: async (optionId: string) => {
    await apiClient.delete(`/menu/options/${optionId}`);
  },
  reorderOptions: async (groupId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/option-groups/${groupId}/options/reorder`, { orderedIds });
  }
};
