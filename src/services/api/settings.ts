import { apiClient } from './client';

export const SettingsService = {
  // Restaurant Profile
  getOwnRestaurant: async () => {
    const { data } = await apiClient.get('/restaurants/me');
    return data;
  },
  getFullRestaurant: async (id: string) => {
    const { data } = await apiClient.get(`/restaurants/${id}/full`);
    return data;
  },
  updateOwnRestaurant: async (payload: any) => {
    const { data } = await apiClient.patch('/restaurants/me', payload);
    return data;
  },

  // Exchange Rates
  getExchangeRates: async () => {
    const { data } = await apiClient.get('/restaurants/me/exchange-rate');
    return Array.isArray(data) ? data : data.data || [];
  },
  setExchangeRate: async (payload: { fromCurrencyId: string; toCurrencyId: string; rate: number }) => {
    const { data } = await apiClient.put('/restaurants/me/exchange-rate', payload);
    return data;
  },
  deleteExchangeRate: async (exchangeRateId?: string) => {
    if (exchangeRateId) {
      await apiClient.delete(`/restaurants/me/exchange-rate/${exchangeRateId}`);
    } else {
      // Remove all overrides
      await apiClient.delete('/restaurants/me/exchange-rate');
    }
  },

  // Currencies
  getCurrencies: async () => {
    const { data } = await apiClient.get('/currencies');
    return Array.isArray(data) ? data : data.data || [];
  }
};
