"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Plus } from 'lucide-react';
import { SettingsService } from '@/services/api/settings';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'exchange'>('profile');

  // Profile State
  const [profile, setProfile] = useState<any>(null);

  // Exchange Rates State
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [newRateForm, setNewRateForm] = useState({ fromCurrencyId: '', toCurrencyId: '', rate: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileData, ratesData, currenciesData] = await Promise.all([
        SettingsService.getOwnRestaurant(),
        SettingsService.getExchangeRates(),
        SettingsService.getCurrencies()
      ]);
      setProfile(profileData);
      setExchangeRates(ratesData);
      setCurrencies(currenciesData);
      
      if (currenciesData.length >= 2) {
        setNewRateForm(prev => ({
          ...prev,
          fromCurrencyId: currenciesData[0].code,
          toCurrencyId: currenciesData[1].code
        }));
      }
    } catch (err) {
      console.error('Failed to fetch settings data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await SettingsService.updateOwnRestaurant({
        name: profile.name,
        description: profile.description,
        phone: profile.phone,
        website: profile.website,
        deliveryFee: parseFloat(profile.deliveryFee) || 0,
        deliveryTimeMinMinutes: parseInt(profile.deliveryTimeMinMinutes) || 0,
        deliveryTimeMaxMinutes: parseInt(profile.deliveryTimeMaxMinutes) || 0,
        logo: profile.logo,
        backgroundImageUrl: profile.backgroundImageUrl
      });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile', err);
      alert('Failed to update profile');
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your restaurant profile and exchange rates.</p>
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
      </div>

      {activeTab === 'profile' && profile && (
        <form onSubmit={handleProfileSave} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Logo URL</label>
              <input type="url" className="form-input" value={profile.logo || ''} onChange={e => setProfile({ ...profile, logo: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Background Image URL</label>
              <input type="url" className="form-input" value={profile.backgroundImageUrl || ''} onChange={e => setProfile({ ...profile, backgroundImageUrl: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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
      )}

      {activeTab === 'exchange' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Custom Exchange Rates</h3>
            {exchangeRates.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>No custom exchange rates set. The platform default rate applies.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {exchangeRates.map((rate: any) => (
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
            <form onSubmit={handleAddExchangeRate} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>From</label>
                <select required className="form-input" value={newRateForm.fromCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, fromCurrencyId: e.target.value })}>
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>To</label>
                <select required className="form-input" value={newRateForm.toCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, toCurrencyId: e.target.value })}>
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Rate</label>
                <input required type="number" step="0.0001" className="form-input" placeholder="e.g. 89500" value={newRateForm.rate} onChange={e => setNewRateForm({ ...newRateForm, rate: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '10px 16px' }} disabled={!newRateForm.rate}>
                <Plus size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
