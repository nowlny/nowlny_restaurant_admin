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
  sectionId?: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: MenuPrice;
  discountedPrice?: MenuPrice | null;
  sortOrder?: number;
  isActive?: boolean;
  /** In stock right now, schedules and lapsed one-offs included. Read it, never compute it. */
  isAvailable?: boolean;
  isPopular?: boolean;
  optionGroups?: MenuItemOptionGroup[];
  /** ISO time an out-of-stock dish comes back on its own, else null. */
  availableAt?: string | null;
  /** Set while a one-off "out of stock until" runs. */
  outOfStockUntil?: string | null;
  /** What last set the switch. */
  availabilitySource?: 'manual' | 'schedule' | 'one_off';
  /** The dish's own stock schedule (not its section's). */
  stockScheduleId?: string | null;
}

/** One dish's stock, as `menu.stock.updated` reports it. */
export type ItemStock = Pick<
  MenuItem,
  'id' | 'sectionId' | 'isAvailable' | 'availableAt' | 'outOfStockUntil' | 'availabilitySource'
>;

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const WEEK_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export type StockScheduleType = 'available_during' | 'out_of_stock_during';

/** At most one per day; an end before the start runs past midnight. Beirut time, 24h `HH:mm`. */
export interface StockScheduleWindow {
  day: WeekDay;
  startTime: string;
  endTime: string;
}

export interface StockSchedule {
  id: string;
  restaurantId: string;
  name: string;
  type: StockScheduleType;
  windows: StockScheduleWindow[];
  /** Directly attached only. */
  itemIds: string[];
  sectionIds: string[];
}

export interface StockSchedulePayload {
  name: string;
  type: StockScheduleType;
  windows: StockScheduleWindow[];
  /** On update, replaces the whole set when sent. */
  itemIds?: string[];
  sectionIds?: string[];
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  items?: MenuItem[];
  /** Stock schedule every dish in it follows, unless the dish has its own. */
  stockScheduleId?: string | null;
}

export interface MenuItemPayload {
  sectionId?: string;
  name?: string;
  description?: string;
  /** `null` removes the photo; `""` fails the API's URL validation. */
  image?: string | null;
  // Numbers only on the way out — the API validates them as numbers, and the
  // string a form input holds used to be sent as-is.
  price?: number;
  /** `null` clears a sale price. */
  discountedPrice?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  tagIds?: string[];
}

export type OptionGroupType = 'radio' | 'checkbox';

export interface MenuItemOptionGroupPayload {
  menuItemId?: string;
  name?: string;
  type?: OptionGroupType;
  isRequired?: boolean;
  sortOrder?: number;
  /** Create only: choices written in the same request as the group. */
  options?: MenuItemOptionPayload[];
}

export interface MenuItemOptionPayload {
  name?: string;
  price?: number;
  sortOrder?: number;
}

interface PaginatedResponse<T> {
  data: T[];
}

const unwrapList = <T>(data: T[] | PaginatedResponse<T>): T[] =>
  Array.isArray(data) ? data : data.data || [];

/**
 * The id of whatever a create endpoint answered with.
 *
 * The create routes document no response body, and in practice some answer
 * the record, some `{ data: record }`, and older ones `_id`. Reading `.id`
 * straight off the response is how the menu importer used to create a section
 * and then silently skip every dish meant to go in it.
 */
export function readId(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const source = record as { id?: unknown; _id?: unknown; data?: unknown };
  const direct = source.id ?? source._id;
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (typeof direct === 'number') return String(direct);
  return source.data ? readId(source.data) : null;
}

/** The record itself, whether or not it came wrapped in `{ data }`. */
const unwrapRecord = <T>(record: unknown): T | null => {
  if (!record || typeof record !== 'object') return null;
  const source = record as { id?: unknown; _id?: unknown; data?: unknown };
  if (source.id !== undefined || source._id !== undefined) {
    return { ...(record as object), id: readId(record) } as T;
  }
  return source.data ? unwrapRecord<T>(source.data) : null;
};

// Dish photos — mirrors the API's own checks so a bad pick fails instantly
// instead of after a multi-megabyte upload.
export const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MENU_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const MENU_IMAGE_ACCEPT = MENU_IMAGE_MIME_TYPES.join(',');

/** Why a picked file was rejected; the wording is localised at the call site. */
export type MenuImageProblem = 'type' | 'size';

export const checkMenuImage = (file: File): MenuImageProblem | null => {
  if (!MENU_IMAGE_MIME_TYPES.includes(file.type)) return 'type';
  if (file.size > MENU_IMAGE_MAX_BYTES) return 'size';
  return null;
};

export const MenuService = {
  // Sections
  getSectionsByRestaurant: async (restaurantId: string): Promise<MenuSection[]> => {
    const { data } = await apiClient.get<MenuSection[] | PaginatedResponse<MenuSection>>(
      `/menu/sections/restaurant/${restaurantId}`,
    );
    return unwrapList(data);
  },
  // Owners never send `restaurantId`: the API takes it from the token.
  createSection: async (payload: {
    name: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }): Promise<MenuSection | null> => {
    const { data } = await apiClient.post('/menu/sections', payload);
    return unwrapRecord<MenuSection>(data);
  },
  updateSection: async (
    sectionId: string,
    payload: { name?: string; description?: string; sortOrder?: number; isActive?: boolean },
  ): Promise<MenuSection | null> => {
    const { data } = await apiClient.patch(`/menu/sections/${sectionId}`, payload);
    return unwrapRecord<MenuSection>(data);
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
  createItem: async (payload: MenuItemPayload): Promise<MenuItem | null> => {
    const { data } = await apiClient.post('/menu/items', payload);
    return unwrapRecord<MenuItem>(data);
  },
  updateItem: async (itemId: string, payload: MenuItemPayload): Promise<MenuItem | null> => {
    const { data } = await apiClient.patch(`/menu/items/${itemId}`, payload);
    return unwrapRecord<MenuItem>(data);
  },
  /**
   * In or out of stock. Preferred over `updateItem({ isAvailable })`: it is the
   * endpoint that understands stock schedules, and it answers 409 when a
   * one-off would fight the schedule an item follows.
   */
  setItemStock: async (
    itemId: string,
    payload: { isAvailable: boolean; until?: string },
  ): Promise<MenuItem | null> => {
    const { data } = await apiClient.patch(`/menu/items/${itemId}/stock`, payload);
    return unwrapRecord<MenuItem>(data);
  },

  // Stock schedules
  getStockSchedules: async (restaurantId: string): Promise<StockSchedule[]> => {
    const { data } = await apiClient.get<StockSchedule[] | PaginatedResponse<StockSchedule>>(
      `/menu/stock-schedules/restaurant/${restaurantId}`,
    );
    return unwrapList(data);
  },
  /** Takes effect on its dishes at once. 400: overlapping windows; 409: duplicate name or a one-off. */
  createStockSchedule: async (payload: StockSchedulePayload): Promise<StockSchedule | null> => {
    const { data } = await apiClient.post('/menu/stock-schedules', payload);
    return unwrapRecord<StockSchedule>(data);
  },
  updateStockSchedule: async (
    scheduleId: string,
    payload: Partial<StockSchedulePayload>,
  ): Promise<StockSchedule | null> => {
    const { data } = await apiClient.patch(`/menu/stock-schedules/${scheduleId}`, payload);
    return unwrapRecord<StockSchedule>(data);
  },
  /** Restocks what the schedule had taken out; dishes switched off by hand stay off. */
  deleteStockSchedule: async (scheduleId: string) => {
    await apiClient.delete(`/menu/stock-schedules/${scheduleId}`);
  },
  /** `null` detaches. 409 while the dish runs a one-off. */
  setItemStockSchedule: async (itemId: string, stockScheduleId: string | null): Promise<MenuItem | null> => {
    const { data } = await apiClient.put(`/menu/items/${itemId}/stock-schedule`, { stockScheduleId });
    return unwrapRecord<MenuItem>(data);
  },
  /** `null` detaches. 409 while a dish in it runs a one-off. */
  setSectionStockSchedule: async (
    sectionId: string,
    stockScheduleId: string | null,
  ): Promise<MenuSection | null> => {
    const { data } = await apiClient.put(`/menu/sections/${sectionId}/stock-schedule`, { stockScheduleId });
    return unwrapRecord<MenuSection>(data);
  },
  uploadImage: async (file: File): Promise<string> => {
    const body = new FormData();
    body.append('file', file);
    const { data } = await apiClient.post<{ url?: string; data?: { url?: string } }>(
      '/menu/media',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    const url = data?.url ?? data?.data?.url;
    if (!url) throw new Error('The upload finished without returning a URL.');
    return url;
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
  ): Promise<MenuItemOptionGroup | null> => {
    const { data } = await apiClient.post('/menu/option-groups', payload);
    return unwrapRecord<MenuItemOptionGroup>(data);
  },
  updateOptionGroup: async (
    groupId: string,
    payload: MenuItemOptionGroupPayload,
  ): Promise<MenuItemOptionGroup | null> => {
    const { data } = await apiClient.patch(`/menu/option-groups/${groupId}`, payload);
    return unwrapRecord<MenuItemOptionGroup>(data);
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
  ): Promise<MenuItemOption | null> => {
    const { data } = await apiClient.post(`/menu/option-groups/${groupId}/options`, payload);
    return unwrapRecord<MenuItemOption>(data);
  },
  updateOption: async (
    optionId: string,
    payload: MenuItemOptionPayload,
  ): Promise<MenuItemOption | null> => {
    const { data } = await apiClient.patch(`/menu/options/${optionId}`, payload);
    return unwrapRecord<MenuItemOption>(data);
  },
  deleteOption: async (optionId: string) => {
    await apiClient.delete(`/menu/options/${optionId}`);
  },
  reorderOptions: async (groupId: string, orderedIds: string[]) => {
    await apiClient.put(`/menu/option-groups/${groupId}/options/reorder`, { orderedIds });
  }
};
