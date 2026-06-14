"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, X, Clock, CheckCircle2, Truck, PackageCheck, ListFilter, AlertCircle } from 'lucide-react';
import { OrdersService } from '@/services/api/orders';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [draggedOverStatus, setDraggedOverStatus] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<string>('pending');

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDraggedOverStatus(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDraggedOverStatus(null);
    const orderId = e.dataTransfer.getData('text/plain');
    if (orderId) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status !== newStatus) {
        if (newStatus === 'rejected') {
          confirmReject(orderId);
        } else if (order.status === 'pending' && newStatus === 'confirmed') {
          await handleAccept(orderId);
        } else {
          await updateStatus(orderId, newStatus);
        }
      }
    }
  };

  useEffect(() => {
    if (selectedOrder || isRejectModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedOrder, isRejectModalOpen]);

  useEffect(() => {
    fetchOrders();
    // In a real app, you would set up a polling interval or WebSocket here
    const interval = setInterval(() => fetchOrders(false), 15000); // Poll every 15s silently
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // Fetch all non-archived orders for Kanban (or just fetch all if that's the only option)
      const data = await OrdersService.getOrders({ limit: 100 });
      setOrders(data);
      
      // If we have a selected order open, update its state silently
      if (selectedOrder) {
        const updatedSelected = data.find((o: any) => o.id === selectedOrder.id);
        if (updatedSelected) setSelectedOrder(updatedSelected);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Status transitions
  const handleAccept = async (orderId: string) => {
    setActionLoading('accept_' + orderId);
    try {
      await OrdersService.acceptOrder(orderId);
      await fetchOrders(false);
    } catch (err) {
      console.error('Failed to accept order', err);
      // Fallback: Try generic update if specific one fails
      try {
        await OrdersService.updateOrderStatus(orderId, 'confirmed');
        await fetchOrders(false);
      } catch (err2) {
        alert("Failed to accept order");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const confirmReject = (orderId: string) => {
    setOrderToReject(orderId);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!orderToReject || !rejectReason) return;
    setActionLoading('reject_' + orderToReject);
    try {
      await OrdersService.rejectOrder(orderToReject, rejectReason);
      setIsRejectModalOpen(false);
      setOrderToReject(null);
      await fetchOrders(false);
    } catch (err) {
      console.error('Failed to reject order', err);
      // Fallback update
      try {
        await OrdersService.updateOrderStatus(orderToReject, 'rejected');
        setIsRejectModalOpen(false);
        setOrderToReject(null);
        await fetchOrders(false);
      } catch(e) {
        alert("Failed to reject order");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    setActionLoading(`status_${orderId}_${status}`);
    try {
      // It might be 'out-for-delivery' or 'out_for_delivery' based on backend, we'll try the generic one
      await OrdersService.updateOrderStatus(orderId, status);
      await fetchOrders(false);
    } catch (err) {
      console.error(`Failed to update to ${status}`, err);
      alert(`Failed to update status to ${status}. Ensure API endpoint supports this.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Kanban buckets
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const confirmedOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'accepted');
  const outOrders = orders.filter(o => o.status === 'out_for_delivery' || o.status === 'out-for-delivery');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');

  const renderKanbanCard = (order: any, actions: React.ReactNode) => {
    return (
      <div 
        key={order.id} 
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', order.id);
          e.currentTarget.style.opacity = '0.5';
        }}
        onDragEnd={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onClick={() => setSelectedOrder(order)}
        style={{ 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          cursor: 'grab',
          backgroundColor: selectedOrder?.id === order.id ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: selectedOrder?.id === order.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
          borderRadius: '12px',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          position: 'relative'
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>#{order.id?.slice(-6).toUpperCase() || 'UNKNOWN'}</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(order.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
          <div style={{ fontWeight: '800', color: 'var(--accent-primary)' }}>
            ${order.totalAmount || order.total || 0}
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {order.items?.length || 0} items • {order.paymentMethod || 'Cash'}
        </div>

        {order.customerNotes && (
          <div style={{ fontSize: '11px', padding: '6px 8px', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)', borderRadius: '4px', display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <AlertCircle size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{order.customerNotes}</span>
          </div>
        )}

        <div style={{ marginTop: '4px' }} onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      </div>
    );
  };

  // Helpers for address handling
  const getAddressText = (address: any) => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    const parts = [];
    if (address.building) parts.push(`Bldg ${address.building}`);
    if (address.floor) parts.push(`Floor ${address.floor}`);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    return parts.join(', ') || 'Address provided on map';
  };

  const getMapQuery = (address: any) => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    if (address.latitude && address.longitude) return `${address.latitude},${address.longitude}`;
    return getAddressText(address);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 48px)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Active Orders Board</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your kitchen workflow and deliveries in real-time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', padding: '8px 16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', animation: 'pulse 2s infinite' }} />
            Live Sync
          </div>
        </div>
      </header>

      {loading && orders.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', flex: 1, alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
        </div>
      ) : (
        <>
          {/* Mobile Tab Navigation */}
          <div className="mobile-only" style={{ display: 'none', gap: '8px', overflowX: 'auto', width: '100%', paddingBottom: '12px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', scrollbarWidth: 'none' }}>
            <button 
              onClick={() => setActiveMobileTab('pending')}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: '600', backgroundColor: activeMobileTab === 'pending' ? 'var(--warning)' : 'var(--bg-elevated)', color: activeMobileTab === 'pending' ? 'white' : 'var(--text-secondary)', border: 'none' }}
            >
              Pending ({pendingOrders.length})
            </button>
            <button 
              onClick={() => setActiveMobileTab('confirmed')}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: '600', backgroundColor: activeMobileTab === 'confirmed' ? '#3b82f6' : 'var(--bg-elevated)', color: activeMobileTab === 'confirmed' ? 'white' : 'var(--text-secondary)', border: 'none' }}
            >
              Preparing ({confirmedOrders.length})
            </button>
            <button 
              onClick={() => setActiveMobileTab('out_for_delivery')}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: '600', backgroundColor: activeMobileTab === 'out_for_delivery' ? '#a855f7' : 'var(--bg-elevated)', color: activeMobileTab === 'out_for_delivery' ? 'white' : 'var(--text-secondary)', border: 'none' }}
            >
              Delivery ({outOrders.length})
            </button>
            <button 
              onClick={() => setActiveMobileTab('delivered')}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: '600', backgroundColor: activeMobileTab === 'delivered' ? 'var(--success)' : 'var(--bg-elevated)', color: activeMobileTab === 'delivered' ? 'white' : 'var(--text-secondary)', border: 'none' }}
            >
              Delivered ({deliveredOrders.length})
            </button>
          </div>

          <div className="kanban-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px', 
            flex: 1, 
            overflow: 'hidden',
            paddingBottom: '16px'
          }}>
          {/* COLUMN 1: PENDING */}
          <div 
            className={`kanban-column ${activeMobileTab === 'pending' ? 'active-mobile-tab' : ''}`}

            onDragOver={(e) => handleDragOver(e, 'pending')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'pending')}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: draggedOverStatus === 'pending' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: draggedOverStatus === 'pending' ? '2px dashed var(--warning)' : '1px solid var(--border-color)', minWidth: 0, minHeight: 0, maxHeight: '100%', transition: 'all 0.2s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid rgba(234, 179, 8, 0.3)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Clock size={18} color="var(--warning)" /> Pending
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '12px' }}>{pendingOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {pendingOrders.map(order => renderKanbanCard(order, (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => confirmReject(order.id)} className="btn-outline" style={{ flex: 1, padding: '6px', fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)', justifyContent: 'center' }} disabled={actionLoading !== null}>
                    Reject
                  </button>
                  <button onClick={() => handleAccept(order.id)} className="btn-primary" style={{ flex: 1, padding: '6px', fontSize: '12px', background: 'var(--success)', justifyContent: 'center' }} disabled={actionLoading !== null}>
                    {actionLoading === 'accept_' + order.id ? <Loader2 size={14} className="animate-spin" /> : 'Accept'}
                  </button>
                </div>
              )))}
            </div>
          </div>

          {/* COLUMN 2: CONFIRMED */}
          <div 
            className={`kanban-column ${activeMobileTab === 'confirmed' ? 'active-mobile-tab' : ''}`}

            onDragOver={(e) => handleDragOver(e, 'confirmed')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'confirmed')}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: draggedOverStatus === 'confirmed' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: draggedOverStatus === 'confirmed' ? '2px dashed #3b82f6' : '1px solid var(--border-color)', minWidth: 0, minHeight: 0, maxHeight: '100%', transition: 'all 0.2s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid rgba(59, 130, 246, 0.3)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={18} color="#3b82f6" /> Preparing
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '12px' }}>{confirmedOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {confirmedOrders.map(order => renderKanbanCard(order, (
                <button 
                  onClick={() => updateStatus(order.id, 'out_for_delivery')} 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '6px', fontSize: '12px', backgroundColor: '#3b82f6', justifyContent: 'center' }} 
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'status_' + order.id + '_out_for_delivery' ? <Loader2 size={14} className="animate-spin" /> : 'Mark Out for Delivery'}
                </button>
              )))}
            </div>
          </div>

          {/* COLUMN 3: OUT FOR DELIVERY */}
          <div 
            className={`kanban-column ${activeMobileTab === 'out_for_delivery' ? 'active-mobile-tab' : ''}`}

            onDragOver={(e) => handleDragOver(e, 'out_for_delivery')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'out_for_delivery')}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: draggedOverStatus === 'out_for_delivery' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: draggedOverStatus === 'out_for_delivery' ? '2px dashed #a855f7' : '1px solid var(--border-color)', minWidth: 0, minHeight: 0, maxHeight: '100%', transition: 'all 0.2s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid rgba(168, 85, 247, 0.3)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Truck size={18} color="#a855f7" /> Delivery
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '12px' }}>{outOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {outOrders.map(order => renderKanbanCard(order, (
                <button 
                  onClick={() => updateStatus(order.id, 'delivered')} 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '6px', fontSize: '12px', backgroundColor: '#a855f7', justifyContent: 'center' }} 
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'status_' + order.id + '_delivered' ? <Loader2 size={14} className="animate-spin" /> : 'Mark Delivered'}
                </button>
              )))}
            </div>
          </div>

          {/* COLUMN 4: DELIVERED */}
          <div 
            className={`kanban-column ${activeMobileTab === 'delivered' ? 'active-mobile-tab' : ''}`}

            onDragOver={(e) => handleDragOver(e, 'delivered')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'delivered')}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: draggedOverStatus === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: draggedOverStatus === 'delivered' ? '2px dashed var(--success)' : '1px solid var(--border-color)', minWidth: 0, minHeight: 0, maxHeight: '100%', transition: 'all 0.2s ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid rgba(16, 185, 129, 0.3)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <PackageCheck size={18} color="var(--success)" /> Delivered
              </h3>
              <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '12px' }}>{deliveredOrders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px', opacity: 0.7 }}>
              {deliveredOrders.map(order => renderKanbanCard(order, (
                <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', padding: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                  <CheckCircle2 size={14} /> Completed
                </div>
              )))}
            </div>
          </div>
          </div>
        </>
      )}

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div className="modal-overlay-mobile" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedOrder(null)}>
          <div 
            className="mobile-full-width" 
            style={{ width: '100%', maxWidth: '450px', height: '100%', borderRadius: '0', backgroundColor: 'var(--bg-base)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, backgroundColor: 'var(--bg-surface)' }}>
              <div>
                <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Order #{selectedOrder.id?.slice(-6).toUpperCase()}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {new Date(selectedOrder.createdAt || Date.now()).toLocaleString()}
                </p>
                <span style={{ 
                  display: 'inline-block', marginTop: '8px', fontSize: '12px', padding: '4px 10px', borderRadius: '12px', fontWeight: '700', textTransform: 'uppercase',
                  backgroundColor: selectedOrder.status === 'pending' ? 'rgba(234, 179, 8, 0.1)' : selectedOrder.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  color: selectedOrder.status === 'pending' ? 'var(--warning)' : selectedOrder.status === 'delivered' ? 'var(--success)' : '#3b82f6'
                }}>
                  {selectedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'var(--bg-elevated)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {selectedOrder.deliveryAddress && (
                <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight={0} 
                    marginWidth={0} 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(getMapQuery(selectedOrder.deliveryAddress))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-elevated)', padding: '16px', borderRadius: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Payment</p>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>{selectedOrder.paymentMethod}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Status</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: selectedOrder.paymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)' }}>{selectedOrder.paymentStatus}</p>
                </div>
                {selectedOrder.customerName && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Customer</p>
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>{selectedOrder.customerName} {selectedOrder.customerPhone && `• ${selectedOrder.customerPhone}`}</p>
                  </div>
                )}
                {selectedOrder.deliveryAddress && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>Delivery Address</p>
                    <p style={{ fontSize: '14px', fontWeight: '500', lineHeight: 1.4 }}>{getAddressText(selectedOrder.deliveryAddress)}</p>
                  </div>
                )}
              </div>

              {selectedOrder.customerNotes && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: '700', marginBottom: '8px' }}>
                    <AlertCircle size={18} />
                    Customer Note
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{selectedOrder.customerNotes}</p>
                </div>
              )}

              <div>
                <h4 style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>Order Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(selectedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: '16px', paddingBottom: '16px', borderBottom: '1px dashed var(--border-color)' }}>
                      <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'var(--accent-primary)', flexShrink: 0 }}>
                        {item.quantity}x
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: '600', fontSize: '15px' }}>{item.menuItem?.name || item.name || 'Item'}</span>
                          <span style={{ fontWeight: '700' }}>${parseFloat(item.subtotal || item.unitPrice || item.price || 0).toFixed(2)}</span>
                        </div>
                        {item.selectedOptions && Object.entries(item.selectedOptions).map(([key, val]: any) => (
                          <div key={key} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-color)', marginTop: '7px' }} />
                            {Array.isArray(val) ? val.join(', ') : val}
                          </div>
                        ))}
                        {item.notes && (
                          <div style={{ fontSize: '13px', color: 'var(--warning)', marginTop: '8px', padding: '8px', backgroundColor: 'rgba(234, 179, 8, 0.05)', borderRadius: '6px' }}>
                            <strong>Note:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '24px', backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>${(selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '24px', color: 'var(--accent-primary)' }}>
                <span>Total</span>
                <span>${(selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', animation: 'scaleIn 0.2s ease' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Reject Order</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>Please provide a reason for rejecting this order. The customer will see this message.</p>
            <textarea 
              className="form-input" 
              rows={4} 
              placeholder="e.g. Item out of stock"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ marginBottom: '24px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-outline" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setIsRejectModalOpen(false)}
                disabled={actionLoading !== null}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center', background: 'var(--error)', border: 'none' }}
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
              >
                {actionLoading === 'reject_' + orderToReject ? <Loader2 size={18} className="animate-spin" /> : null} Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
