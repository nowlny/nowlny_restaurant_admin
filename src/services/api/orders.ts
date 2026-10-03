import { apiClient } from './client';

export const ORDER_STATUSES = [
  // Placed for later; becomes `pending` when the backend releases it at its due time.
  'scheduled',
  'pending',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: 'Scheduled',
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' &&
  (ORDER_STATUSES as readonly string[]).includes(value);

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type PaymentMethod = 'cash' | 'card' | 'wallet';

export interface OrdersQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}

export interface OrderAddress {
  nickname?: string;
  street?: string;
  city?: string;
  building?: string;
  floor?: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
}

export type OrderOptionValue = string | number | string[] | number[];

export interface RestaurantOrderItem {
  quantity: number;
  name?: string;
  menuItem?: { name?: string };
  subtotal?: number | string;
  unitPrice?: number | string;
  price?: number | string;
  selectedOptions?: Record<string, OrderOptionValue>;
  notes?: string;
}

export interface RestaurantOrder {
  id: string;
  orderNumber?: string;
  // A newer backend can add statuses; read it through the safe lookups in
  // components/orders/orderMeta.ts rather than indexing a Record directly.
  status: OrderStatus;
  paymentStatus?: PaymentStatus | (string & {});
  paymentMethod?: PaymentMethod | (string & {});
  subtotal?: number | string;
  deliveryFee?: number | string;
  discount?: number | string;
  total?: number | string;
  totalAmount?: number | string;
  customerNotes?: string | null;
  /** Cash only: the bill the customer will pay with (e.g. 50, 100); absent means no change needed. */
  changeFor?: number | string | null;
  customerName?: string;
  customerPhone?: string;
  customer?: {
    user?: { fullName?: string; phoneNumber?: string };
  } | null;
  deliveryAddress?: OrderAddress | string | null;
  restaurant?: {
    logo?: string | null;
    currency?: { code?: string; symbol?: string | null } | null;
    address?: OrderAddress | null;
  } | null;
  driver?: {
    id: string;
    fullName: string | null;
    phoneNumber: string;
    status: 'active' | 'inactive';
    vehicleType: string | null;
    vehiclePlate: string | null;
    lastLatitude: number | string | null;
    lastLongitude: number | string | null;
    lastLocationAt: string | null;
  } | null;
  items?: RestaurantOrderItem[];
  promoCode?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  /** Set when the order went unanswered and the backend rejected it itself. */
  autoRejectedAt?: string | null;
  /** 0 none, 1 re-pushed, 2 SMS sent, 3 ops alerted, 4 auto-rejected. */
  escalationLevel?: number;
  scheduledFor?: string | null;
  releasedAt?: string | null;
  acceptedAt?: string | null;
  prepTimeMinutes?: number | null;
  estimatedDeliveryAt?: string | null;
  estimatedDeliveryMinutes?: number | null;
  outForDeliveryAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  pickupProofUrl?: string | null;
  deliveryProofUrl?: string | null;
  /** First time any restaurant device showed the order (PATCH .../seen). */
  seenAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const PREP_TIME_MIN = 1;
export const PREP_TIME_MAX = 180;

export interface RestaurantDriver {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  status: 'active' | 'inactive';
  isAvailable: boolean;
  vehicleType: string | null;
  vehiclePlate: string | null;
}

export interface DeliveryIntegration {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  company: {
    id: string;
    name: string;
    logo: string | null;
    phone: string | null;
    allowDriverVisibility: boolean;
  } | null;
}

export type PickupRequestStatus =
  | 'pending'
  | 'accepted'
  | 'driver_assigned'
  | 'picked_up'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

export interface PickupRequest {
  id: string;
  status: PickupRequestStatus;
  order: { id: string; orderNumber: string; status: OrderStatus } | null;
  company: { id: string; name: string } | null;
  driver: { id: string; fullName: string | null } | null;
}

interface PaginatedResponse<T> {
  data: T[];
}

export const OrdersService = {
  getOrders: async (params?: OrdersQuery) => {
    const { data } = await apiClient.get<
      RestaurantOrder[] | PaginatedResponse<RestaurantOrder>
    >('/orders/restaurant/me', { params });
    return Array.isArray(data) ? data : data.data || [];
  },
  getOrderById: async (orderId: string): Promise<RestaurantOrder> => {
    const { data } = await apiClient.get<RestaurantOrder>(`/orders/restaurant/me/${orderId}`);
    return data;
  },
  acceptOrder: async (orderId: string, prepTimeMinutes?: number): Promise<RestaurantOrder> => {
    const { data } = await apiClient.patch<RestaurantOrder>(
      `/orders/me/${orderId}/accept`,
      prepTimeMinutes ? { prepTimeMinutes } : {},
    );
    return data;
  },
  rejectOrder: async (orderId: string, reason: string): Promise<RestaurantOrder> => {
    const { data } = await apiClient.patch<RestaurantOrder>(`/orders/me/${orderId}/reject`, { reason });
    return data;
  },
  /** Idempotent server-side: only the first call stamps `seenAt`. */
  markSeen: async (orderId: string): Promise<RestaurantOrder> => {
    const { data } = await apiClient.patch<RestaurantOrder>(`/orders/me/${orderId}/seen`);
    return data;
  },
  assignDriver: async (orderId: string, driverId: string) => {
    const { data } = await apiClient.patch(`/orders/me/${orderId}/assign-driver`, {
      driverId,
    });
    return data;
  },
  markOutForDelivery: async (orderId: string) => {
    const { data } = await apiClient.patch(`/orders/me/${orderId}/out-for-delivery`);
    return data;
  },
  getDrivers: async (): Promise<RestaurantDriver[]> => {
    const { data } = await apiClient.get<PaginatedResponse<RestaurantDriver>>('/drivers', {
      params: { status: 'active', page: 1, limit: 100 },
    });
    return data.data;
  },
  getDeliveryIntegration: async (): Promise<DeliveryIntegration | null> => {
    const { data } = await apiClient.get<DeliveryIntegration | null>(
      '/delivery-companies/integrations',
    );
    return data;
  },
  getPickupRequests: async (): Promise<PickupRequest[]> => {
    const { data } = await apiClient.get<PaginatedResponse<PickupRequest>>(
      '/pickup-requests',
      { params: { page: 1, limit: 100 } },
    );
    return data.data;
  },
  requestPickup: async (orderId: string, companyId: string): Promise<PickupRequest> => {
    const { data } = await apiClient.post<PickupRequest>('/pickup-requests', {
      orderId,
      companyId,
    });
    return data;
  },
  cancelPickupRequest: async (requestId: string, reason?: string): Promise<PickupRequest> => {
    const { data } = await apiClient.patch<PickupRequest>(
      `/pickup-requests/${requestId}/cancel`,
      reason ? { reason } : {},
    );
    return data;
  },
  getStatistics: async (period?: string) => {
    const { data } = await apiClient.get('/orders/restaurant/me/statistics', {
      params: { period }
    });
    return data;
  }
};
