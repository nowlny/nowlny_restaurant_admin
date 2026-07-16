"use client";

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/Sidebar';
import { Loader2, Menu, RefreshCw } from 'lucide-react';
import { getApiErrorMessage, isApiNotFound } from '@/services/api/errors';
import { restaurantsService } from '@/services/api/restaurants';

const subscribeToAccessToken = () => () => undefined;
const getAccessTokenSnapshot = () => Boolean(Cookies.get('access_token'));
const getServerAccessTokenSnapshot = () => false;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hasAccessToken = useSyncExternalStore(
    subscribeToAccessToken,
    getAccessTokenSnapshot,
    getServerAccessTokenSnapshot,
  );
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accessFailure, setAccessFailure] = useState<{
    path: string;
    attempt: number;
    message: string;
  } | null>(null);
  const [accessCheck, setAccessCheck] = useState(0);

  useEffect(() => {
    if (!hasAccessToken) {
      router.replace('/auth/login');
      return;
    }

    if (pathname === '/application') {
      return;
    }

    let cancelled = false;
    restaurantsService
      .getMyRestaurant()
      .then(() => {
        if (!cancelled) setVerifiedPath(pathname);
      })
      .catch((restaurantError: unknown) => {
        if (cancelled) return;
        if (isApiNotFound(restaurantError)) {
          router.replace('/application');
          return;
        }
        setAccessFailure({
          path: pathname,
          attempt: accessCheck,
          message: getApiErrorMessage(
            restaurantError,
            'We could not verify your restaurant access. Please try again.',
          ),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [accessCheck, hasAccessToken, pathname, router]);

  const hasRestaurantAccess =
    pathname === '/application' || verifiedPath === pathname;
  const accessError =
    accessFailure?.path === pathname && accessFailure.attempt === accessCheck
      ? accessFailure.message
      : '';

  if (!hasAccessToken || (!hasRestaurantAccess && !accessError)) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  if (accessError) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div className="glass-panel" style={{ maxWidth: '460px', padding: '28px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '22px' }}>Restaurant access unavailable</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{accessError}</p>
          <button className="btn-primary" onClick={() => setAccessCheck((current) => current + 1)}>
            <RefreshCw size={18} /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Mobile Header */}
      <header className="mobile-only" style={{
        display: 'none', // Overridden by CSS to display: flex !important
        alignItems: 'center',
        padding: '16px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', color: 'var(--text-primary)' }}
        >
          <Menu size={24} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', marginLeft: '12px' }}>Nowlny Admin</h1>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <main className="main-content" style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
