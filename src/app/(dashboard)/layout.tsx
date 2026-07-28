"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Loader2, Menu, RefreshCw } from 'lucide-react';
import { getApiErrorMessage, isApiNotFound, isApiStatus } from '@/services/api/errors';
import { SettingsService, type RestaurantProfile } from '@/services/api/settings';
import { useI18n } from '@/lib/i18n';
import { useSessionStatus } from '@/lib/useSession';
import ChromeControls from '@/components/ChromeControls';

/** The one route inside the shell that a partner without a restaurant may see. */
const APPLICATION_ROUTE = '/application';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const sessionStatus = useSessionStatus();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * The verified restaurant, held for the lifetime of the shell rather than
   * per-route. This check used to be keyed on `pathname`, so every sidebar
   * click invalidated it: the whole dashboard was replaced by a full-screen
   * spinner while `/restaurants/me` was re-fetched, which read as the app
   * reloading on every navigation.
   */
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [accessFailure, setAccessFailure] = useState<{
    attempt: number;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isApplicationRoute = pathname === APPLICATION_ROUTE;
  const needsRestaurant = !isApplicationRoute;
  /** A failure from an earlier attempt is stale the moment Retry is pressed. */
  const hasAccessFailure = accessFailure?.attempt === attempt;

  useEffect(() => {
    // `loading` means the cookies have not been read yet — not signed out.
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }

    // Already verified this session, on the one route that does not need it,
    // or holding a failure that is waiting on the operator to retry.
    if (restaurant || !needsRestaurant || hasAccessFailure) return;

    let cancelled = false;

    SettingsService.getOwnRestaurant()
      .then((profile) => {
        if (!cancelled) setRestaurant(profile);
      })
      .catch((restaurantError: unknown) => {
        if (cancelled) return;
        if (isApiNotFound(restaurantError)) {
          router.replace(APPLICATION_ROUTE);
          return;
        }
        // A 401 has already been through the refresh interceptor; the session
        // store owns that outcome and will route to the login screen.
        if (isApiStatus(restaurantError, 401)) return;
        // The fallback is left empty and filled in at render time instead of
        // here: `t` is a new closure every render, so depending on it would
        // re-run this effect — and its setState — on every pass.
        setAccessFailure({
          attempt,
          message: getApiErrorMessage(restaurantError, ''),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    hasAccessFailure,
    needsRestaurant,
    restaurant,
    router,
    sessionStatus,
  ]);

  const retryAccessCheck = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const accessError = hasAccessFailure
    ? accessFailure.message || t('gate.access_error_fallback')
    : '';

  const isVerifying =
    sessionStatus === 'loading' ||
    (sessionStatus === 'authenticated' &&
      needsRestaurant &&
      !restaurant &&
      !accessError);

  if (sessionStatus !== 'authenticated' || isVerifying) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  if (accessError && needsRestaurant) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div className="glass-panel" style={{ maxWidth: '460px', padding: '28px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '22px' }}>{t('gate.access_unavailable')}</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{accessError}</p>
          <button className="btn-primary" onClick={retryAccessCheck}>
            <RefreshCw size={18} /> {t('gate.try_again')}
          </button>
          <ChromeControls style={{ justifyContent: 'center', marginTop: '20px' }} />
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
          aria-label={t('nav.open_menu')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', color: 'var(--text-primary)' }}
        >
          <Menu size={24} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', marginInlineStart: '12px' }}>{t('app.short_title')}</h1>
        {/* On mobile the sidebar footer is behind a drawer, so the switches get
            their own home in the header where they stay one tap away. */}
        <ChromeControls style={{ marginInlineStart: 'auto' }} />
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* The profile is handed down rather than fetched again: the sidebar
            used to request `/restaurants/me` itself on every route change, so
            each navigation cost two identical calls. */}
        <Sidebar
          profile={restaurant}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="main-content" style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
