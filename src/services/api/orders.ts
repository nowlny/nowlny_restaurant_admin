import { apiClient } from './client';

export const OrdersService = {
  getOrders: async (params?: any) => {
    const { data } = await apiClient.get('/orders/restaurant/me', { params });
    return Array.isArray(data) ? data : data.data || [];
  },
  getOrderById: async (orderId: string) => {
    const { data } = await apiClient.get(`/orders/restaurant/me/${orderId}`);
    return data;
  },
  acceptOrder: async (orderId: string) => {
    const { data } = await apiClient.patch(`/orders/me/${orderId}/accept`);
    return data;
  },
  rejectOrder: async (orderId: string, reason: string) => {
    const { data } = await apiClient.patch(`/orders/me/${orderId}/reject`, { reason });
    return data;
  },
  updateOrderStatus: async (orderId: string, status: string) => {
    const { data } = await apiClient.patch(`/orders/${orderId}`, { status });
    return data;
  }
};
