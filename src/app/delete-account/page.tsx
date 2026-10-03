"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, saveSession } from '@/services/api/session';
import { useSessionStatus } from '@/lib/useSession';
import { authService } from '@/services/api/auth';
import { getApiErrorMessage, isApiStatus } from '@/services/api/errors';
import { Trash2, ArrowRight, Loader2, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import ChromeControls from '@/components/ChromeControls';
import {
  AUTH_CARD_PADDING,
  AUTH_PAGE_PADDING,
  OTP_LENGTH,
  OtpCodeInput,
  PhoneField,
  emptyOtp,
} from '@/app/auth/_components/AuthInputs';
import '@/app/globals.css';

/** Key + optional server text, so a language switch retranslates the error. */
type DeleteError = { key: MessageKey; text?: string } | null;

export default function DeleteAccountPage() {
  const router = useRouter();
  const { t } = useI18n();
  
  const sessionStatus = useSessionStatus();
  const [ownStep, setStep] = useState<'PHONE' | 'OTP' | 'CONFIRM' | 'SUCCESS'>('PHONE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState<string[]>(emptyOtp);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DeleteError>(null);
  const errorText = error ? error.text || t(error.key) : '';

  /**
   * Someone already signed in skips straight to the confirmation. Derived
   * rather than pushed into state from an effect: the cookies are unreadable
   * during the server render, so an effect would have to correct itself on the
   * client and briefly ask a signed-in operator for their phone number.
   */
  const step =
    ownStep === 'PHONE' && sessionStatus === 'authenticated' ? 'CONFIRM' : ownStep;

  const getFullPhoneNumber = () => {
    let formatted = phoneNumber.replace(/[^0-9]/g, '');
    if (formatted.startsWith('961')) {
      formatted = formatted.substring(3);
    }
    return `+961${formatted}`;
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber) return setError({ key: 'login.error_no_phone' });

    setIsLoading(true);
    try {
      await authService.requestOtp(getFullPhoneNumber());
      setStep('OTP');
    } catch (err: unknown) {
      setError({
        key: 'login.error_send_failed',
        text: getApiErrorMessage(err, ''),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullCode = code.join('');
    if (fullCode.length !== OTP_LENGTH) return setError({ key: 'login.error_no_code' });

    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(getFullPhoneNumber(), fullCode);
      
      if (saveSession(res)) {
        setStep('CONFIRM');
      } else {
        setError({ key: 'delete.auth_failed' });
      }
    } catch (err: unknown) {
      setError({
        key: 'login.error_invalid_code',
        text: getApiErrorMessage(err, ''),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.deleteAccount();
      clearSession();
      setStep('SUCCESS');
    } catch (err: unknown) {
      // 409: already deleted (e.g. a double submit) — the outcome the user wanted.
      if (isApiStatus(err, 409)) {
        clearSession();
        setStep('SUCCESS');
      } else {
        setError({ key: 'delete.failed' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: AUTH_PAGE_PADDING,
      background: 'radial-gradient(circle at top left, var(--accent-light), transparent 40%), var(--bg-base)'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        maxWidth: '440px',
        width: '100%',
        padding: AUTH_CARD_PADDING,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        border: (step === 'CONFIRM' || step === 'SUCCESS') ? '1px solid var(--border-color)' : undefined
      }}>
        <div style={{ textAlign: 'center' }}>
          {step === 'SUCCESS' ? (
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'var(--success-bg)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              color: 'var(--success)'
            }}>
              <CheckCircle2 size={32} />
            </div>
          ) : step === 'CONFIRM' ? (
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'var(--error-bg)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              color: 'var(--error)'
            }}>
              <AlertTriangle size={32} />
            </div>
          ) : (
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'var(--accent-light)', display: 'inline-flex', 
              alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              color: 'var(--accent-primary)'
            }}>
              <Trash2 size={32} />
            </div>
          )}
          
          <h1 style={{ fontSize: 'clamp(24px, 6vw, 28px)', fontWeight: '700', marginBottom: '8px' }}>
            {step === 'SUCCESS' ? t('delete.title_done') : t('delete.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 'PHONE' && t('delete.step_phone')}
            {step === 'OTP' && t('delete.step_otp', { phone: getFullPhoneNumber() })}
            {step === 'CONFIRM' && t('delete.step_confirm')}
            {step === 'SUCCESS' && t('delete.step_done')}
          </p>
        </div>

        <ChromeControls style={{ justifyContent: 'center' }} />

        {errorText && (
          <div role="alert" className="notice notice-error">
            <AlertCircle size={18} />
            <span>{errorText}</span>
          </div>
        )}

        {step === 'PHONE' && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <PhoneField
              label={t('login.phone_label')}
              placeholder={t('login.phone_placeholder')}
              value={phoneNumber}
              onChange={setPhoneNumber}
              autoFocus
            />

            <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('delete.send_otp')}
              {!isLoading && <ArrowRight size={20} className="flip-in-rtl" />}
            </button>
          </form>
        )}

        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <OtpCodeInput
              label={t('login.code_label')}
              value={code}
              onChange={(next) => {
                setError(null);
                setCode(next);
              }}
              autoFocus
            />

            <button type="submit" className="btn-primary" disabled={isLoading || code.join('').length !== OTP_LENGTH} style={{ width: '100%', marginTop: '16px' }}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('delete.verify')}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setStep('PHONE');
                setCode(emptyOtp());
                setError(null);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', marginTop: '8px', fontFamily: 'inherit' }}
            >
              {t('login.change_phone')}
            </button>
          </form>
        )}

        {step === 'CONFIRM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDeleteAccount}
              disabled={isLoading}
              style={{ width: '100%', padding: '14px 16px' }}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
              {t('delete.confirm_cta')}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => router.push('/')}
              disabled={isLoading}
              style={{ width: '100%', padding: '14px 16px' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {step === 'SUCCESS' && (
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            {t('delete.back_to_login')}
          </button>
        )}
      </div>
    </div>
  );
}
