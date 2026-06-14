"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { authService } from '@/services/api/auth';
import { ChefHat, ArrowRight, Loader2 } from 'lucide-react';
import '@/app/globals.css';

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP code as an array of 4 digits
  const [code, setCode] = useState(['', '', '', '']);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    if (!phoneNumber) return setError('Please enter a phone number');

    setIsLoading(true);
    try {
      await authService.requestOtp(getFullPhoneNumber());
      setStep('OTP');
      // Focus first OTP input
      setTimeout(() => {
        if (codeInputs.current[0]) codeInputs.current[0].focus();
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const fullCode = code.join('');
    if (fullCode.length !== 4) return setError('Please enter the 4-digit code');

    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(getFullPhoneNumber(), fullCode);
      
      if (res.access_token) {
        Cookies.set('access_token', res.access_token);
        if (res.refresh_token) {
          Cookies.set('refresh_token', res.refresh_token);
        }
        router.push('/'); // Redirect to dashboard
      } else if (res.signup_token) {
        // Needs complete signup
        sessionStorage.setItem('signup_token', res.signup_token);
        router.push('/auth/complete-signup');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code');
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
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Partner Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 'PHONE' ? 'Enter your phone number to manage your restaurant' : `Enter the 4-digit code sent to ${getFullPhoneNumber()}`}
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

        {step === 'PHONE' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Phone Number</label>
              
              <div style={{
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
                  borderRight: '1px solid var(--border-light)',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  +961
                </div>
                <input 
                  type="tel"
                  placeholder="71 234 567"
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
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Continue'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Verification Code</label>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      codeInputs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
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
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Login'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setStep('PHONE');
                setCode(['', '', '', '']);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', marginTop: '8px' }}
            >
              Change Phone Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
