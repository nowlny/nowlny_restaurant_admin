import Cookies from 'js-cookie';
import { io, Socket } from 'socket.io-client';
import { OrderStatus } from './orders';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://app.nowlny.com/api/v1';

export interface DriverLocation {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  timestamp: string | null;
}

export interface TrackOrderAck {
  ok?: boolean;
  orderId?: string;
  status?: OrderStatus;
  error?: string;
}

interface ServerToClientEvents {
  'driver.location': (payload: DriverLocation) => void;
  'order.status': (payload: { orderId: string; status: OrderStatus }) => void;
  error: (payload: { message?: string } | string) => void;
}

interface ClientToServerEvents {
  track: (
    payload: { orderId: string },
    acknowledge: (response: TrackOrderAck) => void,
  ) => void;
  untrack: (payload: { orderId: string }) => void;
}

export type DeliveryTrackingSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

function getDeliverySocketUrl() {
  const base = new URL(
    API_BASE_URL,
    typeof window === 'undefined' ? 'https://app.nowlny.com' : window.location.origin,
  );
  base.pathname = `${base.pathname.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '')}/delivery`;
  base.search = '';
  base.hash = '';
  return base.toString().replace(/\/$/, '');
}

export function createDeliveryTrackingSocket(): DeliveryTrackingSocket {
  const rawToken = Cookies.get('access_token');
  const token = rawToken?.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Your session is missing. Sign in again to track the driver.');
  }

  return io(
    getDeliverySocketUrl(),
    {
      auth: { token },
      autoConnect: false,
      forceNew: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      reconnectionAttempts: Infinity,
    },
  ) as DeliveryTrackingSocket;
}
