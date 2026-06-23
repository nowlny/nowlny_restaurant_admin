"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { authService } from '@/services/api/auth';
import { Trash2, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import '@/app/globals.css';

export default function DeleteAccountPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'CONFIRM' | 'SUCCESS'>('PHONE');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState(['', '', '', '']);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already logged in
    const token = Cookies.get('access_token');
    if (token) {
      setStep('CONFIRM');
    }
  }, []);

  const getFullPhoneNumber = () => {
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
        setStep('CONFIRM');
      } else {
        setError('Failed to authenticate');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    setError('');
    try {
      await authService.deleteAccount();
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      setStep('SUCCESS');
    } catch (err: any) {
      if (err.response?.status === 409) {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        setStep('SUCCESS');
      } else {
        setError('Failed to delete account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^[0-9]+$/.test(value)) return;
    
    if (value.length > 1) {
      const chars = value.split('').slice(0, 4);
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < 4) newCode[index + i] = char;
      });
      setCode(newCode);
      
      const nextIndex = Math.min(index + chars.length, 3);
      if (codeInputs.current[nextIndex]) {
        codeInputs.current[nextIndex]?.focus();
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value !== '' && index < 3) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
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
        gap: '24px',
        border: (step === 'CONFIRM' || step === 'SUCCESS') ? '1px solid var(--border-color)' : undefined
      }}>
        <div style={{ textAlign: 'center' }}>
          {step === 'SUCCESS' ? (
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'rgba(34, 197, 94, 0.1)', display: 'inline-flex', 
              alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
              color: '#22c55e'
            }}>
              <CheckCircle2 size={32} />
            </div>
          ) : step === 'CONFIRM' ? (
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'rgba(239, 68, 68, 0.1)', display: 'inline-flex', 
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
          
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            {step === 'SUCCESS' ? 'Account Deleted' : 'Delete Account'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 'PHONE' && 'Login to authorize account deletion.'}
            {step === 'OTP' && `Enter the 4-digit code sent to ${getFullPhoneNumber()}`}
            {step === 'CONFIRM' && 'Are you absolutely sure you want to delete your account? This action cannot be undone.'}
            {step === 'SUCCESS' && 'Your account and personal data have been completely deleted.'}
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

        {step === 'PHONE' && (
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
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Send OTP'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </form>
        )}

        {step === 'OTP' && (
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
                    maxLength={4}
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
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
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

        {step === 'CONFIRM' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              onClick={handleDeleteAccount}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--error)',
                color: 'white',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
              Yes, Delete My Account
            </button>
            <button 
              onClick={() => router.push('/')}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'SUCCESS' && (
          <button 
            onClick={() => router.push('/auth/login')}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  );
}
