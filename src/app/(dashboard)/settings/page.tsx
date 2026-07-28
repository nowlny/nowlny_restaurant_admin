"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  Plus,
  MapPin,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  Currency,
  DeliveryZonePoint,
  ExchangeRate,
  OpeningHours,
  RestaurantCategory,
  RestaurantProfile,
  SettingsService,
  UpdateRestaurantAddress,
  WEEK_DAYS,
  WeekDay,
} from '@/services/api/settings';
import dynamic from 'next/dynamic';
import { authService } from '@/services/api/auth';
import { clearSession } from '@/services/api/session';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage, isApiStatus } from '@/services/api/errors';
import { useI18n, type MessageKey } from '@/lib/i18n';

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

const DeliveryZoneMap = dynamic(() => import('@/components/DeliveryZoneMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
    </div>
  )
});

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

const toAddressForm = (profile: RestaurantProfile): AddressForm => {
  const address = profile.restaurantAddress;
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

function NoticeBar({ kind, message }: { kind: 'error' | 'success'; message: string }) {
  if (!message) return null;
  const isError = kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: isError ? 'flex-start' : 'center',
        padding: '12px 14px',
        color: isError ? 'var(--error)' : 'var(--success)',
        background: isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
        border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
        borderRadius: '10px',
      }}
    >
      {isError ? (
        <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
      ) : (
        <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
      )}
      {message}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
      {children}
    </label>
  );
}

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
  delivery: 'settings.tab_delivery',
};

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile State
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [allCategories, setAllCategories] = useState<RestaurantCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<Notice>(null);
  const [profileSuccess, setProfileSuccess] = useState<Notice>(null);
  const logoObjectUrl = useRef<string | null>(null);
  const backgroundObjectUrl = useRef<string | null>(null);

  // Opening hours State
  const [week, setWeek] = useState<WeekForm>(emptyWeek);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState<Notice>(null);
  const [hoursSuccess, setHoursSuccess] = useState<Notice>(null);

  // Delivery zone State
  const [deliveryPolygon, setDeliveryPolygon] = useState<DeliveryZonePoint[]>([]);
  const [deliveryZoneName, setDeliveryZoneName] = useState('');
  const [isFetchingPolygon, setIsFetchingPolygon] = useState(true);
  const [polygonFetched, setPolygonFetched] = useState(false);
  const [savingZone, setSavingZone] = useState(false);
  const [zoneError, setZoneError] = useState<Notice>(null);
  const [zoneSuccess, setZoneSuccess] = useState<Notice>(null);

  // Exchange Rates State
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newRateForm, setNewRateForm] = useState({ fromCurrencyId: '', toCurrencyId: '', rate: '' });
  const [savingRate, setSavingRate] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<Notice>(null);
  const [ratesSuccess, setRatesSuccess] = useState<Notice>(null);

  const applyProfile = (data: RestaurantProfile) => {
    setProfile(data);
    setAddress(toAddressForm(data));
    setSelectedCategoryIds((data.categories ?? []).map((category) => category.id));
    setWeek(toWeekForm(data.openingHours));
    setLogoPreview(data.logo);
    setBackgroundPreview(data.backgroundImageUrl);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      SettingsService.getOwnRestaurant(),
      SettingsService.getExchangeRates(),
      SettingsService.getCurrencies(),
      // Categories are decoration, not a prerequisite — a failure here must not
      // take the whole settings screen down with it.
      SettingsService.getRestaurantCategories().catch(() => []),
    ])
      .then(([profileData, ratesData, currenciesData, categoriesData]) => {
        if (cancelled) return;
        applyProfile(profileData);
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

  useEffect(() => {
    if (activeTab === 'delivery' && profile?.id && !polygonFetched) {
      let cancelled = false;
      SettingsService.getFullRestaurant(profile.id)
        .then((fullData) => {
          if (cancelled) return;
          const firstZone = fullData.deliveryZones?.[0];
          setDeliveryPolygon(firstZone?.polygon ?? []);
          setDeliveryZoneName(firstZone?.name ?? '');
          setPolygonFetched(true);
        })
        .catch((polygonError: unknown) => {
          if (!cancelled) {
            setZoneError({
              key: 'settings.zone_load_failed',
              text: getApiErrorMessage(polygonError, ''),
            });
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
    setProfileError(null);
    setProfileSuccess(null);

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
    setProfileSuccess(null);

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
        // `categoryIds` replaces the whole set, so it is only sent from here —
        // the surface that actually shows the whole set.
        categoryIds: selectedCategoryIds,
        ...(restaurantAddress ? { restaurantAddress } : {}),
        ...(logo ? { logo } : {}),
        ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
      });
      applyProfile(updatedProfile);
      setLogoFile(null);
      setBackgroundFile(null);
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      if (backgroundObjectUrl.current) {
        URL.revokeObjectURL(backgroundObjectUrl.current);
      }
      logoObjectUrl.current = null;
      backgroundObjectUrl.current = null;
      setProfileSuccess({ key: 'settings.profile_saved' });
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
    setHoursSuccess(null);
    setWeek((previous) => ({ ...previous, [day]: { ...previous[day], ...patch } }));
  };

  const handleCopyMondayToAll = () => {
    setHoursError(null);
    setHoursSuccess(null);
    setWeek((previous) =>
      WEEK_DAYS.reduce((next, day) => {
        next[day] = { ...previous.monday };
        return next;
      }, {} as WeekForm),
    );
  };

  const handleHoursSave = async () => {
    setHoursError(null);
    setHoursSuccess(null);

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
      setWeek(toWeekForm(updated.openingHours));
      setHoursSuccess({ key: 'hours.saved' });
    } catch (saveError: unknown) {
      setHoursError({
        key: 'hours.save_failed',
        text: getApiErrorMessage(saveError, ''),
      });
    } finally {
      setSavingHours(false);
    }
  };

  const handleZoneChange = (next: DeliveryZonePoint[]) => {
    setZoneError(null);
    setZoneSuccess(null);
    setDeliveryPolygon(next);
  };

  const handleZoneSave = async () => {
    if (!profile) return;
    setZoneError(null);
    setZoneSuccess(null);

    // 0 points is a deliberate "no limits" state; 1–2 is an unfinished shape.
    if (deliveryPolygon.length > 0 && deliveryPolygon.length < 3) {
      setZoneError({ key: 'zone.too_few' });
      return;
    }

    setSavingZone(true);
    try {
      await SettingsService.updateOwnRestaurant({
        deliveryZones:
          deliveryPolygon.length >= 3
            ? [
                {
                  name: deliveryZoneName.trim() || profile.name,
                  polygon: deliveryPolygon,
                },
              ]
            : [],
      });
      setZoneSuccess({ key: 'zone.saved' });
    } catch (saveError: unknown) {
      setZoneError({
        key: 'zone.save_failed',
        text: getApiErrorMessage(saveError, ''),
      });
    } finally {
      setSavingZone(false);
    }
  };

  const handleAddExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatesError(null);
    setRatesSuccess(null);

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
      setRatesSuccess({ key: 'rates.saved' });
    } catch (err) {
      setRatesError({
        key: 'rates.save_failed',
        text: getApiErrorMessage(err, ''),
      });
    } finally {
      setSavingRate(false);
    }
  };

  const handleDeleteExchangeRate = async (rateId: string) => {
    setRatesError(null);
    setRatesSuccess(null);
    setDeletingRateId(rateId);
    try {
      await SettingsService.deleteExchangeRate(rateId);
      const ratesData = await SettingsService.getExchangeRates();
      setExchangeRates(ratesData);
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
        alert(t('settings.delete_failed'));
      }
    } finally {
      setIsDeleting(false);
    }
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

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>{t('settings.title')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('settings.subtitle')}</p>
        </div>
      </header>

      {statusKey && (
        <div
          role="status"
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            padding: '14px 16px',
            color: 'var(--warning)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: 0, fontWeight: '600' }}>{t(statusKey)}</p>
            {profile?.rejectionReason && (
              <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                {t('settings.status_reason', { reason: profile.rejectionReason })}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="responsive-flex-wrap" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : 'none',
              paddingBottom: '8px'
            }}
          >
            {t(TAB_LABEL_KEYS[tab])}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
          <form onSubmit={handleProfileSave} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <NoticeBar kind="error" message={noticeText(profileError)} />
          <NoticeBar kind="success" message={noticeText(profileSuccess)} />
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <FieldLabel>{t('settings.restaurant_name')}</FieldLabel>
              <input type="text" className="form-input" value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div>
              <FieldLabel>{t('settings.phone')}</FieldLabel>
              <input type="text" className="form-input" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} required />
            </div>
          </div>

          <div>
            <FieldLabel>{t('settings.description')}</FieldLabel>
            <textarea className="form-input" rows={3} value={profile.description || ''} onChange={e => setProfile({ ...profile, description: e.target.value })} />
          </div>

          <div>
            <FieldLabel>{t('settings.website')}</FieldLabel>
            <input type="url" className="form-input force-ltr" placeholder="https://" value={profile.website || ''} onChange={e => setProfile({ ...profile, website: e.target.value })} />
          </div>

          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(320px, 1.5fr)', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{t('settings.logo')}</p>
                <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settings.logo_hint')}</p>
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
                <Upload size={16} /> {logoFile ? t('settings.change_logo_again') : t('settings.change_logo')}
              </label>
              {logoFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>{t('settings.image_selected')}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{t('settings.cover')}</p>
                <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settings.cover_hint')}</p>
              </div>
              <div
                role="img"
                aria-label={t('settings.cover_preview')}
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
                <Upload size={16} /> {backgroundFile ? t('settings.change_cover_again') : t('settings.change_cover')}
              </label>
              {backgroundFile && <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>{t('settings.image_selected')}</span>}
            </div>
          </div>

          <p style={{ margin: '-8px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            {t('settings.image_rules')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <FieldLabel>{t('settings.currency')}</FieldLabel>
              <select
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
            </div>
            <div>
              <FieldLabel>{t('settings.delivery_fee')}</FieldLabel>
              <input type="number" step="0.01" className="form-input" value={profile.deliveryFee || 0} onChange={e => setProfile({ ...profile, deliveryFee: e.target.value })} />
            </div>
            <div>
              <FieldLabel>{t('settings.min_delivery_time')}</FieldLabel>
              <input type="number" className="form-input" value={profile.deliveryTimeMinMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMinMinutes: e.target.value })} />
            </div>
            <div>
              <FieldLabel>{t('settings.max_delivery_time')}</FieldLabel>
              <input type="number" className="form-input" value={profile.deliveryTimeMaxMinutes || 0} onChange={e => setProfile({ ...profile, deliveryTimeMaxMinutes: e.target.value })} />
            </div>
          </div>
          <p style={{ margin: '-12px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            {t('settings.currency_hint')}
          </p>

          {/* ── Categories ─────────────────────────────────────────────── */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{t('settings.categories_title')}</p>
            <p style={{ margin: '3px 0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settings.categories_hint')}</p>
            {allCategories.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('settings.categories_empty')}</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                        backgroundColor: selected ? 'rgba(255, 90, 54, 0.12)' : 'var(--bg-elevated)',
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
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{t('settings.address_title')}</p>
              <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settings.address_hint')}</p>
            </div>
            <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <FieldLabel>{t('settings.city')}</FieldLabel>
                <input type="text" className="form-input" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} />
              </div>
              <div>
                <FieldLabel>{t('settings.street')}</FieldLabel>
                <input type="text" className="form-input" value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} />
              </div>
              <div>
                <FieldLabel>{t('settings.building')}</FieldLabel>
                <input type="text" className="form-input" value={address.building} onChange={e => setAddress({ ...address, building: e.target.value })} />
              </div>
            </div>
            <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <FieldLabel>{t('settings.latitude')}</FieldLabel>
                <input type="number" step="any" className="form-input force-ltr" placeholder="33.8886" value={address.latitude} onChange={e => setAddress({ ...address, latitude: e.target.value })} />
              </div>
              <div>
                <FieldLabel>{t('settings.longitude')}</FieldLabel>
                <input type="number" step="any" className="form-input force-ltr" placeholder="35.4955" value={address.longitude} onChange={e => setAddress({ ...address, longitude: e.target.value })} />
              </div>
            </div>
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
              style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>{t('settings.auto_dispatch')}</span>
              <span style={{ display: 'block', margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settings.auto_dispatch_hint')}</span>
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {t('settings.save_profile')}
            </button>
          </div>
          </form>

          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--error)', marginBottom: '8px' }}>{t('settings.danger_zone')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {t('settings.danger_body')}
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
                {t('settings.delete_account')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Clock size={22} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{t('hours.title')}</h3>
              {profile?.isOpen !== undefined && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: profile.isOpen ? 'var(--success)' : 'var(--text-muted)',
                    backgroundColor: profile.isOpen ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${profile.isOpen ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                  }}
                >
                  {profile.isOpen ? t('hours.currently_open') : t('hours.currently_closed')}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>{t('hours.body')}</p>

            <NoticeBar kind="error" message={noticeText(hoursError)} />
            <NoticeBar kind="success" message={noticeText(hoursSuccess)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {WEEK_DAYS.map((day) => {
                const entry = week[day];
                return (
                  <div
                    key={day}
                    className="responsive-flex-wrap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      flexWrap: 'wrap',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: entry.enabled ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px', cursor: 'pointer' }}>
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

            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>{t('hours.overnight_hint')}</p>

            <div className="flex-col-mobile" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <button type="button" className="btn-outline" style={{ padding: '9px 14px', fontSize: '13px' }} onClick={handleCopyMondayToAll}>
                {t('hours.copy_monday')}
              </button>
              <button type="button" className="btn-primary" disabled={savingHours} onClick={handleHoursSave}>
                {savingHours ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {t('hours.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exchange' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{t('rates.title')}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {t('rates.subtitle')}
              </p>
            </div>

            <NoticeBar kind="error" message={noticeText(ratesError)} />
            <NoticeBar kind="success" message={noticeText(ratesSuccess)} />

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
                      padding: '12px 12px 12px 16px',
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
                      onClick={() => handleDeleteExchangeRate(rate.id)}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                <div>
                  <FieldLabel>{t('rates.from')}</FieldLabel>
                  <select required className="form-input" value={newRateForm.fromCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, fromCurrencyId: e.target.value })}>
                    <option value="" disabled>{t('settings.currency_placeholder')}</option>
                    {currencies.map(c => <option key={c.code} value={c.code}>{currencyLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('rates.to')}</FieldLabel>
                  <select required className="form-input" value={newRateForm.toCurrencyId} onChange={e => setNewRateForm({ ...newRateForm, toCurrencyId: e.target.value })}>
                    <option value="" disabled>{t('settings.currency_placeholder')}</option>
                    {currencies.map(c => <option key={c.code} value={c.code}>{currencyLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('rates.rate')}</FieldLabel>
                  <input required type="number" min="0" step="0.0001" className="form-input force-ltr" placeholder={t('rates.rate_placeholder')} value={newRateForm.rate} onChange={e => setNewRateForm({ ...newRateForm, rate: e.target.value })} />
                </div>
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
                  {savingRate ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} {t('rates.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', width: '100%' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={24} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{t('zone.title')}</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {t('zone.body')}
            </p>

            <NoticeBar kind="error" message={noticeText(zoneError)} />
            <NoticeBar kind="success" message={noticeText(zoneSuccess)} />

            {isFetchingPolygon ? (
              <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : !polygonFetched ? (
              // The load failed, so the map would show an empty polygon that is
              // not the truth. Saving from there would replace a zone the
              // operator never got to see — show only the error instead.
              null
            ) : (
              <>
                <div style={{ maxWidth: '320px' }}>
                  <FieldLabel>{t('zone.name')}</FieldLabel>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={profile?.name ?? ''}
                    value={deliveryZoneName}
                    onChange={(e) => setDeliveryZoneName(e.target.value)}
                  />
                </div>

                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>{t('zone.editor_hint')}</p>

                <DeliveryZoneMap
                  polygon={deliveryPolygon}
                  editable
                  center={
                    profile?.restaurantAddress?.latitude != null &&
                    profile?.restaurantAddress?.longitude != null
                      ? {
                          lat: profile.restaurantAddress.latitude,
                          lng: profile.restaurantAddress.longitude,
                        }
                      : null
                  }
                  onChange={handleZoneChange}
                />

                {deliveryPolygon.length === 0 && (
                  <p style={{ margin: 0, color: 'var(--warning)', fontSize: '12px' }}>{t('zone.cleared_hint')}</p>
                )}

                <div className="flex-col-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {t('zone.corner_count', { count: deliveryPolygon.length })}
                    </span>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      disabled={deliveryPolygon.length === 0}
                      onClick={() => handleZoneChange(deliveryPolygon.slice(0, -1))}
                    >
                      <Undo2 size={15} /> {t('zone.undo')}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      disabled={deliveryPolygon.length === 0}
                      onClick={() => handleZoneChange([])}
                    >
                      <Trash2 size={15} /> {t('zone.clear')}
                    </button>
                  </div>
                  <button type="button" className="btn-primary" disabled={savingZone} onClick={handleZoneSave}>
                    {savingZone ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {t('zone.save')}
                  </button>
                </div>
              </>
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
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>{t('settings.delete_confirm_title')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
              {t('settings.delete_confirm_body')}
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
                {t('common.cancel')}
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
                {t('settings.delete_confirm_cta')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
