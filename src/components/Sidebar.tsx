"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Image as ImageIcon, Loader2, LogOut, QrCode, Store, Video, CalendarClock, Truck, Building2, Bell, UserRound } from 'lucide-react';
import { authService } from '@/services/api/auth';
import { clearSession } from '@/services/api/session';
import { useI18n, type MessageKey } from '@/lib/i18n';
import ChromeControls from '@/components/ChromeControls';

export interface SidebarProfile {
  name?: string;
  logo?: string | null;
  backgroundImageUrl?: string | null;
}

const NAV_ITEMS: { labelKey: MessageKey; icon: typeof LayoutDashboard; href: string }[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/' },
  { labelKey: 'nav.orders', icon: ShoppingBag, href: '/orders' },
  { labelKey: 'nav.menu', icon: Utensils, href: '/menu' },
  { labelKey: 'nav.stock_schedules', icon: CalendarClock, href: '/menu/stock-schedules' },
  { labelKey: 'nav.qr', icon: QrCode, href: '/qr' },
  { labelKey: 'nav.stories', icon: ImageIcon, href: '/stories' },
  { labelKey: 'nav.reels', icon: Video, href: '/reels' },
  { labelKey: 'nav.fleet', icon: Truck, href: '/fleet' },
  { labelKey: 'nav.integrations', icon: Building2, href: '/integrations' },
  { labelKey: 'nav.notifications', icon: Bell, href: '/notifications' },
  { labelKey: 'nav.settings', icon: Settings, href: '/settings' },
  { labelKey: 'nav.account', icon: UserRound, href: '/account' },
];

export default function Sidebar({
  profile,
  isOpen,
  onClose,
  statusSlot,
}: {
  /** Supplied by the dashboard shell, which has already fetched it. */
  profile?: SidebarProfile | null;
  isOpen?: boolean;
  onClose?: () => void;
  /** Rendered under the restaurant header — the busy-mode switch. */
  statusSlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // The most specific match wins, so /menu/stock-schedules lights up its own
  // entry and not Menu as well.
  const activeHref = NAV_ITEMS.map((item) => item.href)
    .filter((href) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  // The open drawer closes on Escape like any other overlay.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // Clear the local session even if the token already expired.
    } finally {
      clearSession();
      router.replace('/auth/login');
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-scrim mobile-only" onClick={onClose} aria-hidden="true" />}

      <aside className={`sidebar mobile-sidebar ${isOpen ? 'open' : ''}`} aria-label={t('nav.partner_dashboard')}>
        <div className="sidebar-hero">
          {profile?.backgroundImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN host
            <img src={profile.backgroundImageUrl} alt="" width={260} height={132} decoding="async" />
          )}
          <div className="sidebar-identity">
            {profile?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN host
              <img src={profile.logo} alt="" className="sidebar-logo" width={42} height={42} decoding="async" />
            ) : (
              <div className="sidebar-logo">
                <Store color="white" size={20} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h2>{profile?.name || t('nav.default_partner')}</h2>
              <p>{t('nav.partner_dashboard')}</p>
            </div>
          </div>
        </div>

        {statusSlot && <div style={{ padding: '14px 12px 0' }}>{statusSlot}</div>}

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={isActive ? 'page' : undefined}
                onClick={onClose}
              >
                <item.icon size={20} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {/* Appearance and language sit above sign-out: they are shell-wide
              switches, and the sidebar footer is the only chrome every
              signed-in screen shares. */}
          <ChromeControls style={{ justifyContent: 'space-between' }} />
          <button
            type="button"
            className="nav-link nav-link-danger"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} className="flip-in-rtl" />}
            {isLoggingOut ? t('auth.logging_out') : t('auth.log_out')}
          </button>
        </div>
      </aside>
    </>
  );
}
