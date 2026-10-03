import { apiClient } from './client';

/*
 * The restaurant's own driver fleet.
 *
 * Drivers register their own accounts in the driver app; a restaurant attaches
 * one by inviting the phone number they signed up with, and the driver accepts
 * from their app. There is no endpoint to create a driver on their behalf, and
 * `UpdateDriverDto` only carries `status` — name and vehicle belong to the
 * driver's own profile (`PATCH /drivers/me`), so the dashboard shows them
 * read-only.
 *
 * Separate from `OrdersService.getDrivers`, which lists only active drivers for
 * the dispatch picker.
 */

export type DriverStatus = 'active' | 'inactive';
export type VehicleType = 'motorcycle' | 'car' | 'bicycle' | 'scooter';

/** Mirrors `OrderDriverResponseDto`; the roster adds `isAvailable`/`createdAt`. */
export interface FleetDriver {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  status: DriverStatus;
  isAvailable?: boolean;
  vehicleType: VehicleType | string | null;
  vehiclePlate: string | null;
  rating?: number;
  totalRatings?: number;
  createdAt?: string;
}

export interface DriverInvitation {
  id: string;
  phoneNumber: string;
  status?: 'pending' | 'accepted' | 'rejected' | string;
  createdAt?: string;
}

export interface ListDriversParams {
  status?: DriverStatus;
  /** Matches name or phone. */
  search?: string;
  page?: number;
  limit?: number;
}

type Raw = Record<string, unknown>;

/** The list endpoints answer `{ data, meta }` or a bare array depending on the deployment. */
const unwrapList = (data: unknown): Raw[] => {
  if (Array.isArray(data)) return data as Raw[];
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as Raw[]) : [];
};

const unwrapEntity = (data: unknown): Raw => {
  const inner = (data as { data?: unknown } | null)?.data;
  return (inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : data ?? {}) as Raw;
};

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const toDriver = (raw: Raw): FleetDriver =>
  ({
    ...raw,
    id: String(raw.id ?? raw._id ?? ''),
    fullName: str(raw.fullName) ?? str(raw.name) ?? null,
    phoneNumber: str(raw.phoneNumber) ?? str(raw.phone) ?? '',
    status: raw.status === 'inactive' ? 'inactive' : 'active',
    vehicleType: str(raw.vehicleType) ?? null,
    vehiclePlate: str(raw.vehiclePlate) ?? null,
  }) as FleetDriver;

/** The invitation's phone has surfaced under several names, sometimes only on the nested driver. */
const toInvitation = (raw: Raw): DriverInvitation => {
  const driver = (raw.driver ?? {}) as Raw;
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? ''),
    phoneNumber:
      str(raw.phoneNumber) ??
      str(raw.phone) ??
      str(raw.phone_number) ??
      str(driver.phoneNumber) ??
      str(driver.phone) ??
      '',
    status: str(raw.status),
    createdAt: str(raw.createdAt),
  };
};

export const FleetService = {
  /** `GET /drivers` — the roster, filterable by status and name/phone. */
  getDrivers: async (params?: ListDriversParams): Promise<FleetDriver[]> => {
    const { data } = await apiClient.get('/drivers', { params });
    return unwrapList(data).map(toDriver);
  },
  getDriver: async (driverId: string): Promise<FleetDriver> => {
    const { data } = await apiClient.get(`/drivers/${driverId}`);
    return toDriver(unwrapEntity(data));
  },
  /** `PATCH /drivers/{id}` — `inactive` stops new order assignments. */
  updateDriverStatus: async (driverId: string, status: DriverStatus): Promise<FleetDriver> => {
    const { data } = await apiClient.patch(`/drivers/${driverId}`, { status });
    return toDriver(unwrapEntity(data));
  },
  /** `DELETE /drivers/{id}` — detaches the driver; their account survives. */
  removeDriver: async (driverId: string) => {
    await apiClient.delete(`/drivers/${driverId}`);
  },

  /** Pending ones only: accepted drivers already show in the roster. */
  getPendingInvitations: async (): Promise<DriverInvitation[]> => {
    const { data } = await apiClient.get('/drivers/invitations');
    return unwrapList(data)
      .map(toInvitation)
      .filter((invitation) => !invitation.status || invitation.status === 'pending');
  },
  /**
   * `POST /drivers/invitations` with an E.164 number.
   * 404 = no driver account on that number, 409 = already in the fleet or invited.
   */
  inviteDriver: async (phoneNumber: string) => {
    const { data } = await apiClient.post('/drivers/invitations', { phoneNumber });
    return data;
  },
  revokeInvitation: async (invitationId: string) => {
    await apiClient.delete(`/drivers/invitations/${invitationId}`);
  },
};
