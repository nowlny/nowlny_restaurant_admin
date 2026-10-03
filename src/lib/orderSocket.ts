"use client";

import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/services/api/session";
import type { RestaurantOrder } from "@/services/api/orders";
import type { ItemStock } from "@/services/api/menu";

/* ---------------------------------------------------------------------------
   Live `/restaurant` socket — the web twin of the mobile app's
   `src/api/http/socketClient.ts`.

   The backend emits to the restaurant's room:
     order.new        a new order is waiting for an answer
     order.updated    status changed (answered on another device, auto-rejected…)
     order.cancelled  the customer pulled it
     driver.assigned  a driver picked it up for delivery

   Decisions carried over from mobile, both of which were bug fixes there:
    - the JWT goes RAW in `auth.token` — a "Bearer " prefix makes the gateway's
      jwt.verify reject it and the socket silently never connects;
    - `forceNew`, so this connection owns its Manager and nothing else on the
      page can tear it down through socket.io multiplexing.

   `auth` is a callback rather than a fixed object: socket.io calls it on every
   (re)connect attempt, so a token rotated by the axios refresh interceptor is
   picked up by the next reconnect without anyone having to tell this module.
--------------------------------------------------------------------------- */

export type RestaurantSocketEvent =
  | "order.new"
  | "order.cancelled"
  | "order.updated"
  | "driver.assigned";

export interface RestaurantOrderEvent {
  order?: Partial<RestaurantOrder> & { _id?: string };
  orderId?: string;
  status?: string;
  reason?: string;
  driverId?: string;
  driverName?: string;
}

export type OrderSocketHandler = (
  event: RestaurantSocketEvent,
  payload: RestaurantOrderEvent,
) => void;

export type OrderSocketStatus = "idle" | "connecting" | "connected" | "disconnected";

/**
 * `menu.stock.updated`: dishes whose stock changed for any reason (by hand, a
 * one-off set or lapsing, a schedule edge or edit). Patch them in place.
 */
export interface MenuStockEvent {
  items: ItemStock[];
}

type MenuStockHandler = (payload: MenuStockEvent) => void;

const EVENTS: RestaurantSocketEvent[] = [
  "order.new",
  "order.cancelled",
  "order.updated",
  "driver.assigned",
];

/**
 * The socket lives at the API's origin, not under `/api/v1` — socket.io would
 * read that path as part of the namespace. Same env var and fallback as
 * `services/api/client.ts`, with an optional override for a split deployment.
 */
function socketOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL || "https://app.nowlny.com/api/v1";
  try {
    return new URL(api).origin;
  } catch {
    return "https://app.nowlny.com";
  }
}

const rawJwt = (token: string | null): string =>
  token ? (token.startsWith("Bearer ") ? token.slice(7) : token) : "";

/** Pulls an order id out of whichever shape the gateway sent. */
export const eventOrderId = (payload: RestaurantOrderEvent): string =>
  String(payload.orderId ?? payload.order?.id ?? payload.order?._id ?? "");

class OrderSocketClient {
  private socket: Socket | null = null;
  private handlers = new Set<OrderSocketHandler>();
  private menuStockHandlers = new Set<MenuStockHandler>();
  private statusListeners = new Set<(status: OrderSocketStatus) => void>();
  private status: OrderSocketStatus = "idle";
  private loggedError = "";

  /** Idempotent: safe to call on every mount. */
  connect(): void {
    if (typeof window === "undefined") return;
    if (!rawJwt(getAccessToken())) return;

    if (this.socket) {
      // Connected, or already retrying — leave it be; rebuilding would abort
      // an in-flight reconnect.
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }

    this.setStatus("connecting");
    const socket = io(`${socketOrigin()}/restaurant`, {
      auth: (cb) => cb({ token: rawJwt(getAccessToken()) }),
      transports: ["websocket"],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });
    this.socket = socket;

    EVENTS.forEach((event) => {
      socket.on(event, (payload: RestaurantOrderEvent | undefined) => {
        const safe = payload && typeof payload === "object" ? payload : {};
        this.handlers.forEach((handler) => {
          try {
            handler(event, safe);
          } catch (error) {
            console.error("[orderSocket] handler failed", error);
          }
        });
      });
    });

    // Kept apart from the order events, which refresh order data.
    socket.on("menu.stock.updated", (payload: MenuStockEvent | undefined) => {
      if (!Array.isArray(payload?.items)) return;
      this.menuStockHandlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error("[orderSocket] menu stock handler failed", error);
        }
      });
    });

    socket.on("connect", () => {
      this.loggedError = "";
      this.setStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      this.setStatus("disconnected");
      // A server-side kick (e.g. the guard rejected an expired token) does not
      // auto-reconnect; retry once the polling safety net has had a chance to
      // refresh the token.
      if (reason === "io server disconnect") {
        window.setTimeout(() => {
          if (this.socket === socket && rawJwt(getAccessToken())) socket.connect();
        }, 5_000);
      }
    });

    socket.on("connect_error", (error) => {
      this.setStatus("disconnected");
      // "Invalid namespace" = gateway not deployed; auth errors = token issue.
      // Log each distinct reason once rather than on every retry.
      const message = error?.message ?? "unknown";
      if (message !== this.loggedError) {
        this.loggedError = message;
        console.warn("[orderSocket] connect_error:", message);
      }
      // The middleware rejected us and socket.io will not retry on its own
      // after an auth failure; try again later with whatever token is current.
      if (!socket.active) {
        window.setTimeout(() => {
          if (this.socket === socket && !socket.connected && rawJwt(getAccessToken())) {
            socket.connect();
          }
        }, 15_000);
      }
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus("idle");
    // Subscribers survive on purpose, same as mobile: the app-level listener
    // subscribes once and must still be attached after a reconnect.
  }

  /** Returns an unsubscribe function. */
  subscribe(handler: OrderSocketHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Returns an unsubscribe function. Survives reconnects like `subscribe`. */
  subscribeMenuStock(handler: MenuStockHandler): () => void {
    this.menuStockHandlers.add(handler);
    return () => {
      this.menuStockHandlers.delete(handler);
    };
  }

  onStatus(listener: (status: OrderSocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  private setStatus(next: OrderSocketStatus) {
    if (next === this.status) return;
    this.status = next;
    this.statusListeners.forEach((listener) => listener(next));
  }
}

export const orderSocket = new OrderSocketClient();
