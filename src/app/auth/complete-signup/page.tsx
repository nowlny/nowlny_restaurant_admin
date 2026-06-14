"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { authService } from '@/services/api/auth';
import { Store, ArrowRight, Loader2 } from 'lucide-react';
import '@/app/globals.css';

export default function CompleteSignupPage() {
  const router = useRouter();
  const [signupToken, setSignupToken] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantDesc, setRestaurantDesc] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('signup_token');
    if (!token) {
      router.push('/auth/login');
    } else {
      setSignupToken(token);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!fullName || !restaurantName) {
      return setError('Full name and restaurant name are required');
    }
    
    if (!signupToken) return;

    setIsLoading(true);
    try {
      const res = await authService.completeSignup({
        fullName,
        signup_token: signupToken,
        application: {
          name: restaurantName,
          description: restaurantDesc
        }
      });
      
      if (res.access_token) {
        Cookies.set('access_token', res.access_token);
        if (res.refresh_token) {
          Cookies.set('refresh_token', res.refresh_token);
        }
        sessionStorage.removeItem('signup_token');
        router.push('/'); // Redirect to dashboard
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete signup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!signupToken) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(circle at top right, var(--accent-light), transparent 40%), var(--bg-base)'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', 
            background: 'var(--accent-light)', display: 'inline-flex', 
            alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
            color: 'var(--accent-primary)'
          }}>
            <Store size={32} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Setup Your Restaurant</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tell us a bit about yourself and your restaurant to complete your application.
          </p>
        </div>

        {error && (
          <div style={{ 
            padding: '12px', background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--error)', borderRadius: '8px', fontSize: '14px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Owner Full Name <span style={{ color: 'var(--error)'}}>*</span></label>
            <input 
              type="text"
              placeholder="John Doe"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Restaurant Name <span style={{ color: 'var(--error)'}}>*</span></label>
            <input 
              type="text"
              placeholder="e.g. Burger King"
              className="input-field"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Description (Optional)</label>
            <textarea 
              placeholder="A brief description of your restaurant..."
              className="input-field"
              value={restaurantDesc}
              onChange={(e) => setRestaurantDesc(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Setup'}
            {!isLoading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
