"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import {
  SettingsService,
  type DeliveryZone,
  type DeliveryZonePoint,
  type RestaurantProfile,
} from "@/services/api/settings";
import { getApiErrorMessage } from "@/services/api/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useFeedback, Busy } from "@/components/ui/Feedback";
import { Field, Notice } from "./FormBits";

/** Mirrors DeliveryZoneMap — importing it here would pull leaflet into SSR. */
const MAP_HEIGHT = "min(500px, 60vh)";

function MapPlaceholder() {
  return (
    <div
      style={{
        height: MAP_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-elevated)",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
      }}
    >
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
    </div>
  );
}

const DeliveryZoneMap = dynamic(() => import("@/components/DeliveryZoneMap"), {
  ssr: false,
  loading: MapPlaceholder,
});

/** A zone in the editor. `key` is local — new zones have no server id yet. */
type ZoneDraft = { key: string; name: string; polygon: DeliveryZonePoint[] };

/** Key + optional server text, so a language switch retranslates it. */
type ErrorNotice = { key: MessageKey; vars?: Record<string, string | number>; text?: string } | null;

let draftSeq = 0;
const toDraft = (zone: Partial<DeliveryZone>): ZoneDraft => ({
  key: zone.id ?? `new-${++draftSeq}`,
  name: zone.name ?? "",
  polygon: zone.polygon ?? [],
});

/**
 * Every delivery zone the restaurant has, one editable at a time.
 *
 * `deliveryZones` on `PATCH /restaurants/me` replaces the whole set. This tab
 * used to load only the first zone and save `[thatZone]`, so a restaurant with
 * several zones lost all but one the first time the owner pressed Save. It now
 * holds every zone and always sends the full list.
 */
export default function DeliveryZonesPanel({
  restaurant,
  blocked,
}: {
  restaurant: RestaurantProfile;
  /** Saving is refused by the API in the restaurant's current status. */
  blocked: boolean;
}) {
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorNotice>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const restaurantId = restaurant.id;

  useEffect(() => {
    let cancelled = false;
    SettingsService.getDeliveryZones(restaurantId)
      .then((list) => {
        if (cancelled) return;
        // An empty editor is still an editor: start with one blank zone.
        setZones(list.length > 0 ? list.map(toDraft) : [toDraft({})]);
        setSelected(0);
        setLoaded(true);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError({ key: "settings.zone_load_failed", text: getApiErrorMessage(loadError, "") });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, reloadToken]);

  const current = zones[selected];
  const zoneLabel = (zone: ZoneDraft, index: number) =>
    zone.name.trim() || t("settingsx.zone_untitled", { n: index + 1 });

  const updateCurrent = (patch: Partial<ZoneDraft>) => {
    setError(null);
    setDirty(true);
    setZones((previous) =>
      previous.map((zone, index) => (index === selected ? { ...zone, ...patch } : zone)),
    );
  };

  const addZone = () => {
    setError(null);
    setDirty(true);
    setZones((previous) => [...previous, toDraft({})]);
    setSelected(zones.length);
  };

  const removeZone = async () => {
    if (!current) return;
    if (
      current.polygon.length > 0 &&
      !(await confirm({
        title: t("settingsx.zone_remove_title"),
        message: t("settingsx.zone_remove_body", { name: zoneLabel(current, selected) }),
        confirmLabel: t("settingsx.zone_remove"),
        danger: true,
      }))
    ) {
      return;
    }
    setError(null);
    setDirty(true);
    setZones((previous) => {
      const next = previous.filter((_, index) => index !== selected);
      return next.length > 0 ? next : [toDraft({})];
    });
    setSelected((index) => Math.max(0, index - 1));
  };

  const handleSave = async () => {
    setError(null);
    // 0 corners is "no zone" and is dropped; 1–2 is an unfinished shape.
    const unfinished = zones.findIndex((zone) => zone.polygon.length > 0 && zone.polygon.length < 3);
    if (unfinished !== -1) {
      setSelected(unfinished);
      setError({ key: "settingsx.zone_too_few", vars: { name: zoneLabel(zones[unfinished], unfinished) } });
      return;
    }

    const payload = zones
      .map((zone, index) => ({ zone, index }))
      .filter(({ zone }) => zone.polygon.length >= 3)
      .map(({ zone, index }) => ({
        name: (zone.name.trim() || zoneLabel(zone, index)).slice(0, 100),
        polygon: zone.polygon,
      }));

    setSaving(true);
    try {
      await SettingsService.updateOwnRestaurant({ deliveryZones: payload });
      setDirty(false);
      toast.success(t("settingsx.zones_saved"));
    } catch (saveError: unknown) {
      setError({ key: "zone.save_failed", text: getApiErrorMessage(saveError, "") });
    } finally {
      setSaving(false);
    }
  };

  const errorText = error ? error.text || t(error.key, error.vars) : "";
  const center =
    restaurant.restaurantAddress?.latitude != null && restaurant.restaurantAddress?.longitude != null
      ? { lat: restaurant.restaurantAddress.latitude, lng: restaurant.restaurantAddress.longitude }
      : null;
  const allEmpty = zones.every((zone) => zone.polygon.length === 0);

  return (
    <div className="glass-panel" style={{ padding: "clamp(16px, 4vw, 24px)", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <MapPin size={24} color="var(--accent-primary)" />
        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{t("settingsx.zones_title")}</h3>
        {dirty && <span className="badge badge-warning">{t("settingsx.unsaved")}</span>}
      </div>
      <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("zone.body")}</p>

      <Notice tone="error">{errorText}</Notice>

      {loading ? (
        <MapPlaceholder />
      ) : !loaded ? (
        // The load failed, so the map would show zones that are not the truth.
        // Saving from there would replace zones the owner never got to see.
        <div>
          <button type="button" className="btn-outline btn-sm" onClick={() => { setLoading(true); setReloadToken((n) => n + 1); }}>
            {t("common.retry")}
          </button>
        </div>
      ) : current ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div className="segmented" role="group" aria-label={t("settingsx.zones_selector")}>
              {zones.map((zone, index) => (
                <button
                  key={zone.key}
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                >
                  {zoneLabel(zone, index)}
                </button>
              ))}
            </div>
            <button type="button" className="btn-outline btn-sm" onClick={addZone} disabled={saving}>
              <Plus size={15} /> {t("settingsx.zone_add")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
            <Field label={t("zone.name")} style={{ flex: "1 1 220px", maxWidth: "360px" }}>
              {(id) => (
                <input
                  id={id}
                  type="text"
                  className="form-input"
                  maxLength={100}
                  placeholder={t("settingsx.zone_untitled", { n: selected + 1 })}
                  value={current.name}
                  onChange={(e) => updateCurrent({ name: e.target.value })}
                />
              )}
            </Field>
            <button type="button" className="btn-outline btn-sm" onClick={removeZone} disabled={saving} style={{ color: "var(--error)" }}>
              <X size={15} /> {t("settingsx.zone_remove")}
            </button>
          </div>

          <p className="field-hint">
            {t("zone.editor_hint")}
            {zones.length > 1 && ` ${t("settingsx.zones_other_hint")}`}
          </p>

          {/* Keyed by zone so switching zones remounts the map and re-fits it. */}
          <DeliveryZoneMap
            key={current.key}
            polygon={current.polygon}
            otherZones={zones.filter((_, index) => index !== selected).map((zone) => zone.polygon)}
            editable
            center={center}
            onChange={(polygon) => updateCurrent({ polygon })}
          />

          {allEmpty && <Notice tone="warning">{t("zone.cleared_hint")}</Notice>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                {t("zone.corner_count", { count: current.polygon.length })}
              </span>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={current.polygon.length === 0}
                onClick={() => updateCurrent({ polygon: current.polygon.slice(0, -1) })}
              >
                <Undo2 size={15} /> {t("zone.undo")}
              </button>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={current.polygon.length === 0}
                onClick={() => updateCurrent({ polygon: [] })}
              >
                <Trash2 size={15} /> {t("zone.clear")}
              </button>
            </div>
            <button type="button" className="btn-primary" disabled={saving || blocked} onClick={handleSave}>
              <Busy busy={saving} label={<><Save size={18} /> {t("settingsx.zones_save")}</>} busyLabel={t("common.saving")} />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
