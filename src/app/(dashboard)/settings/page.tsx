"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  Plus,
  MapPin,
  Upload,
} from 'lucide-react';
import {
  Currency,
  DeliveryZonePoint,
  ExchangeRate,
  RestaurantProfile,
  SettingsService,
} from '@/services/api/settings';
import dynamic from 'next/dynamic';
import { authService } from '@/services/api/auth';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage, isApiStatus } from '@/services/api/errors';

const PROFILE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const toBackgroundImage = (url: string | null) =>
  url ? `url("${url.replace(/["\\\n\r]/g, '')}")` : 'none';

const DeliveryZoneMap = dynamic(() => import('@/components/DeliveryZoneMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
    </div>
  )
});

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'exchange' | 'delivery'>('profile');

  // Profile State
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [deliveryPolygon, setDeliveryPolygon] = useState<DeliveryZonePoint[]>([]);
  const [isFetchingPolygon, setIsFetchingPolygon] = useState(true);
  const [polygonFetched, setPolygonFetched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const logoObjectUrl = useRef<string | null>(null);
  const backgroundObjectUrl = useRef<string | null>(null);

  // Exchange Rates State
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newRateForm, setNewRateForm] = useState({ fromCurrencyId: '', toCurrencyId: '', rate: '' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      SettingsService.getOwnRestaurant(),
      SettingsService.getExchangeRates(),
      SettingsService.getCurrencies(),
    ])
      .then(([profileData, ratesData, currenciesData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setLogoPreview(profileData.logo);
        setBackgroundPreview(profileData.backgroundImageUrl);
        setExchangeRates(ratesData);
        setCurrencies(currenciesData);
        if (currenciesData.length >= 2) {
          setNewRateForm((previous) => ({
            ...previous,
            fromCurrencyId: currenciesData[0].code,
            toCurrencyId: currenciesData[1].code,
          }));
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setProfileError(
            getApiErrorMessage(loadError, 'Failed to load restaurant settings.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'delivery' && profile?.id && !polygonFetched) {
      let cancelled = false;
      SettingsService.getFullRestaurant(profile.id)
        .then((fullData) => {
          if (cancelled) return;
          const firstZone = fullData.deliveryZones?.[0];
          setDeliveryPolygon(firstZone?.polygon ?? []);
          setPolygonFetched(true);
        })
        .catch((polygonError: unknown) => {
          if (!cancelled) {
            setProfileError(
              getApiErrorMessage(polygonError, 'Failed to load the delivery zone.'),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsFetchingPolygon(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, polygonFetched, profile?.id]);

  useEffect(
    () => () => {
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      if (backgroundObjectUrl.current) {
        URL.revokeObjectURL(backgroundObjectUrl.current);
      }
    },
    [],
  );

  const handleImageSelection = (
    kind: 'logo' | 'background',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError('');
    setProfileSuccess('');

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setProfileError('Choose a JPEG, PNG, WebP, or AVIF image.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setProfileError('The selected image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (kind === 'logo') {
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      logoObjectUrl.current = previewUrl;
      setLogoFile(file);
      setLogoPreview(previewUrl);
    } else {
      if (backgroundObjectUrl.current) {
        URL.revokeObjectURL(backgroundObjectUrl.current);
      }
      backgroundObjectUrl.current = previewUrl;
      setBackgroundFile(file);
      setBackgroundPreview(previewUrl);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setProfileError('');
    setProfileSuccess('');

    const currencyId = profile.currency?.code;
    const deliveryFee = Number(profile.deliveryFee);
    const minDeliveryTime = Number(profile.deliveryTimeMinMinutes);
    const maxDeliveryTime = Number(profile.deliveryTimeMaxMinutes);
    if (!currencyId) {
      setProfileError('The restaurant currency is missing. Please contact support.');
      return;
    }
    if (
      !Number.isFinite(deliveryFee) ||
      deliveryFee < 0 ||
      !Number.isInteger(minDeliveryTime) ||
      minDeliveryTime < 1 ||
      !Number.isInteger(maxDeliveryTime) ||
      maxDeliveryTime < minDeliveryTime
    ) {
      setProfileError('Check the delivery fee and make sure the maximum delivery time is not lower than the minimum.');
      return;
    }

    setSaving(true);
    try {
      const uploadedImages =
        logoFile || backgroundFile
          ? await SettingsService.uploadProfileImages({
              logo: logoFile ?? undefined,
              backgroundImage: backgroundFile ?? undefined,
            })
          : {};
      const logo = uploadedImages.logo ?? profile.logo ?? undefined;
      const backgroundImageUrl =
        uploadedImages.backgroundImageUrl ??
        profile.backgroundImageUrl ??
        undefined;
      const updatedProfile = await SettingsService.updateOwnRestaurant({
        name: profile.name,
        description: profile.description ?? '',
        phone: profile.phone ?? '',
        website: profile.website ?? '',
        deliveryFee,
        deliveryTimeMinMinutes: minDeliveryTime,
        deliveryTimeMaxMinutes: maxDeliveryTime,
        currencyId,
        ...(logo ? { logo } : {}),
        ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
      });
      setProfile(updatedProfile);
      setLogoPreview(updatedProfile.logo);
      setBackgroundPreview(updatedProfile.backgroundImageUrl);
      setLogoFile(null);
      setBackgroundFile(null);
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      if (backgroundObjectUrl.current) {
        URL.revokeObjectURL(backgroundObjectUrl.current);
      }
      logoObjectUrl.current = null;
      backgroundObjectUrl.current = null;
      setProfileSuccess('Restaurant profile updated successfully.');
    } catch (saveError: unknown) {
      setProfileError(
        getApiErrorMessage(saveError, 'Failed to update the restaurant profile.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await SettingsService.setExchangeRate({
        fromCurrencyId: newRateForm.fromCurrencyId,
        toCurrencyId: newRateForm.toCurrencyId,
        rate: parseFloat(newRateForm.rate)
      });
      setNewRateForm(prev => ({ ...prev, rate: '' }));
      const ratesData = await SettingsService.getExchangeRates();
      setExchangeRates(ratesData);
    } catch (err) {
      console.error('Failed to set exchange rate', err);
      alert('Failed to set exchange rate');
    }
  };

  const handleDeleteExchangeRate = async (rateId: string) => {
    try {
      await SettingsService.deleteExchangeRate(rateId);
      const ratesData = await SettingsService.getExchangeRates();
      setExchangeRates(ratesData);
    } catch (err) {
      console.error('Failed to delete exchange rate', err);
      alert('Failed to delete exchange rate');
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await authService.deleteAccount();
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      router.push('/auth/login');
    } catch (deleteError: unknown) {
      if (isApiStatus(deleteError, 409)) {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        router.push('/auth/login');
      } else {
        console.error('Failed to delete account', deleteError);
        alert('Failed to delete account. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your restaurant profile and exchange rates.</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('profile')}
          style={{ 
            background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
            color: activeTab === 'profile' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'profile' ? '2px solid var(--accent-primary)' : 'none',
            paddingBottom: '8px'
          }}
        >
          Restaurant Profile
        </button>
        <button 
          onClick={() => setActiveTab('exchange')}
          style={{ 
            background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
            color: activeTab === 'exchange' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'exchange' ? '2px solid var(--accent-primary)' : 'none',
            paddingBottom: '8px'
          }}
        >
          Exchange Rates
        </button>
        <button 
          onClick={() => setActiveTab('delivery')}
          style={{ 
            background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
            color: activeTab === 'delivery' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'delivery' ? '2px solid var(--accent-primary)' : 'none',
            paddingBottom: '8px'
          }}
        >
          Delivery Zone
        </button>
      </div>

      {activeTab === 'profile' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
          <form onSubmit={handleProfileSave} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {profileError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                padding: '12px 14px',
                color: 'var(--error)',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div
              role="status"
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                padding: '12px 14px',
                color: 'var(--success)',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
              }}
            >
              <CheckCircle2 size={18} /> {profileSuccess}
            </div>
          )}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Restaurant Name</label>
              <input type="text" className="form-input" value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Phone Number</label>
              <input type="text" className="form-input" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} required />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Description</label>
            <textarea className="form-input" rows={3} value={profile.description || ''} onChange={e => setProfile({ ...profile, description: e.target.value })} />
          </div>

          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(320px, 1.5fr)', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Restaurant logo</p>
                <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Square image recommended</p>
              </div>
              <div
                role="img"
                aria-label="Restaurant logo preview"
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '20px',
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'var(--bg-elevated)',
                  backgroundImage: toBackgroundImage(logoPreview),
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  border: logoFile ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                {!logoPreview && <ImagePlus size={32} color="var(--text-muted)" />}
              </div>
              <input
                id="restaurant-logo-file"
                type="file"
                accept={PROFILE_IMAGE_TYPES.join(',')}
                onChange={(event) => handleImageSelection('logo', event)}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="restaurant-logo-file"
                className="btn-outline"
                style={{ alignSelf: 'flex-start', padding: '9px 14px', fontSize: '13px' }}
              >
                <Upload size={16} /> {logoFile ? 'Choose another logo' : 'Change logo'}
              </label>
              {logoFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>New image selected</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Cover image</p>
                <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Wide 16:7 image recommended</p>
              </div>
              <div
                role="img"
                aria-label="Restaurant cover image preview"
                style={{
                  width: '100%',
                  aspectRatio: '16 / 7',
                  minHeight: '140px',
                  borderRadius: '20px',
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'var(--bg-elevated)',
                  backgroundImage: toBackgroundImage(backgroundPreview),
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  border: backgroundFile ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                {!backgroundPreview && <ImagePlus size={36} color="var(--text-muted)" />}
              </div>
              <input
                id="restaurant-background-file"
                type="file"
                accept={PROFILE_IMAGE_TYPES.join(',')}
                onChange={(event) => handleImageSelection('background', event)}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="restaurant-background-file"
                className="btn-outline"
                style={{ alignSelf: 'flex-start', padding: '9px 14px', fontSize: '13px' }}
              >
                <Upload size={16} /> {backgroundFile ? 'Choose another cover' : 'Change cover image'}
              </label>
              {backgroundFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>New image selected</span>}
            </div>
          </div>

          <p style={{ margin: '-8px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            JPEG, PNG, WebP, or AVIF. Maximum 5 MB per image. New images upload when you save the profile.
          </p>

          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Delivery Fee</label>
              <input type="number" step="0.01" className="form-input" value={profile.deliveryFee || 0} onChange={e => setProfile({ ...profile, deliveryFee: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Min Delivery Time (min)</label>
              <input type="number" className="form-input" value={profile.deliveryTimeMinMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMinMinutes: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Max Delivery Time (min)</label>
              <input type="number" className="form-input" value={profile.deliveryTimeMaxMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMaxMinutes: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Profile
            </button>
          </div>
          </form>

          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--error)', marginBottom: '8px' }}>Danger Zone</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button 
                type="button"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--error)',
                  border: '1px solid var(--error)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exchange' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Custom Exchange Rates</h3>
            {exchangeRates.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>No custom exchange rates set. The platform default rate applies.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {exchangeRates.map((rate) => (
                  <div key={rate.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-elevated)' }}>
                    <div style={{ fontWeight: '500' }}>
                      1 {rate.fromCurrencyId} = {rate.rate} {rate.toCurrencyId}
                    </div>
                    <button onClick={() => handleDeleteExchangeRate(rate.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>Add New Rate Override</h4>
            <form onSubmit={handleAddExchangeRate} className="flex-col-mobile" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, width: '100%' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>From</label>
                <select required className="form-input" value={newRateForm.fromCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, fromCurrencyId: e.target.value })}>
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
              </div>
              <div style={{ flex: 1, width: '100%' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>To</label>
                <select required className="form-input" value={newRateForm.toCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, toCurrencyId: e.target.value })}>
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
              </div>
              <div style={{ flex: 1, width: '100%' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Rate</label>
                <input required type="number" step="0.0001" className="form-input" placeholder="e.g. 89500" value={newRateForm.rate} onChange={e => setNewRateForm({ ...newRateForm, rate: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary mobile-w-full" style={{ padding: '10px 16px', width: '100%' }} disabled={!newRateForm.rate}>
                <Plus size={18} /> Add Rate
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', width: '100%' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <MapPin size={24} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Delivery Zone</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              This is the geographic area where your restaurant accepts delivery orders. If a customer places an order from outside this zone, it will be rejected automatically.
            </p>
            {isFetchingPolygon ? (
              <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : (
              <DeliveryZoneMap polygon={deliveryPolygon} />
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            backgroundColor: 'var(--bg-surface)',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>Are you absolutely sure?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--error)',
                  color: 'white',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Yes, delete my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
