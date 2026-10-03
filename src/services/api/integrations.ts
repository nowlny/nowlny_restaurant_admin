import { apiClient } from './client';

/* ---------------------------------------------------------------------------
   Delivery-company integrations (restaurant owner side).

   The OpenAPI spec documents the routes but no response schemas, so the
   shapes below follow what the API returns today (the same integration shape
   `OrdersService.getDeliveryIntegration` reads for dispatch) and every field
   that is not essential is optional. List payloads are normalised because the
   companies list is paginated (`{ data, total, page, limit, totalPages }`).
--------------------------------------------------------------------------- */

export type IntegrationStatus = 'pending' | 'accepted' | 'rejected';

export interface DeliveryCompany {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  phone?: string | null;
  deliveryCharge?: number | string | null;
  currency?: { code?: string; symbol?: string } | null;
  allowDriverVisibility?: boolean;
  rating?: number | string | null;
  totalRatings?: number | null;
  driversCount?: number | null;
  activeDriversCount?: number | null;
  zonesCount?: number | null;
  /** "Restaurants see ACTIVE companies annotated with their integration status." */
  integrationStatus?: IntegrationStatus | null;
}

export interface CompanyIntegration {
  id: string;
  status: IntegrationStatus;
  rejectionReason?: string | null;
  createdAt?: string;
  company: {
    id: string;
    name: string;
    logo?: string | null;
    phone?: string | null;
    allowDriverVisibility?: boolean;
  } | null;
}

export interface CompanyPage {
  companies: DeliveryCompany[];
  page: number;
  totalPages: number;
}

type Envelope<T> = { data?: T[]; page?: number; totalPages?: number; total?: number; limit?: number };

const asList = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const data = (payload as Envelope<T> | null)?.data;
  return Array.isArray(data) ? data : [];
};

export const IntegrationsService = {
  /** `GET /delivery-companies` — active companies only, for a restaurant. */
  getCompanies: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<CompanyPage> => {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const { data } = await apiClient.get<unknown>('/delivery-companies', {
      params: { search: params.search || undefined, page, limit },
    });
    const envelope = (Array.isArray(data) ? {} : (data ?? {})) as Envelope<DeliveryCompany>;
    const total = typeof envelope.total === 'number' ? envelope.total : undefined;
    const totalPages =
      typeof envelope.totalPages === 'number'
        ? envelope.totalPages
        : total !== undefined
          ? Math.max(1, Math.ceil(total / limit))
          : page;
    return {
      companies: asList<DeliveryCompany>(data),
      page: typeof envelope.page === 'number' ? envelope.page : page,
      totalPages,
    };
  },

  /** `GET /delivery-companies/integrations` — the restaurant's current integration, or null. */
  getIntegration: async (): Promise<CompanyIntegration | null> => {
    const { data } = await apiClient.get<CompanyIntegration | null | ''>('/delivery-companies/integrations');
    // An empty 200 body arrives as "" rather than null.
    return data && typeof data === 'object' && 'id' in data ? data : null;
  },

  /** `POST /delivery-companies/:id/integrations` — no body; 409 when already linked or pending. */
  requestIntegration: async (companyId: string): Promise<void> => {
    await apiClient.post(`/delivery-companies/${companyId}/integrations`);
  },

  /** `DELETE /delivery-companies/integrations/:id` — unlink, or withdraw a pending request. */
  removeIntegration: async (integrationId: string): Promise<void> => {
    await apiClient.delete(`/delivery-companies/integrations/${integrationId}`);
  },
};
