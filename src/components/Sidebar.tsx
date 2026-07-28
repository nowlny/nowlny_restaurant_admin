"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Image as ImageIcon, Loader2, LogOut, Store, Video } from 'lucide-react';
import { authService } from '@/services/api/auth';
import { clearSession } from '@/services/api/session';
import { useI18n, type MessageKey } from '@/lib/i18n';
import ChromeControls from '@/components/ChromeControls';

export interface SidebarProfile {
  name?: string;
  logo?: string | null;
  backgroundImageUrl?: string | null;
}

export default function Sidebar({
  profile,
  isOpen,
  onClose,
}: {
  /** Supplied by the dashboard shell, which has already fetched it. */
  profile?: SidebarProfile | null;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const navItems: { labelKey: MessageKey; icon: typeof LayoutDashboard; href: string }[] = [
    { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/' },
    { labelKey: 'nav.orders', icon: ShoppingBag, href: '/orders' },
    { labelKey: 'nav.menu', icon: Utensils, href: '/menu' },
    { labelKey: 'nav.stories', icon: ImageIcon, href: '/stories' },
    { labelKey: 'nav.reels', icon: Video, href: '/reels' },
    { labelKey: 'nav.settings', icon: Settings, href: '/settings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="mobile-only"
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}
      
      <aside className={`mobile-sidebar ${isOpen ? 'open' : ''}`} style={{
        width: '260px',
        backgroundColor: 'var(--bg-surface)',
        borderInlineEnd: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        padding: '0'
      }}>
      {/* Profile Header Block */}
      <div style={{
        position: 'relative',
        height: '140px',
        width: '100%',
        marginBottom: '16px',
        overflow: 'hidden'
      }}>
        {/* Background Image */}
        {profile?.backgroundImageUrl ? (
          <img 
            src={profile.backgroundImageUrl} 
            alt="Background" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--accent-primary)' }} />
        )}
        
        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8))'
        }} />

        {/* Content */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          insetInline: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {profile?.logo ? (
            <img 
              src={profile.logo} 
              alt="Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} 
            />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <Store color="white" size={20} />
            </div>
          )}
          
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'white', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.name || t('nav.default_partner')}
            </h2>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {t('nav.partner_dashboard')}
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
              fontWeight: isActive ? '600' : '500',
              transition: 'all 0.2s ease',
            }}
            onClick={onClose}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}>
              <item.icon size={20} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Appearance and language sit above sign-out: they are shell-wide
            switches, and the sidebar footer is the only chrome every signed-in
            screen shares. */}
        <ChromeControls style={{ justifyContent: 'space-between' }} />
        <button
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            width: '100%',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontFamily: 'inherit',
            fontSize: '1rem',
            transition: 'all 0.2s ease',
            textAlign: 'start'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {isLoggingOut ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} className="flip-in-rtl" />}
          {isLoggingOut ? t('auth.logging_out') : t('auth.log_out')}
        </button>
      </div>
    </aside>
    </>
  );
}
