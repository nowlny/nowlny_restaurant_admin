import { apiClient } from './client';

/**
 * One row of `GET /notifications/me`. The spec documents no response schema,
 * so this mirrors what the restaurant app reads: the body may arrive as
 * `body` or `message`, and the order link as `data.orderId` or
 * `metadata.orderId`.
 */
export interface AppNotification {
  id: string;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  isRead: boolean;
  createdAt?: string | null;
  data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationsPage {
  items: AppNotification[];
  page: number;
  totalPages: number;
  total: number;
  /** Across every page, for the badge — not just this page's unread rows. */
  unreadCount: number;
}

export interface FetchNotificationsParams {
  page?: number;
  limit?: number;
  /** Server-side filter to unread rows only. */
  unreadOnly?: boolean;
}

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pickString = (source: Record<string, unknown> | null | undefined, key: string) => {
  const value = source?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

/** The order a notification points at, if any. */
export const notificationOrderId = (n: AppNotification): string =>
  pickString(n.data, 'orderId') || pickString(n.metadata, 'orderId');

export const NotificationsService = {
  /** Newest first, paginated; `unreadCount` comes back on every page. */
  getMine: async (params: FetchNotificationsParams = {}): Promise<NotificationsPage> => {
    const { page = 1, limit = 20, unreadOnly } = params;
    const { data } = await apiClient.get('/notifications/me', {
      params: { page, limit, ...(unreadOnly ? { unreadOnly: true } : {}) },
    });

    const items: AppNotification[] = Array.isArray(data) ? data : data?.data || [];
    const meta = Array.isArray(data) ? undefined : data?.meta;
    return {
      items: items.map((n) => ({ ...n, isRead: Boolean(n.isRead) })),
      page: toNumber(meta?.page, page),
      totalPages: toNumber(meta?.totalPages, 1),
      total: toNumber(meta?.total, items.length),
      unreadCount: toNumber(
        Array.isArray(data) ? undefined : data?.unreadCount,
        items.filter((n) => !n.isRead).length,
      ),
    };
  },
  /** 204 on success, 404 if the notification is gone. */
  markAsRead: async (id: string) => {
    await apiClient.patch(`/notifications/me/${id}/read`);
  },
  markAllAsRead: async () => {
    await apiClient.patch('/notifications/me/read-all');
  },
};
