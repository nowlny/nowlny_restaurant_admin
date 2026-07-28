"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/api/auth';
import { getApiErrorMessage } from '@/services/api/errors';
import { saveSession } from '@/services/api/session';
import { useSessionStatus } from '@/lib/useSession';
import { ChefHat, ArrowRight, Loader2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import ChromeControls from '@/components/ChromeControls';
import '@/app/globals.css';

/**
 * Errors are held as a key plus optional server text rather than a finished
 * string: the operator can flip language while an error is on screen, and a
 * baked-in English sentence would sit there untranslated until they retried.
 */
type LoginError = { key: MessageKey; text?: string } | null;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const sessionStatus = useSessionStatus();
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP code as an array of 4 digits
  const [code, setCode] = useState(['', '', '', '']);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError>(null);
  const errorText = error ? error.text || t(error.key) : '';

  /**
   * A signed-in operator who lands here — a bookmark, the back button — is sent
   * on to the dashboard instead of being asked to authenticate again.
   */
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      router.replace('/');
    }
  }, [router, sessionStatus]);

  const getFullPhoneNumber = () => {
    // Ensure it has the country code
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
      // Focus first OTP input
      setTimeout(() => {
        if (codeInputs.current[0]) codeInputs.current[0].focus();
      }, 100);
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
    if (fullCode.length !== 4) return setError({ key: 'login.error_no_code' });

    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(getFullPhoneNumber(), fullCode);
      const signupToken = res.signup_token ?? res.signupToken;

      if (saveSession(res)) {
        router.replace('/'); // Redirect to dashboard
      } else if (signupToken) {
        // Needs complete signup
        sessionStorage.setItem('signup_token', signupToken);
        router.replace('/auth/complete-signup');
      } else {
        setError({ key: 'login.error_no_token' });
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

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^[0-9]+$/.test(value)) return;
    
    // Handle paste of multiple characters
    if (value.length > 1) {
      const chars = value.split('').slice(0, 4);
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < 4) newCode[index + i] = char;
      });
      setCode(newCode);
      
      // Focus the right input
      const nextIndex = Math.min(index + chars.length, 3);
      if (codeInputs.current[nextIndex]) {
        codeInputs.current[nextIndex]?.focus();
      }
      return;
    }

    // Normal typing
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance
    if (value !== '' && index < 3) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      codeInputs.current[index - 1]?.focus();
    }
  };

  // Nobody is asked to sign in until we know they are not already signed in.
  if (sessionStatus !== 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(circle at top left, var(--accent-light), transparent 40%), var(--bg-base)'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        maxWidth: '440px',
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
            <ChefHat size={32} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>{t('login.title')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 'PHONE'
              ? t('login.phone_prompt')
              : t('login.otp_prompt', { phone: getFullPhoneNumber() })}
          </p>
        </div>

        {/* The switches live on the sign-in screen too: an Arabic operator has
            to be able to change language before they have an account shell. */}
        <ChromeControls style={{ justifyContent: 'center' }} />

        {errorText && (
          <div role="alert" style={{
            padding: '12px', background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)', borderRadius: '8px', fontSize: '14px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {errorText}
          </div>
        )}

        {step === 'PHONE' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="login-phone" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>{t('login.phone_label')}</label>

              {/* A Lebanese number reads +961 71 234 567 in either language, so
                  the field stays LTR even when the page is mirrored. */}
              <div dir="ltr" style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '14px 16px',
                  background: 'var(--bg-elevated)',
                  borderInlineEnd: '1px solid var(--border-light)',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  +961
                </div>
                <input
                  id="login-phone"
                  type="tel"
                  autoComplete="tel-national"
                  placeholder={t('login.phone_placeholder')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    padding: '14px 16px',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            
            <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('login.continue')}
              {!isLoading && <ArrowRight size={20} className="flip-in-rtl" />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <p id="login-code-label" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', margin: 0 }}>{t('login.code_label')}</p>
              {/* Codes read start-to-right in every locale. */}
              <div dir="ltr" role="group" aria-labelledby="login-code-label" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      codeInputs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    aria-label={t('login.code_digit', { index: idx + 1 })}
                    maxLength={4} // Allow paste of full code
                    value={digit}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                    style={{
                      width: '56px',
                      height: '64px',
                      fontSize: '24px',
                      fontWeight: '700',
                      textAlign: 'center',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: digit ? 'var(--shadow-sm)' : 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = digit ? 'var(--shadow-sm)' : 'none';
                    }}
                  />
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading || code.join('').length !== 4} style={{ width: '100%', marginTop: '16px' }}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('login.verify')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('PHONE');
                setCode(['', '', '', '']);
                setError(null);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', marginTop: '8px', fontFamily: 'inherit' }}
            >
              {t('login.change_phone')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
