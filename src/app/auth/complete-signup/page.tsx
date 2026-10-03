"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/api/auth";
import { saveSession } from "@/services/api/session";
import { getApiErrorMessage } from "@/services/api/errors";
import {
  Currency,
  restaurantsService,
} from "@/services/api/restaurants";
import { Store, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import ChromeControls from "@/components/ChromeControls";
import { AUTH_CARD_PADDING, AUTH_PAGE_PADDING } from "../_components/AuthInputs";
import "@/app/globals.css";

/** Key + optional server text, so a language switch retranslates the error. */
type SignupError = { key: MessageKey; text?: string } | null;

const subscribeToSignupToken = () => () => undefined;
const getSignupToken = () => sessionStorage.getItem("signup_token");
/**
 * `undefined` means "not read yet", which is a different answer from `null`'s
 * "read, and there is no token". The server render cannot see `sessionStorage`
 * and used to report `null` — so reloading this page redirected to the login
 * screen before the browser had been asked.
 */
const getServerSignupToken = () => undefined;

export default function CompleteSignupPage() {
  const router = useRouter();
  const { t } = useI18n();
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
  const [error, setError] = useState<SignupError>(null);
  const errorText = error ? error.text || t(error.key) : '';

  useEffect(() => {
    // Only once the read has actually happened.
    if (signupToken === null) {
      router.replace('/auth/login');
    }
  }, [router, signupToken]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const activeCurrencies = await restaurantsService.getCurrencies();
        setCurrencies(activeCurrencies);
        const defaultCurrency =
          activeCurrencies.find((currency) => currency.code === "USD") ??
          activeCurrencies[0];
        setCurrencyId(defaultCurrency?.code ?? "");
      } catch (currencyError) {
        // Only the server's own wording is stored; the fallback is resolved at
        // render time so this effect never has to depend on `t`.
        setError({
          key: "signup.error_currencies",
          text: getApiErrorMessage(currencyError, ""),
        });
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    void fetchCurrencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !restaurantName.trim() || !currencyId) {
      return setError({ key: 'signup.error_required' });
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
      
      if (saveSession(res)) {
        sessionStorage.removeItem('signup_token');
        router.replace('/application');
      } else {
        setError({ key: 'signup.error_no_token' });
      }
    } catch (signupError: unknown) {
      setError({
        key: 'signup.error_failed',
        text: getApiErrorMessage(signupError, ''),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (signupToken === undefined) {
    // The token has not been read yet — not the same as not having one.
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  // Read, and absent: the effect above is on its way to the login screen.
  if (!signupToken) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: AUTH_PAGE_PADDING,
      background: 'radial-gradient(circle at top right, var(--accent-light), transparent 40%), var(--bg-base)'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        maxWidth: '500px',
        width: '100%',
        padding: AUTH_CARD_PADDING,
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
          <h1 style={{ fontSize: 'clamp(24px, 6vw, 28px)', fontWeight: '700', marginBottom: '8px' }}>{t('signup.title')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('signup.subtitle')}
          </p>
        </div>

        <ChromeControls style={{ justifyContent: 'center' }} />

        {errorText && (
          <div role="alert" className="notice notice-error">
            <AlertCircle size={18} />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="field">
            <label htmlFor="owner-full-name" className="field-label">{t('signup.owner_name')} <span aria-hidden="true" style={{ color: 'var(--error)' }}>*</span></label>
            <input
              id="owner-full-name"
              autoComplete="name"
              required
              type="text"
              placeholder={t('signup.owner_name_placeholder')}
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

          <div className="field">
            <label htmlFor="restaurant-name" className="field-label">{t('signup.restaurant_name')} <span aria-hidden="true" style={{ color: 'var(--error)' }}>*</span></label>
            <input
              id="restaurant-name"
              autoComplete="organization"
              required
              type="text"
              placeholder={t('signup.restaurant_name_placeholder')}
              className="form-input"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="restaurant-description" className="field-label">{t('signup.description')}</label>
            <textarea
              id="restaurant-description"
              placeholder={t('signup.description_placeholder')}
              className="form-input"
              value={restaurantDesc}
              onChange={(e) => setRestaurantDesc(e.target.value)}
              rows={3}
            />
          </div>

          <div className="field">
            <label htmlFor="restaurant-currency" className="field-label">
              {t('signup.currency')} <span aria-hidden="true" style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              id="restaurant-currency"
              aria-describedby="restaurant-currency-hint"
              required
              className="form-input"
              value={currencyId}
              onChange={(event) => setCurrencyId(event.target.value)}
              disabled={isLoadingCurrencies}
            >
              {isLoadingCurrencies ? (
                <option value="">{t('signup.currency_loading')}</option>
              ) : currencies.length === 0 ? (
                <option value="">{t('signup.currency_empty')}</option>
              ) : (
                currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name}
                  </option>
                ))
              )}
            </select>
            <p id="restaurant-currency-hint" className="field-hint">
              {t('signup.currency_hint')}
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading || isLoadingCurrencies || !currencyId} style={{ width: '100%', marginTop: '8px' }}>
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('signup.submit')}
            {!isLoading && <ArrowRight size={20} className="flip-in-rtl" />}
          </button>
        </form>
      </div>
    </div>
  );
}
