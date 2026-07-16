"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Image as ImageIcon, Loader2, LogOut, Store, Video } from 'lucide-react';
import Cookies from 'js-cookie';
import { SettingsService } from '@/services/api/settings';
import { authService } from '@/services/api/auth';

interface SidebarProfile {
  name?: string;
  logo?: string | null;
  backgroundImageUrl?: string | null;
}

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (pathname === '/application') return;
    let cancelled = false;
    SettingsService.getOwnRestaurant()
      .then((data: SidebarProfile) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        // The dashboard access gate owns profile-fetch errors.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // Clear the local session even if the token already expired.
    } finally {
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      router.replace('/auth/login');
    }
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Orders', icon: ShoppingBag, href: '/orders' },
    { label: 'Menu', icon: Utensils, href: '/menu' },
    { label: 'Stories', icon: ImageIcon, href: '/stories' },
    { label: 'Reels', icon: Video, href: '/reels' },
    { label: 'Settings', icon: Settings, href: '/settings' },
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
        borderRight: '1px solid var(--border-color)',
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
          left: '16px',
          right: '16px',
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
              {profile?.name || 'Nowlny Partner'}
            </h2>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              Partner Dashboard
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-color)' }}>
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
            textAlign: 'left'
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
          {isLoggingOut ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
          {isLoggingOut ? 'Logging out…' : 'Log Out'}
        </button>
      </div>
    </aside>
    </>
  );
}
