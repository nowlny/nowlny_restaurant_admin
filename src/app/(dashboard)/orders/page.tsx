"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  X,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  AlertCircle,
  Building2,
  Navigation,
  UserRound,
} from "lucide-react";
import DriverTrackingModal from "@/components/DriverTrackingModal";
import {
  DeliveryIntegration,
  ORDER_STATUS_LABELS,
  OrderStatus,
  OrdersService,
  PickupRequest,
  OrderAddress,
  RestaurantOrder,
  RestaurantDriver,
} from "@/services/api/orders";
import { getApiErrorMessage } from "@/services/api/errors";

type BoardOrderStatus = Exclude<OrderStatus, "cancelled" | "rejected">;

const ORDER_STATUS_STYLES: Record<
  OrderStatus,
  { backgroundColor: string; color: string }
> = {
  pending: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    color: "var(--warning)",
  },
  confirmed: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    color: "#3b82f6",
  },
  out_for_delivery: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    color: "#a855f7",
  },
  delivered: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "var(--success)",
  },
  cancelled: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "var(--error)",
  },
  rejected: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "var(--error)",
  },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrder, setSelectedOrder] = useState<RestaurantOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [pickupRequests, setPickupRequests] = useState<PickupRequest[]>([]);
  const [dispatchOrder, setDispatchOrder] = useState<RestaurantOrder | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<RestaurantOrder | null>(null);
  const [drivers, setDrivers] = useState<RestaurantDriver[]>([]);
  const [deliveryIntegration, setDeliveryIntegration] =
    useState<DeliveryIntegration | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [loadingDispatchOptions, setLoadingDispatchOptions] = useState(false);
  const [activeMobileTab, setActiveMobileTab] =
    useState<BoardOrderStatus>("pending");

  useEffect(() => {
    if (selectedOrder || isRejectModalOpen || dispatchOrder || trackingOrder) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedOrder, isRejectModalOpen, dispatchOrder, trackingOrder]);

  const fetchOrders = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [data, requests] = await Promise.all([
        OrdersService.getOrders({ limit: 100 }),
        OrdersService.getPickupRequests().catch(() => []),
      ]);
      setOrders(data);
      setPickupRequests(requests);
      setLastSyncedAt(new Date());
      setSelectedOrder((currentOrder) => {
        if (!currentOrder) return null;
        return data.find((order) => order.id === currentOrder.id) ?? currentOrder;
      });
      setTrackingOrder((currentOrder) => {
        if (!currentOrder) return null;
        return data.find((order) => order.id === currentOrder.id) ?? currentOrder;
      });
    } catch (fetchError: unknown) {
      setActionError(
        getApiErrorMessage(fetchError, "Orders could not be loaded. Please try again."),
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchOrders(), 0);
    const interval = window.setInterval(() => void fetchOrders(false), 15_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  const handleTrackedOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      const updateStatus = (order: RestaurantOrder) =>
        order.id === orderId ? { ...order, status } : order;
      setOrders((currentOrders) => currentOrders.map(updateStatus));
      setSelectedOrder((currentOrder) =>
        currentOrder ? updateStatus(currentOrder) : null,
      );
      setTrackingOrder((currentOrder) =>
        currentOrder ? updateStatus(currentOrder) : null,
      );
    },
    [],
  );

  // Status transitions
  const handleAccept = async (orderId: string) => {
    setActionError("");
    setActionSuccess("");
    setActionLoading("accept_" + orderId);
    try {
      await OrdersService.acceptOrder(orderId);
      setActionSuccess("Order confirmed and ready for dispatch.");
      await fetchOrders(false);
    } catch (acceptError: unknown) {
      setActionError(getApiErrorMessage(acceptError, "Failed to accept this order."));
    } finally {
      setActionLoading(null);
    }
  };

  const confirmReject = (orderId: string) => {
    setOrderToReject(orderId);
    setRejectReason("");
    setIsRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!orderToReject || !rejectReason) return;
    setActionError("");
    setActionSuccess("");
    setActionLoading("reject_" + orderToReject);
    try {
      await OrdersService.rejectOrder(orderToReject, rejectReason);
      setIsRejectModalOpen(false);
      setOrderToReject(null);
      setActionSuccess("Order rejected and the customer was notified.");
      await fetchOrders(false);
    } catch (rejectError: unknown) {
      setActionError(getApiErrorMessage(rejectError, "Failed to reject this order."));
    } finally {
      setActionLoading(null);
    }
  };

  const openDispatchModal = async (order: RestaurantOrder) => {
    setDispatchOrder(order);
    setSelectedDriverId("");
    setLoadingDispatchOptions(true);
    setActionError("");
    setActionSuccess("");

    try {
      const [driverResult, integrationResult] = await Promise.allSettled([
        OrdersService.getDrivers(),
        OrdersService.getDeliveryIntegration(),
      ]);
      const activeDrivers =
        driverResult.status === "fulfilled" ? driverResult.value : [];
      const integration =
        integrationResult.status === "fulfilled" ? integrationResult.value : null;
      setDrivers(activeDrivers);
      setDeliveryIntegration(integration);
      const defaultDriver = activeDrivers.find((driver) => driver.isAvailable);
      setSelectedDriverId(defaultDriver?.id ?? "");

      if (driverResult.status === "rejected" && integrationResult.status === "rejected") {
        setActionError("Dispatch options could not be loaded. Please try again.");
      }
    } finally {
      setLoadingDispatchOptions(false);
    }
  };

  const handleOwnDriverDispatch = async () => {
    if (!dispatchOrder || !selectedDriverId) return;
    setActionLoading(`dispatch_driver_${dispatchOrder.id}`);
    setActionError("");
    try {
      await OrdersService.assignDriver(dispatchOrder.id, selectedDriverId);
      await OrdersService.markOutForDelivery(dispatchOrder.id);
      setDispatchOrder(null);
      setActionSuccess("Driver assigned and the order is out for delivery.");
      await fetchOrders(false);
    } catch (dispatchError: unknown) {
      setActionError(
        getApiErrorMessage(dispatchError, "The driver could not be assigned to this order."),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handlePartnerDispatch = async () => {
    const company = deliveryIntegration?.company;
    if (!dispatchOrder || deliveryIntegration?.status !== "accepted" || !company) return;
    setActionLoading(`dispatch_partner_${dispatchOrder.id}`);
    setActionError("");
    try {
      const request = await OrdersService.requestPickup(dispatchOrder.id, company.id);
      setPickupRequests((current) => [request, ...current]);
      setDispatchOrder(null);
      setActionSuccess(`Pickup requested from ${company.name}.`);
      await fetchOrders(false);
    } catch (dispatchError: unknown) {
      setActionError(
        getApiErrorMessage(dispatchError, "The delivery pickup could not be requested."),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const activePickupForOrder = (orderId: string) =>
    pickupRequests.find(
      (request) =>
        request.order?.id === orderId &&
        ["pending", "accepted", "driver_assigned", "picked_up"].includes(
          request.status,
        ),
    );

  // Kanban buckets
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const outForDeliveryOrders = orders.filter(
    (o) => o.status === "out_for_delivery",
  );
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  const formatOrderCurrency = (
    order: RestaurantOrder,
    value: number | string | undefined,
  ) => {
    const currency = order.restaurant?.currency;
    const code = currency?.code ?? "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).format(Number(value || 0));
    } catch {
      return `${Number(value || 0).toFixed(2)} ${currency?.symbol ?? code}`;
    }
  };

  const renderKanbanCard = (
    order: RestaurantOrder,
    actions: React.ReactNode,
  ) => {
    return (
      <div
        key={order.id}
        onClick={() => setSelectedOrder(order)}
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          cursor: "pointer",
          backgroundColor:
            selectedOrder?.id === order.id
              ? "var(--bg-elevated)"
              : "var(--bg-surface)",
          border:
            selectedOrder?.id === order.id
              ? "1px solid var(--accent-primary)"
              : "1px solid var(--border-color)",
          borderRadius: "12px",
          transition: "all 0.2s ease",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          position: "relative",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h4
              style={{
                fontWeight: "700",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              {order.orderNumber || `#${order.id?.slice(-6).toUpperCase() || "UNKNOWN"}`}
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Time unavailable"}
            </p>
          </div>
          <div style={{ fontWeight: "800", color: "var(--accent-primary)" }}>
            {formatOrderCurrency(order, order.totalAmount || order.total || 0)}
          </div>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          {order.items?.length || 0} items • {order.paymentMethod || "Cash"}
        </div>

        {order.customerNotes && (
          <div
            style={{
              fontSize: "11px",
              padding: "6px 8px",
              backgroundColor: "rgba(234, 179, 8, 0.1)",
              color: "var(--warning)",
              borderRadius: "4px",
              display: "flex",
              gap: "4px",
              alignItems: "flex-start",
            }}
          >
            <AlertCircle
              size={12}
              style={{ marginTop: "2px", flexShrink: 0 }}
            />
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {order.customerNotes}
            </span>
          </div>
        )}

        <div style={{ marginTop: "4px" }} onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      </div>
    );
  };

  // Helpers for address handling
  const getAddressText = (
    address: OrderAddress | string | null | undefined,
    isPending = false,
  ) => {
    if (!address) return "";
    if (typeof address === "string") return isPending ? "****" : address;
    if (isPending) {
      return `${address.city || "Unknown City"}, ****`;
    }
    const parts = [];
    if (address.building) parts.push(`Bldg ${address.building}`);
    if (address.floor) parts.push(`Floor ${address.floor}`);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    return parts.join(", ") || "Address provided on map";
  };

  const formatName = (name: string, isPending: boolean) => {
    if (!name) return "";
    if (isPending) return name.substring(0, 3) + "****";
    return name;
  };

  const formatPhone = (phone: string, isPending: boolean) => {
    if (!phone) return "";
    if (isPending) return phone.substring(0, 5) + "****";
    return phone;
  };

  const getMapQuery = (address: OrderAddress | string | null | undefined) => {
    if (!address) return "";
    if (typeof address === "string") return address;
    if (address.latitude && address.longitude)
      return `${address.latitude},${address.longitude}`;
    return getAddressText(address);
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        height: "calc(100vh - 48px)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            Active Orders Board
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Manage your kitchen workflow and delivery handoffs.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: "600",
              padding: "8px 16px",
              backgroundColor: "var(--bg-elevated)",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--success)",
                animation: "pulse 2s infinite",
              }}
            />
            {lastSyncedAt
              ? `Updated ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Checking orders"}
          </div>
        </div>
      </header>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            color: "var(--error)",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            color: "var(--success)",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          {actionSuccess}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "40px",
            flex: 1,
            alignItems: "center",
          }}
        >
          <Loader2
            className="animate-spin"
            size={32}
            color="var(--accent-primary)"
          />
        </div>
      ) : (
        <>
          {/* Mobile Tab Navigation */}
          <div
            className="mobile-only"
            style={{
              display: "none",
              gap: "8px",
              overflowX: "auto",
              width: "100%",
              paddingBottom: "12px",
              marginBottom: "8px",
              borderBottom: "1px solid var(--border-color)",
              scrollbarWidth: "none",
            }}
          >
            <button
              onClick={() => setActiveMobileTab("pending")}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor:
                  activeMobileTab === "pending"
                    ? "var(--warning)"
                    : "var(--bg-elevated)",
                color:
                  activeMobileTab === "pending"
                    ? "white"
                    : "var(--text-secondary)",
                border: "none",
              }}
            >
              {ORDER_STATUS_LABELS.pending} ({pendingOrders.length})
            </button>
            <button
              onClick={() => setActiveMobileTab("confirmed")}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor:
                  activeMobileTab === "confirmed"
                    ? "#3b82f6"
                    : "var(--bg-elevated)",
                color:
                  activeMobileTab === "confirmed"
                    ? "white"
                    : "var(--text-secondary)",
                border: "none",
              }}
            >
              {ORDER_STATUS_LABELS.confirmed} ({confirmedOrders.length})
            </button>
            <button
              onClick={() => setActiveMobileTab("out_for_delivery")}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor:
                  activeMobileTab === "out_for_delivery"
                    ? "#a855f7"
                    : "var(--bg-elevated)",
                color:
                  activeMobileTab === "out_for_delivery"
                    ? "white"
                    : "var(--text-secondary)",
                border: "none",
              }}
            >
              {ORDER_STATUS_LABELS.out_for_delivery} ({outForDeliveryOrders.length})
            </button>
            <button
              onClick={() => setActiveMobileTab("delivered")}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor:
                  activeMobileTab === "delivered"
                    ? "var(--success)"
                    : "var(--bg-elevated)",
                color:
                  activeMobileTab === "delivered"
                    ? "white"
                    : "var(--text-secondary)",
                border: "none",
              }}
            >
              {ORDER_STATUS_LABELS.delivered} ({deliveredOrders.length})
            </button>
          </div>

          <div
            className="kanban-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              flex: 1,
              overflow: "hidden",
              paddingBottom: "16px",
            }}
          >
            {/* COLUMN 1: PENDING */}
            <div
              className={`kanban-column ${activeMobileTab === "pending" ? "active-mobile-tab" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                backgroundColor: "rgba(0,0,0,0.02)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "2px solid rgba(234, 179, 8, 0.3)",
                  paddingBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  <Clock size={18} color="var(--warning)" />{" "}
                  {ORDER_STATUS_LABELS.pending}
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    backgroundColor: "var(--bg-elevated)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {pendingOrders.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  overflowY: "auto",
                  flex: 1,
                  paddingRight: "4px",
                }}
              >
                {pendingOrders.map((order) =>
                  renderKanbanCard(
                    order,
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => confirmReject(order.id)}
                        className="btn-outline"
                        style={{
                          flex: 1,
                          padding: "6px",
                          fontSize: "12px",
                          color: "var(--error)",
                          borderColor: "var(--error)",
                          justifyContent: "center",
                        }}
                        disabled={actionLoading !== null}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAccept(order.id)}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          padding: "6px",
                          fontSize: "12px",
                          background: "var(--success)",
                          justifyContent: "center",
                        }}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "accept_" + order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          "Accept"
                        )}
                      </button>
                    </div>,
                  ),
                )}
              </div>
            </div>

            {/* COLUMN 2: CONFIRMED */}
            <div
              className={`kanban-column ${activeMobileTab === "confirmed" ? "active-mobile-tab" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                backgroundColor: "rgba(0,0,0,0.02)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "2px solid rgba(59, 130, 246, 0.3)",
                  paddingBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  <CheckCircle2 size={18} color="#3b82f6" />{" "}
                  {ORDER_STATUS_LABELS.confirmed}
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    backgroundColor: "var(--bg-elevated)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {confirmedOrders.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  overflowY: "auto",
                  flex: 1,
                  paddingRight: "4px",
                }}
              >
                {confirmedOrders.map((order) => {
                  const pickupRequest = activePickupForOrder(order.id);
                  return renderKanbanCard(
                    order,
                    pickupRequest ? (
                      <div
                        style={{
                          padding: "7px 10px",
                          borderRadius: "7px",
                          textAlign: "center",
                          color: "#3b82f6",
                          background: "rgba(59, 130, 246, 0.1)",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {pickupRequest.status === "driver_assigned"
                          ? "Partner driver assigned"
                          : pickupRequest.status === "accepted"
                            ? "Pickup accepted"
                            : "Waiting for pickup partner"}
                      </div>
                    ) : (
                      <button
                        onClick={() => void openDispatchModal(order)}
                        className="btn-primary"
                        style={{
                          width: "100%",
                          padding: "6px",
                          fontSize: "12px",
                          backgroundColor: "#3b82f6",
                          justifyContent: "center",
                        }}
                        disabled={actionLoading !== null}
                      >
                        Dispatch order
                      </button>
                    ),
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: OUT FOR DELIVERY */}
            <div
              className={`kanban-column ${activeMobileTab === "out_for_delivery" ? "active-mobile-tab" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                backgroundColor: "rgba(0,0,0,0.02)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "2px solid rgba(168, 85, 247, 0.3)",
                  paddingBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  <Truck size={18} color="#a855f7" />{" "}
                  {ORDER_STATUS_LABELS.out_for_delivery}
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    backgroundColor: "var(--bg-elevated)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {outForDeliveryOrders.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  overflowY: "auto",
                  flex: 1,
                  paddingRight: "4px",
                }}
              >
                {outForDeliveryOrders.map((order) =>
                  renderKanbanCard(
                    order,
                    <button
                      type="button"
                      onClick={() => setTrackingOrder(order)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        fontSize: "12px",
                        color: "#a855f7",
                        backgroundColor: "rgba(168, 85, 247, 0.1)",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        borderRadius: "7px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Navigation size={14} /> Track driver
                    </button>,
                  ),
                )}
              </div>
            </div>

            {/* COLUMN 4: DELIVERED */}
            <div
              className={`kanban-column ${activeMobileTab === "delivered" ? "active-mobile-tab" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                backgroundColor: "rgba(0,0,0,0.02)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "2px solid rgba(16, 185, 129, 0.3)",
                  paddingBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-primary)",
                  }}
                >
                  <PackageCheck size={18} color="var(--success)" />{" "}
                  {ORDER_STATUS_LABELS.delivered}
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    backgroundColor: "var(--bg-elevated)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {deliveredOrders.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  overflowY: "auto",
                  flex: 1,
                  paddingRight: "4px",
                  opacity: 0.7,
                }}
              >
                {deliveredOrders.map((order) =>
                  renderKanbanCard(
                    order,
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--success)",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        justifyContent: "center",
                        padding: "6px",
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        borderRadius: "6px",
                      }}
                    >
                      <CheckCircle2 size={14} /> Completed
                    </div>,
                  ),
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div
          className="modal-overlay-mobile"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 60,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="mobile-full-width"
            style={{
              width: "100%",
              maxWidth: "450px",
              height: "100%",
              borderRadius: "0",
              backgroundColor: "var(--bg-base)",
              borderLeft: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "24px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexShrink: 0,
                backgroundColor: "var(--bg-surface)",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "800",
                    marginBottom: "4px",
                  }}
                >
                  Order #{selectedOrder.id?.slice(-6).toUpperCase()}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString()
                    : "Time unavailable"}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "8px",
                    fontSize: "12px",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontWeight: "700",
                    backgroundColor:
                      ORDER_STATUS_STYLES[selectedOrder.status].backgroundColor,
                    color: ORDER_STATUS_STYLES[selectedOrder.status].color,
                  }}
                >
                  {ORDER_STATUS_LABELS[selectedOrder.status]}
                </span>
                {selectedOrder.status === "out_for_delivery" && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setTrackingOrder(selectedOrder)}
                    style={{ marginTop: "12px", padding: "7px 11px", fontSize: "12px" }}
                  >
                    <Navigation size={14} /> Track driver
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: "var(--bg-elevated)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}
            >
              {selectedOrder.deliveryAddress && (
                <div
                  style={{
                    width: "100%",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--border-color)",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    style={{
                      filter: selectedOrder.status === "pending" ? "blur(5px)" : "none",
                      pointerEvents: selectedOrder.status === "pending" ? "none" : "auto",
                      transition: "filter 0.3s ease",
                    }}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(getMapQuery(selectedOrder.deliveryAddress))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  />
                  {selectedOrder.status === "pending" && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        color: "white",
                        fontWeight: "600",
                        fontSize: "14px",
                        zIndex: 10,
                      }}
                    >
                      Accept order to view exact location
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  backgroundColor: "var(--bg-elevated)",
                  padding: "16px",
                  borderRadius: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      fontWeight: "700",
                    }}
                  >
                    Payment
                  </p>
                  <p style={{ fontSize: "14px", fontWeight: "600" }}>
                    {selectedOrder.paymentMethod}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      fontWeight: "700",
                    }}
                  >
                    Status
                  </p>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color:
                        selectedOrder.paymentStatus === "paid"
                          ? "var(--success)"
                          : "var(--warning)",
                    }}
                  >
                    {selectedOrder.paymentStatus}
                  </p>
                </div>
                {(selectedOrder.customerName || selectedOrder.customer?.user?.fullName) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "4px",
                        textTransform: "uppercase",
                        fontWeight: "700",
                      }}
                    >
                      Customer
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>
                        {formatName(selectedOrder.customerName || selectedOrder.customer?.user?.fullName || "", selectedOrder.status === "pending")}
                      </span>
                      {" "}
                      {(selectedOrder.customerPhone || selectedOrder.customer?.user?.phoneNumber) && (
                        <>
                          <span>•</span>
                          <span>
                            {formatPhone(selectedOrder.customerPhone || selectedOrder.customer?.user?.phoneNumber || "", selectedOrder.status === "pending")}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}
                {selectedOrder.deliveryAddress && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "4px",
                        textTransform: "uppercase",
                        fontWeight: "700",
                      }}
                    >
                      Delivery Address
                    </p>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: "500",
                        lineHeight: 1.4,
                        display: "inline-block",
                      }}
                    >
                      {getAddressText(selectedOrder.deliveryAddress, selectedOrder.status === "pending")}
                    </p>
                  </div>
                )}
              </div>

              {selectedOrder.customerNotes && (
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "rgba(234, 179, 8, 0.1)",
                    borderRadius: "12px",
                    border: "1px solid rgba(234, 179, 8, 0.2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "var(--warning)",
                      fontWeight: "700",
                      marginBottom: "8px",
                    }}
                  >
                    <AlertCircle size={18} />
                    Customer Note
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-primary)",
                      lineHeight: "1.5",
                    }}
                  >
                    {selectedOrder.customerNotes}
                  </p>
                </div>
              )}

              <div>
                <h4
                  style={{
                    fontWeight: "800",
                    fontSize: "16px",
                    color: "var(--text-primary)",
                    marginBottom: "16px",
                    borderBottom: "2px solid var(--border-color)",
                    paddingBottom: "8px",
                  }}
                >
                  Order Items
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "16px",
                        paddingBottom: "16px",
                        borderBottom: "1px dashed var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          backgroundColor: "var(--bg-elevated)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "700",
                          color: "var(--accent-primary)",
                          flexShrink: 0,
                        }}
                      >
                        {item.quantity}x
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          flex: 1,
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <span style={{ fontWeight: "600", fontSize: "15px" }}>
                            {item.menuItem?.name || item.name || "Item"}
                          </span>
                          <span style={{ fontWeight: "700" }}>
                            {formatOrderCurrency(
                              selectedOrder,
                              item.subtotal || item.unitPrice || item.price || 0,
                            )}
                          </span>
                        </div>
                        {item.selectedOptions &&
                          Object.entries(item.selectedOptions).map(
                            ([key, val]) => (
                              <div
                                key={key}
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text-secondary)",
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                  marginTop: "4px",
                                }}
                              >
                                <span
                                  style={{
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    backgroundColor: "var(--border-color)",
                                    marginTop: "7px",
                                  }}
                                />
                                {Array.isArray(val) ? val.join(", ") : String(val)}
                              </div>
                            ),
                          )}
                        {item.notes && (
                          <div
                            style={{
                              fontSize: "13px",
                              color: "var(--warning)",
                              marginTop: "8px",
                              padding: "8px",
                              backgroundColor: "rgba(234, 179, 8, 0.05)",
                              borderRadius: "6px",
                            }}
                          >
                            <strong>Note:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "24px",
                backgroundColor: "var(--bg-elevated)",
                borderTop: "1px solid var(--border-color)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  color: "var(--text-secondary)",
                }}
              >
                <span>Subtotal</span>
                <span>
                  {formatOrderCurrency(
                    selectedOrder,
                    selectedOrder.subtotal || selectedOrder.totalAmount || selectedOrder.total || 0,
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: "800",
                  fontSize: "24px",
                  color: "var(--accent-primary)",
                }}
              >
                <span>Total</span>
                <span>
                  {formatOrderCurrency(
                    selectedOrder,
                    selectedOrder.totalAmount || selectedOrder.total || 0,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {trackingOrder && (
        <DriverTrackingModal
          order={trackingOrder}
          onClose={() => setTrackingOrder(null)}
          onOrderStatus={handleTrackedOrderStatus}
        />
      )}

      {dispatchOrder && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 90,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setDispatchOrder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispatch-order-title"
            className="glass-panel"
            style={{ width: "100%", maxWidth: "560px", padding: "24px" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <p style={{ margin: "0 0 4px", color: "var(--text-muted)", fontSize: "12px" }}>
                  {dispatchOrder.orderNumber || `Order #${dispatchOrder.id?.slice(-6).toUpperCase()}`}
                </p>
                <h3 id="dispatch-order-title" style={{ margin: 0, fontSize: "22px" }}>
                  Choose a delivery handoff
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close dispatch options"
                onClick={() => setDispatchOrder(null)}
                style={{ border: 0, background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={22} />
              </button>
            </div>

            {actionError && (
              <div
                role="alert"
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  color: "var(--error)",
                  background: "rgba(239, 68, 68, 0.08)",
                }}
              >
                {actionError}
              </div>
            )}

            {loadingDispatchOptions ? (
              <div style={{ minHeight: "180px", display: "grid", placeItems: "center" }}>
                <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                <section
                  style={{
                    padding: "18px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "14px",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
                    <UserRound size={20} color="var(--accent-primary)" />
                    <div>
                      <strong>Use your own driver</strong>
                      <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>
                        Assign an available fleet driver and send the order now.
                      </p>
                    </div>
                  </div>
                  {drivers.length > 0 ? (
                    <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }} className="flex-col-mobile">
                      <select
                        className="form-input"
                        aria-label="Restaurant driver"
                        value={selectedDriverId}
                        onChange={(event) => setSelectedDriverId(event.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select an available driver</option>
                        {drivers.map((driver) => (
                          <option key={driver.id} value={driver.id} disabled={!driver.isAvailable}>
                            {driver.fullName || driver.phoneNumber}
                            {driver.isAvailable ? "" : " — off shift"}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!selectedDriverId || actionLoading !== null}
                        onClick={() => void handleOwnDriverDispatch()}
                      >
                        {actionLoading === `dispatch_driver_${dispatchOrder.id}` && (
                          <Loader2 className="animate-spin" size={17} />
                        )}
                        Assign & send
                      </button>
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
                      No active fleet drivers are available. Invite or activate a driver before using this option.
                    </p>
                  )}
                </section>

                <section
                  style={{
                    padding: "18px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "14px",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
                    <Building2 size={20} color="#3b82f6" />
                    <div>
                      <strong>Use a delivery partner</strong>
                      <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>
                        Send a pickup request to your connected delivery company.
                      </p>
                    </div>
                  </div>
                  {deliveryIntegration?.status === "accepted" && deliveryIntegration.company ? (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ width: "100%", justifyContent: "center" }}
                      disabled={actionLoading !== null}
                      onClick={() => void handlePartnerDispatch()}
                    >
                      {actionLoading === `dispatch_partner_${dispatchOrder.id}` && (
                        <Loader2 className="animate-spin" size={17} />
                      )}
                      Request pickup from {deliveryIntegration.company.name}
                    </button>
                  ) : (
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
                      {deliveryIntegration?.status === "pending"
                        ? "Your delivery-company connection is still pending approval."
                        : "No accepted delivery-company connection is configured."}
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "24px",
              animation: "scaleIn 0.2s ease",
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "700",
                marginBottom: "16px",
              }}
            >
              Reject Order
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "16px",
                fontSize: "14px",
              }}
            >
              Please provide a reason for rejecting this order. The customer
              will see this message.
            </p>
            <textarea
              className="form-input"
              rows={4}
              placeholder="e.g. Item out of stock"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginBottom: "24px" }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn-outline"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setIsRejectModalOpen(false)}
                disabled={actionLoading !== null}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  background: "var(--error)",
                  border: "none",
                }}
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
              >
                {actionLoading === "reject_" + orderToReject ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : null}{" "}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `,
        }}
      />
    </div>
  );
}
