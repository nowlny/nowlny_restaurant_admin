import { apiClient } from './client';

export type MenuPrice = number | string;

export interface MenuItemOption {
  id: string;
  name: string;
  price: MenuPrice;
  sortOrder?: number;
}

export interface MenuItemOptionGroup {
  id: string;
  name: string;
  type: 'radio' | 'checkbox';
  isRequired: boolean;
  sortOrder?: number;
  options?: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: MenuPrice;
  discountedPrice?: MenuPrice | null;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  optionGroups?: MenuItemOptionGroup[];
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  items?: MenuItem[];
}

export interface MenuItemPayload {
  sectionId?: string;
  name?: string;
  description?: string;
  image?: string;
  price?: MenuPrice;
  discountedPrice?: MenuPrice | null;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  tagIds?: string[];
}

export interface MenuItemOptionGroupPayload {
  menuItemId?: string;
  name?: string;
  type?: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface MenuItemOptionPayload {
  name?: string;
  price?: MenuPrice;
  sortOrder?: number;
}

interface PaginatedResponse<T> {
  data: T[];
}

const unwrapList = <T>(data: T[] | PaginatedResponse<T>): T[] =>
  Array.isArray(data) ? data : data.data || [];

export const MenuService = {
  // Sections
  getSectionsByRestaurant: async (restaurantId: string): Promise<MenuSection[]> => {
    const { data } = await apiClient.get<MenuSection[] | PaginatedResponse<MenuSection>>(
      `/menu/sections/restaurant/${restaurantId}`,
    );
    return unwrapList(data);
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
  getItemsBySection: async (sectionId: string): Promise<MenuItem[]> => {
    const { data } = await apiClient.get<MenuItem[] | PaginatedResponse<MenuItem>>(
      `/menu/items/section/${sectionId}`,
    );
    return unwrapList(data);
  },
  createItem: async (payload: MenuItemPayload): Promise<MenuItem> => {
    const { data } = await apiClient.post<MenuItem>('/menu/items', payload);
    return data;
  },
  updateItem: async (itemId: string, payload: MenuItemPayload): Promise<MenuItem> => {
    const { data } = await apiClient.patch<MenuItem>(`/menu/items/${itemId}`, payload);
    return data;
  },
  deleteItem: async (itemId: string) => {
    await apiClient.delete(`/menu/items/${itemId}`);
  },
  reorderItems: async (sectionId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/sections/${sectionId}/items/reorder`, { orderedIds });
  },

  // Option Groups
  getOptionGroupsByItem: async (itemId: string): Promise<MenuItemOptionGroup[]> => {
    const { data } = await apiClient.get<
      MenuItemOptionGroup[] | PaginatedResponse<MenuItemOptionGroup>
    >(`/menu/option-groups/item/${itemId}`);
    return unwrapList(data);
  },
  createOptionGroup: async (
    payload: MenuItemOptionGroupPayload,
  ): Promise<MenuItemOptionGroup> => {
    const { data } = await apiClient.post<MenuItemOptionGroup>(
      '/menu/option-groups',
      payload,
    );
    return data;
  },
  updateOptionGroup: async (
    groupId: string,
    payload: MenuItemOptionGroupPayload,
  ): Promise<MenuItemOptionGroup> => {
    const { data } = await apiClient.patch<MenuItemOptionGroup>(
      `/menu/option-groups/${groupId}`,
      payload,
    );
    return data;
  },
  deleteOptionGroup: async (groupId: string) => {
    await apiClient.delete(`/menu/option-groups/${groupId}`);
  },
  reorderOptionGroups: async (itemId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/items/${itemId}/option-groups/reorder`, { orderedIds });
  },

  // Options
  addOptionToGroup: async (
    groupId: string,
    payload: MenuItemOptionPayload,
  ): Promise<MenuItemOption> => {
    const { data } = await apiClient.post<MenuItemOption>(
      `/menu/option-groups/${groupId}/options`,
      payload,
    );
    return data;
  },
  updateOption: async (
    optionId: string,
    payload: MenuItemOptionPayload,
  ): Promise<MenuItemOption> => {
    const { data } = await apiClient.patch<MenuItemOption>(
      `/menu/options/${optionId}`,
      payload,
    );
    return data;
  },
  deleteOption: async (optionId: string) => {
    await apiClient.delete(`/menu/options/${optionId}`);
  },
  reorderOptions: async (groupId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/option-groups/${groupId}/options/reorder`, { orderedIds });
  }
};
