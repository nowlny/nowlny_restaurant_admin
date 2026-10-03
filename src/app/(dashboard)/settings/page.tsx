"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  Plus,
  Upload,
} from 'lucide-react';
import {
  canEditRestaurant,
  Currency,
  ExchangeRate,
  MessageLanguage,
  OpeningHours,
  RestaurantCategory,
  RestaurantProfile,
  SettingsService,
  UpdateRestaurantAddress,
  WEEK_DAYS,
  WeekDay,
} from '@/services/api/settings';
import { authService } from '@/services/api/auth';
import { clearSession } from '@/services/api/session';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage, isApiStatus } from '@/services/api/errors';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { useRestaurant } from '@/lib/restaurantContext';
import { currencyDecimals, invalidateExchangeRates } from '@/lib/money';
import { Busy, useFeedback } from '@/components/ui/Feedback';
import { Field, Notice as NoticeBanner } from '@/components/settings/FormBits';
import DeliveryZonesPanel from '@/components/settings/DeliveryZonesPanel';

/** Key + optional server text — the load effects must not close over `t`. */
type Notice = { key: MessageKey; text?: string } | null;

const PROFILE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const toBackgroundImage = (url: string | null) =>
  url ? `url("${url.replace(/["\\\n\r]/g, '')}")` : 'none';

/* ── Opening hours ───────────────────────────────────────────────────────────
   The API has no "closed" flag: a day missing from `openingHours` is closed.
   The editor needs all seven rows on screen regardless, so the array is widened
   into a full week here and narrowed back on save. */

type DayForm = {
  enabled: boolean;
  is24Hours: boolean;
  openTime: string;
  closeTime: string;
};

type WeekForm = Record<WeekDay, DayForm>;

const DEFAULT_DAY: DayForm = {
  enabled: false,
  is24Hours: false,
  openTime: '09:00',
  closeTime: '23:00',
};

const DAY_LABEL_KEYS: Record<WeekDay, MessageKey> = {
  monday: 'hours.monday',
  tuesday: 'hours.tuesday',
  wednesday: 'hours.wednesday',
  thursday: 'hours.thursday',
  friday: 'hours.friday',
  saturday: 'hours.saturday',
  sunday: 'hours.sunday',
};

/** `<input type="time">` wants `HH:mm`; the API may hand back `HH:mm:ss`. */
const normalizeTime = (value?: string | null): string => {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const emptyWeek = (): WeekForm =>
  WEEK_DAYS.reduce((week, day) => {
    week[day] = { ...DEFAULT_DAY };
    return week;
  }, {} as WeekForm);

const toWeekForm = (hours: OpeningHours[] | null | undefined): WeekForm => {
  const week = emptyWeek();
  for (const entry of hours ?? []) {
    if (!(entry.day in week)) continue;
    week[entry.day] = {
      enabled: true,
      is24Hours: Boolean(entry.is24Hours),
      openTime: normalizeTime(entry.openTime) || DEFAULT_DAY.openTime,
      closeTime: normalizeTime(entry.closeTime) || DEFAULT_DAY.closeTime,
    };
  }
  return week;
};

const toOpeningHours = (week: WeekForm): OpeningHours[] =>
  WEEK_DAYS.filter((day) => week[day].enabled).map((day) =>
    week[day].is24Hours
      ? { day, is24Hours: true }
      : {
          day,
          is24Hours: false,
          openTime: week[day].openTime,
          closeTime: week[day].closeTime,
        },
  );

/* ── Address ─────────────────────────────────────────────────────────────── */

type AddressForm = {
  city: string;
  street: string;
  building: string;
  latitude: string;
  longitude: string;
};

const EMPTY_ADDRESS: AddressForm = {
  city: '',
  street: '',
  building: '',
  latitude: '',
  longitude: '',
};

const toAddressForm = (profile: RestaurantProfile | null): AddressForm => {
  const address = profile?.restaurantAddress;
  if (!address) return { ...EMPTY_ADDRESS };
  return {
    city: address.city ?? '',
    street: address.street ?? '',
    building: address.building ?? '',
    latitude: address.latitude == null ? '' : String(address.latitude),
    longitude: address.longitude == null ? '' : String(address.longitude),
  };
};

const STATUS_KEYS: Record<string, MessageKey> = {
  inactive: 'settings.status_inactive',
  pending: 'settings.status_pending',
  rejected: 'settings.status_rejected',
  suspended: 'settings.status_suspended',
};

/* ── Shared bits ─────────────────────────────────────────────────────────── */

/** `USD (\$)`, or bare `USD` when the API has no symbol — not `USD ()`. */
const currencyLabel = (currency: Currency) =>
  currency.symbol ? `${currency.code} (${currency.symbol})` : currency.code;

/**
 * `1 USD = 89,500 LBP`, with the currency codes and the amount picked out.
 *
 * Stays left-to-right in Arabic: it is an equation read against the POS, and
 * mirroring it puts the multiplier on the wrong side of the equals sign.
 */
function RateFormula({
  from,
  to,
  rate,
}: {
  from: string;
  to: string;
  rate: number | string;
}) {
  const amount = Number(rate);
  return (
    <span
      className="force-ltr"
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', fontSize: '15px', flexWrap: 'wrap' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>1</span>
      <strong style={{ fontWeight: '600' }}>{from}</strong>
      <span style={{ color: 'var(--text-muted)' }}>=</span>
      <strong style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>
        {Number.isFinite(amount) ? amount.toLocaleString('en-US', { maximumFractionDigits: 4 }) : rate}
      </strong>
      <strong style={{ fontWeight: '600' }}>{to}</strong>
    </span>
  );
}

const TABS = ['profile', 'hours', 'exchange', 'delivery'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<Tab, MessageKey> = {
  profile: 'settings.tab_profile',
  hours: 'settings.tab_hours',
  exchange: 'settings.tab_exchange',
  delivery: 'settingsx.tab_delivery',
};

const PANEL_STYLE: React.CSSProperties = {
  padding: 'clamp(16px, 4vw, 24px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const SECTION_TITLE: React.CSSProperties = { margin: 0, fontSize: '14px', fontWeight: '600' };

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  // The shell has already fetched `/restaurants/me`; start from that copy.
  const { restaurant, setRestaurant } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Profile State
  const [profile, setProfile] = useState<RestaurantProfile | null>(restaurant);
  const [address, setAddress] = useState<AddressForm>(() => toAddressForm(restaurant));
  const [allCategories, setAllCategories] = useState<RestaurantCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => (restaurant?.categories ?? []).map((category) => category.id),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(restaurant?.logo ?? null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    restaurant?.backgroundImageUrl ?? null,
  );
  const [profileError, setProfileError] = useState<Notice>(null);
  const logoObjectUrl = useRef<string | null>(null);
  const backgroundObjectUrl = useRef<string | null>(null);

  // Opening hours State
  const [week, setWeek] = useState<WeekForm>(() => toWeekForm(restaurant?.openingHours));
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState<Notice>(null);

  // Exchange Rates State
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newRateForm, setNewRateForm] = useState({ fromCurrencyId: '', toCurrencyId: '', rate: '' });
  const [savingRate, setSavingRate] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<Notice>(null);

  const applyProfile = (data: RestaurantProfile) => {
    setProfile(data);
    setAddress(toAddressForm(data));
    setSelectedCategoryIds((data.categories ?? []).map((category) => category.id));
    setWeek(toWeekForm(data.openingHours));
    setLogoPreview(data.logo);
    setBackgroundPreview(data.backgroundImageUrl);
  };

  // Only the first render's copy matters: later context updates come from our
  // own saves, which have already been applied locally.
  const hasInitialProfile = useRef(restaurant !== null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      hasInitialProfile.current ? null : SettingsService.getOwnRestaurant(),
      SettingsService.getExchangeRates(),
      SettingsService.getCurrencies(),
      // Categories are decoration, not a prerequisite — a failure here must not
      // take the whole settings screen down with it.
      SettingsService.getRestaurantCategories().catch(() => []),
    ])
      .then(([profileData, ratesData, currenciesData, categoriesData]) => {
        if (cancelled) return;
        if (profileData) applyProfile(profileData);
        setExchangeRates(ratesData);
        setCurrencies(currenciesData);
        setAllCategories(categoriesData);
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
          setProfileError({
            key: 'settings.load_failed',
            text: getApiErrorMessage(loadError, ''),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    setProfileError(null);

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setProfileError({ key: 'settings.image_type_error' });
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setProfileError({ key: 'settings.image_size_error' });
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

  /**
   * Builds the address slice of the payload.
   *
   * `address: undefined` means the operator left the block untouched, so an
   * empty form never overwrites an address the server already holds. `error`
   * covers the half-filled cases — the server stores city and street as
   * required, so a lat/lng with no city is rejected downstream anyway.
   */
  const buildAddressPayload = ():
    | { address?: UpdateRestaurantAddress; error?: undefined }
    | { address?: undefined; error: MessageKey } => {
    const filled = Object.values(address).some((value) => value.trim() !== '');
    if (!filled) return {};

    const city = address.city.trim();
    const street = address.street.trim();
    if (!city || !street) return { error: 'settings.address_incomplete' };

    const payload: UpdateRestaurantAddress = { city, street };
    const building = address.building.trim();
    if (building) payload.building = building;

    const hasLat = address.latitude.trim() !== '';
    const hasLng = address.longitude.trim() !== '';
    if (hasLat !== hasLng) return { error: 'settings.coordinates_pair' };
    if (hasLat && hasLng) {
      const latitude = Number(address.latitude);
      const longitude = Number(address.longitude);
      if (
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180
      ) {
        return { error: 'settings.coordinates_error' };
      }
      payload.latitude = latitude;
      payload.longitude = longitude;
    }

    return { address: payload };
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setProfileError(null);

    const currencyId = profile.currency?.code;
    const deliveryFee = Number(profile.deliveryFee);
    const minDeliveryTime = Number(profile.deliveryTimeMinMinutes);
    const maxDeliveryTime = Number(profile.deliveryTimeMaxMinutes);
    if (!currencyId) {
      setProfileError({ key: 'settings.currency_missing' });
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
      setProfileError({ key: 'settings.delivery_time_error' });
      return;
    }

    const addressResult = buildAddressPayload();
    if (addressResult.error) {
      setProfileError({ key: addressResult.error });
      return;
    }
    const restaurantAddress = addressResult.address;

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
        autoSendToDeliveryCompany: Boolean(profile.autoSendToDeliveryCompany),
        ...(profile.messageLanguage ? { messageLanguage: profile.messageLanguage } : {}),
        // `categoryIds` replaces the whole set, so it is only sent from here —
        // the surface that actually shows the whole set.
        categoryIds: selectedCategoryIds,
        ...(restaurantAddress ? { restaurantAddress } : {}),
        ...(logo ? { logo } : {}),
        ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
      });
      applyProfile(updatedProfile);
      // So the sidebar's name and logo follow without a reload.
      setRestaurant(updatedProfile);
      setLogoFile(null);
      setBackgroundFile(null);
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      if (backgroundObjectUrl.current) {
        URL.revokeObjectURL(backgroundObjectUrl.current);
      }
      logoObjectUrl.current = null;
      backgroundObjectUrl.current = null;
      toast.success(t('settings.profile_saved'));
    } catch (saveError: unknown) {
      setProfileError({
        key: 'settings.profile_save_failed',
        text: getApiErrorMessage(saveError, ''),
      });
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: WeekDay, patch: Partial<DayForm>) => {
    setHoursError(null);
    setWeek((previous) => ({ ...previous, [day]: { ...previous[day], ...patch } }));
  };

  const handleCopyMondayToAll = () => {
    setHoursError(null);
    setWeek((previous) =>
      WEEK_DAYS.reduce((next, day) => {
        next[day] = { ...previous.monday };
        return next;
      }, {} as WeekForm),
    );
  };

  const handleHoursSave = async () => {
    setHoursError(null);

    const incomplete = WEEK_DAYS.some((day) => {
      const entry = week[day];
      return entry.enabled && !entry.is24Hours && (!entry.openTime || !entry.closeTime);
    });
    if (incomplete) {
      setHoursError({ key: 'hours.time_required' });
      return;
    }

    setSavingHours(true);
    try {
      const updated = await SettingsService.updateOwnRestaurant({
        openingHours: toOpeningHours(week),
      });
      // Deliberately not `applyProfile` — that would reset the profile tab's
      // fields from the response and silently discard edits the operator typed
      // there before switching over here to save their hours.
      setProfile((previous) =>
        previous
          ? {
              ...previous,
              openingHours: updated.openingHours,
              isOpen: updated.isOpen,
            }
          : updated,
      );
      setRestaurant(updated);
      setWeek(toWeekForm(updated.openingHours));
      toast.success(t('hours.saved'));
    } catch (saveError: unknown) {
      setHoursError({
        key: 'hours.save_failed',
        text: getApiErrorMessage(saveError, ''),
      });
    } finally {
      setSavingHours(false);
    }
  };

  const handleAddExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatesError(null);

    if (newRateForm.fromCurrencyId === newRateForm.toCurrencyId) {
      setRatesError({ key: 'rates.same_currency' });
      return;
    }
    const rate = parseFloat(newRateForm.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setRatesError({ key: 'rates.rate_invalid' });
      return;
    }

    setSavingRate(true);
    try {
      await SettingsService.setExchangeRate({
        fromCurrencyId: newRateForm.fromCurrencyId,
        toCurrencyId: newRateForm.toCurrencyId,
        rate,
      });
      setNewRateForm(prev => ({ ...prev, rate: '' }));
      const ratesData = await SettingsService.getExchangeRates();
      setExchangeRates(ratesData);
      // Every "≈" price on the menu and orders converts with these.
      invalidateExchangeRates();
      toast.success(t('rates.saved'));
    } catch (err) {
      setRatesError({
        key: 'rates.save_failed',
        text: getApiErrorMessage(err, ''),
      });
    } finally {
      setSavingRate(false);
    }
  };

  const handleDeleteExchangeRate = async (rate: ExchangeRate) => {
    const confirmed = await confirm({
      title: t('settingsx.rate_delete_title'),
      message: t('settingsx.rate_delete_body', { from: rate.fromCurrencyId, to: rate.toCurrencyId }),
      danger: true,
    });
    if (!confirmed) return;
    setRatesError(null);
    setDeletingRateId(rate.id);
    try {
      await SettingsService.deleteExchangeRate(rate.id);
      const ratesData = await SettingsService.getExchangeRates();
      setExchangeRates(ratesData);
      invalidateExchangeRates();
      toast.success(t('settingsx.rate_deleted'));
    } catch (err) {
      setRatesError({
        key: 'rates.delete_failed',
        text: getApiErrorMessage(err, ''),
      });
    } finally {
      setDeletingRateId(null);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirm({
      title: t('settings.delete_confirm_title'),
      message: t('settings.delete_confirm_body'),
      confirmLabel: t('settings.delete_confirm_cta'),
      danger: true,
    });
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await authService.deleteAccount();
      clearSession();
      router.replace('/auth/login');
    } catch (deleteError: unknown) {
      if (isApiStatus(deleteError, 409)) {
        clearSession();
        router.replace('/auth/login');
      } else {
        console.error('Failed to delete account', deleteError);
        toast.error(getApiErrorMessage(deleteError, t('settings.delete_failed')));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  /** Arrow keys move between tabs (mirrored in RTL), as the ARIA tab pattern expects. */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.indexOf(activeTab);
    const rtl = document.documentElement.dir === 'rtl';
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const tab = TABS[(next + TABS.length) % TABS.length];
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  };

  const noticeText = (notice: Notice) =>
    notice ? notice.text || t(notice.key) : '';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  const statusKey = profile?.status ? STATUS_KEYS[profile.status] : undefined;
  // `PATCH /restaurants/me` only works while ACTIVE or INACTIVE.
  const savesBlocked = !canEditRestaurant(profile?.status);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
      </header>

      {statusKey && (
        <NoticeBanner tone={savesBlocked ? 'error' : 'warning'} title={t(statusKey)}>
          {profile?.rejectionReason && (
            <p style={{ margin: 0 }}>{t('settings.status_reason', { reason: profile.rejectionReason })}</p>
          )}
          {savesBlocked && <p style={{ margin: profile?.rejectionReason ? '4px 0 0' : 0 }}>{t('settingsx.saves_blocked')}</p>}
        </NoticeBanner>
      )}

      <div className="tab-strip" role="tablist" aria-label={t('settings.title')} onKeyDown={handleTabKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            type="button"
            role="tab"
            id={`settings-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`settings-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
          >
            {t(TAB_LABEL_KEYS[tab])}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && profile && (
        <div
          role="tabpanel"
          id="settings-panel-profile"
          aria-labelledby="settings-tab-profile"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}
        >
          <form onSubmit={handleProfileSave} className="glass-panel" style={{ ...PANEL_STYLE, gap: '24px' }}>
          <NoticeBanner tone="error">{noticeText(profileError)}</NoticeBanner>
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label={t('settings.restaurant_name')}>
              {(id) => <input id={id} type="text" className="form-input" value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} required />}
            </Field>
            <Field label={t('settings.phone')}>
              {(id) => <input id={id} type="tel" autoComplete="tel" className="form-input force-ltr" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} required />}
            </Field>
          </div>

          <Field label={t('settings.description')}>
            {(id) => <textarea id={id} className="form-input" rows={3} value={profile.description || ''} onChange={e => setProfile({ ...profile, description: e.target.value })} />}
          </Field>

          <Field label={t('settings.website')}>
            {(id) => <input id={id} type="url" className="form-input force-ltr" placeholder="https://" value={profile.website || ''} onChange={e => setProfile({ ...profile, website: e.target.value })} />}
          </Field>

          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 0.8fr) minmax(0, 1.5fr)', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={SECTION_TITLE}>{t('settings.logo')}</p>
                <p className="field-hint" style={{ marginTop: '3px' }}>{t('settings.logo_hint')}</p>
              </div>
              <div
                role="img"
                aria-label={t('settings.logo_preview')}
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
              {/* Visually hidden rather than display:none, so it stays reachable by keyboard. */}
              <input
                id="restaurant-logo-file"
                type="file"
                className="sr-only"
                accept={PROFILE_IMAGE_TYPES.join(',')}
                onChange={(event) => handleImageSelection('logo', event)}
              />
              <label
                htmlFor="restaurant-logo-file"
                className="btn-outline btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                <Upload size={16} /> {logoFile ? t('settings.change_logo_again') : t('settings.change_logo')}
              </label>
              {logoFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>{t('settings.image_selected')}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              <div>
                <p style={SECTION_TITLE}>{t('settings.cover')}</p>
                <p className="field-hint" style={{ marginTop: '3px' }}>{t('settings.cover_hint')}</p>
              </div>
              <div
                role="img"
                aria-label={t('settings.cover_preview')}
                style={{
                  width: '100%',
                  aspectRatio: '16 / 7',
                  minHeight: '120px',
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
                className="sr-only"
                accept={PROFILE_IMAGE_TYPES.join(',')}
                onChange={(event) => handleImageSelection('background', event)}
              />
              <label
                htmlFor="restaurant-background-file"
                className="btn-outline btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                <Upload size={16} /> {backgroundFile ? t('settings.change_cover_again') : t('settings.change_cover')}
              </label>
              {backgroundFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>{t('settings.image_selected')}</span>}
            </div>
          </div>

          <p className="field-hint" style={{ marginTop: '-8px' }}>
            {t('settings.image_rules')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '16px' }}>
            <Field label={t('settings.currency')}>
              {(id) => (
                <select
                  id={id}
                  className="form-input"
                  required
                  value={profile.currency?.code ?? ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      currency:
                        currencies.find((c) => c.code === e.target.value) ?? null,
                    })
                  }
                >
                  <option value="" disabled>{t('settings.currency_placeholder')}</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currencyLabel(currency)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {/* The fee is charged in the currency picked just above. */}
            <Field label={profile.currency?.code ? `${t('settings.delivery_fee')} (${profile.currency.code})` : t('settings.delivery_fee')}>
              {(id) => <input id={id} type="number" min="0" step={currencyDecimals(profile.currency?.code) === 0 ? '1' : '0.01'} inputMode="decimal" className="form-input force-ltr" value={profile.deliveryFee || 0} onChange={e => setProfile({ ...profile, deliveryFee: e.target.value })} />}
            </Field>
            <Field label={t('settings.min_delivery_time')}>
              {(id) => <input id={id} type="number" min="1" inputMode="numeric" className="form-input force-ltr" value={profile.deliveryTimeMinMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMinMinutes: e.target.value })} />}
            </Field>
            <Field label={t('settings.max_delivery_time')}>
              {(id) => <input id={id} type="number" min="1" inputMode="numeric" className="form-input force-ltr" value={profile.deliveryTimeMaxMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMaxMinutes: e.target.value })} />}
            </Field>
          </div>
          <p className="field-hint" style={{ marginTop: '-12px' }}>
            {t('settings.currency_hint')}
          </p>

          {/* ── Categories ─────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <p id="settings-categories-title" style={SECTION_TITLE}>{t('settings.categories_title')}</p>
            <p className="field-hint" style={{ margin: '3px 0 12px' }}>{t('settings.categories_hint')}</p>
            {allCategories.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{t('settings.categories_empty')}</p>
            ) : (
              <div role="group" aria-labelledby="settings-categories-title" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allCategories.map((category) => {
                  const selected = selectedCategoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedCategoryIds((previous) =>
                          selected
                            ? previous.filter((id) => id !== category.id)
                            : [...previous, category.id],
                        )
                      }
                      style={{
                        padding: '7px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        backgroundColor: selected ? 'var(--accent-light)' : 'var(--bg-elevated)',
                        border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      }}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Address ────────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={SECTION_TITLE}>{t('settings.address_title')}</p>
              <p className="field-hint" style={{ marginTop: '3px' }}>{t('settings.address_hint')}</p>
            </div>
            <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Field label={t('settings.city')}>
                {(id) => <input id={id} type="text" className="form-input" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />}
              </Field>
              <Field label={t('settings.street')}>
                {(id) => <input id={id} type="text" className="form-input" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} />}
              </Field>
              <Field label={t('settings.building')}>
                {(id) => <input id={id} type="text" className="form-input" value={address.building} onChange={e => setAddress({ ...address, building: e.target.value })} />}
              </Field>
            </div>
            <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label={t('settings.latitude')}>
                {(id) => <input id={id} type="number" step="any" inputMode="decimal" className="form-input force-ltr" placeholder="33.8886" value={address.latitude} onChange={e => setAddress({ ...address, latitude: e.target.value })} />}
              </Field>
              <Field label={t('settings.longitude')}>
                {(id) => <input id={id} type="number" step="any" inputMode="decimal" className="form-input force-ltr" placeholder="35.4955" value={address.longitude} onChange={e => setAddress({ ...address, longitude: e.target.value })} />}
              </Field>
            </div>
          </div>

          {/* ── Notifications ──────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <Field
              label={t('settingsx.message_language')}
              hint={t('settingsx.message_language_hint')}
              style={{ maxWidth: '360px' }}
            >
              {(id, describedBy) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className="form-input"
                  value={profile.messageLanguage ?? 'ar'}
                  onChange={(e) => setProfile({ ...profile, messageLanguage: e.target.value as MessageLanguage })}
                >
                  <option value="ar">{t('settingsx.language_ar')}</option>
                  <option value="en">{t('settingsx.language_en')}</option>
                </select>
              )}
            </Field>
          </div>

          {/* ── Dispatch ───────────────────────────────────────────────── */}
          <label
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(profile.autoSendToDeliveryCompany)}
              onChange={(e) => setProfile({ ...profile, autoSendToDeliveryCompany: e.target.checked })}
              style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0 }}
            />
            <span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>{t('settings.auto_dispatch')}</span>
              <span className="field-hint" style={{ display: 'block', marginTop: '3px' }}>{t('settings.auto_dispatch_hint')}</span>
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" disabled={saving || savesBlocked} className="btn-primary">
              <Busy busy={saving} label={<><Save size={18} /> {t('settings.save_profile')}</>} busyLabel={t('common.saving')} />
            </button>
          </div>
          </form>

          <div className="glass-panel" style={{ ...PANEL_STYLE, gap: '16px', borderColor: 'color-mix(in srgb, var(--error) 35%, transparent)' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--error)', margin: '0 0 8px' }}>{t('settings.danger_zone')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                {t('settings.danger_body')}
              </p>
            </div>
            <div>
              <button type="button" className="btn-danger btn-sm" onClick={handleDeleteAccount} disabled={isDeleting}>
                <Busy busy={isDeleting} label={<><Trash2 size={16} /> {t('settings.delete_account')}</>} busyLabel={t('common.deleting')} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hours' && (
        <div
          role="tabpanel"
          id="settings-panel-hours"
          aria-labelledby="settings-tab-hours"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}
        >
          <div className="glass-panel" style={PANEL_STYLE}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Clock size={22} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{t('hours.title')}</h3>
              {profile?.isOpen !== undefined && (
                <span className={`badge ${profile.isOpen ? 'badge-success' : ''}`}>
                  {profile.isOpen ? t('hours.currently_open') : t('hours.currently_closed')}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{t('hours.body')}</p>

            <NoticeBanner tone="error">{noticeText(hoursError)}</NoticeBanner>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {WEEK_DAYS.map((day) => {
                const entry = week[day];
                return (
                  <div
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px 16px',
                      flexWrap: 'wrap',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: entry.enabled ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={entry.enabled}
                        onChange={(e) => setDay(day, { enabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{t(DAY_LABEL_KEYS[day])}</span>
                    </label>

                    {!entry.enabled ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('hours.closed')}</span>
                    ) : (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={entry.is24Hours}
                            onChange={(e) => setDay(day, { is24Hours: e.target.checked })}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('hours.all_day')}</span>
                        </label>

                        {!entry.is24Hours && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('hours.open_time')}</span>
                              <input
                                type="time"
                                className="form-input force-ltr"
                                style={{ width: '130px' }}
                                value={entry.openTime}
                                onChange={(e) => setDay(day, { openTime: e.target.value })}
                              />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('hours.close_time')}</span>
                              <input
                                type="time"
                                className="form-input force-ltr"
                                style={{ width: '130px' }}
                                value={entry.closeTime}
                                onChange={(e) => setDay(day, { closeTime: e.target.value })}
                              />
                            </label>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="field-hint">{t('hours.overnight_hint')}</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-outline btn-sm" onClick={handleCopyMondayToAll}>
                {t('hours.copy_monday')}
              </button>
              <button type="button" className="btn-primary" disabled={savingHours || savesBlocked} onClick={handleHoursSave}>
                <Busy busy={savingHours} label={<><Save size={18} /> {t('hours.save')}</>} busyLabel={t('common.saving')} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exchange' && (
        <div
          role="tabpanel"
          id="settings-panel-exchange"
          aria-labelledby="settings-tab-exchange"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px' }}
        >
          <div className="glass-panel" style={PANEL_STYLE}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{t('rates.title')}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {t('rates.subtitle')}
              </p>
            </div>

            <NoticeBanner tone="error">{noticeText(ratesError)}</NoticeBanner>

            {exchangeRates.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>{t('rates.empty')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exchangeRates.map((rate) => (
                  <div
                    key={rate.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      paddingBlock: '12px',
                      paddingInline: '16px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-elevated)',
                    }}
                  >
                    <RateFormula
                      from={rate.fromCurrencyId}
                      to={rate.toCurrencyId}
                      rate={rate.rate}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => handleDeleteExchangeRate(rate)}
                      disabled={deletingRateId === rate.id}
                      aria-label={t('rates.delete_aria', { from: rate.fromCurrencyId, to: rate.toCurrencyId })}
                    >
                      {deletingRateId === rate.id ? (
                        <Loader2 className="animate-spin" size={17} />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleAddExchangeRate}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{t('rates.add_title')}</h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '16px' }}>
                <Field label={t('rates.from')}>
                  {(id) => (
                    <select id={id} required className="form-input" value={newRateForm.fromCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, fromCurrencyId: e.target.value })}>
                      <option value="" disabled>{t('settings.currency_placeholder')}</option>
                      {currencies.map(c => <option key={c.code} value={c.code}>{currencyLabel(c)}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={t('rates.to')}>
                  {(id) => (
                    <select id={id} required className="form-input" value={newRateForm.toCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, toCurrencyId: e.target.value })}>
                      <option value="" disabled>{t('settings.currency_placeholder')}</option>
                      {currencies.map(c => <option key={c.code} value={c.code}>{currencyLabel(c)}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={t('rates.rate')}>
                  {(id) => <input id={id} required type="number" min="0" step="0.0001" inputMode="decimal" className="form-input force-ltr" placeholder={t('rates.rate_placeholder')} value={newRateForm.rate} onChange={e => setNewRateForm({ ...newRateForm, rate: e.target.value })} />}
                </Field>
              </div>

              {/* The three fields read as "from / to / rate", but the value they
                  build reads as a sentence. Showing it removes the guesswork
                  about which direction the number applies in. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('rates.preview')}</span>
                {newRateForm.fromCurrencyId && newRateForm.toCurrencyId && newRateForm.rate ? (
                  <RateFormula
                    from={newRateForm.fromCurrencyId}
                    to={newRateForm.toCurrencyId}
                    rate={newRateForm.rate}
                  />
                ) : (
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>—</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingRate || !newRateForm.rate}
                >
                  <Busy busy={savingRate} label={<><Plus size={18} /> {t('rates.add')}</>} busyLabel={t('common.saving')} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && profile && (
        <div
          role="tabpanel"
          id="settings-panel-delivery"
          aria-labelledby="settings-tab-delivery"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', width: '100%' }}
        >
          <DeliveryZonesPanel restaurant={profile} blocked={savesBlocked} />
        </div>
      )}
    </div>
  );
}
