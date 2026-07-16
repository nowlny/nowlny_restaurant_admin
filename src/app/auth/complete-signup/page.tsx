"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { authService } from "@/services/api/auth";
import { getApiErrorMessage } from "@/services/api/errors";
import {
  Currency,
  restaurantsService,
} from "@/services/api/restaurants";
import { Store, ArrowRight, Loader2 } from "lucide-react";
import "@/app/globals.css";

const subscribeToSignupToken = () => () => undefined;
const getSignupToken = () => sessionStorage.getItem("signup_token");
const getServerSignupToken = () => null;

export default function CompleteSignupPage() {
  const router = useRouter();
  const signupToken = useSyncExternalStore(
    subscribeToSignupToken,
    getSignupToken,
    getServerSignupToken,
  );
  
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantDesc, setRestaurantDesc] = useState('');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState('');
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signupToken) {
      router.replace('/auth/login');
    }

    const fetchCurrencies = async () => {
      try {
        const activeCurrencies = await restaurantsService.getCurrencies();
        setCurrencies(activeCurrencies);
        const defaultCurrency =
          activeCurrencies.find((currency) => currency.code === "USD") ??
          activeCurrencies[0];
        setCurrencyId(defaultCurrency?.code ?? "");
      } catch (currencyError) {
        setError(
          getApiErrorMessage(
            currencyError,
            "Currencies could not be loaded. Please refresh and try again.",
          ),
        );
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    void fetchCurrencies();
  }, [router, signupToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!fullName.trim() || !restaurantName.trim() || !currencyId) {
      return setError('Full name and restaurant name are required');
    }
    
    if (!signupToken) return;

    setIsLoading(true);
    try {
      const res = await authService.completeSignup({
        fullName: fullName.trim(),
        signupToken,
        restaurantName: restaurantName.trim(),
        description: restaurantDesc.trim() || undefined,
        currencyId,
      });
      
      if (res.access_token) {
        Cookies.set('access_token', res.access_token);
        if (res.refresh_token) {
          Cookies.set('refresh_token', res.refresh_token);
        }
        sessionStorage.removeItem('signup_token');
        router.replace('/application');
      }
    } catch (signupError: unknown) {
      setError(
        getApiErrorMessage(
          signupError,
          'Failed to complete signup. Please try again.',
        ),
      );
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
            <label htmlFor="owner-full-name" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Owner Full Name <span style={{ color: 'var(--error)'}}>*</span></label>
            <input 
              id="owner-full-name"
              type="text"
              placeholder="John Doe"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="restaurant-name" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Restaurant Name <span style={{ color: 'var(--error)'}}>*</span></label>
            <input 
              id="restaurant-name"
              type="text"
              placeholder="e.g. Burger King"
              className="input-field"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="restaurant-description" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Description (Optional)</label>
            <textarea 
              id="restaurant-description"
              placeholder="A brief description of your restaurant..."
              className="input-field"
              value={restaurantDesc}
              onChange={(e) => setRestaurantDesc(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="restaurant-currency" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Menu Currency <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              id="restaurant-currency"
              className="input-field"
              value={currencyId}
              onChange={(event) => setCurrencyId(event.target.value)}
              disabled={isLoadingCurrencies}
            >
              {isLoadingCurrencies ? (
                <option value="">Loading currencies...</option>
              ) : currencies.length === 0 ? (
                <option value="">No currencies available</option>
              ) : (
                currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name}
                  </option>
                ))
              )}
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              This currency will be used for menu prices and restaurant reports.
            </span>
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading || isLoadingCurrencies || !currencyId} style={{ width: '100%', marginTop: '8px' }}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Setup'}
            {!isLoading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
