"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// No default Leaflet pin is rendered (every Marker passes `vertexIcon`), so
// the usual `L.Icon.Default` URL patch is not needed.

type LatLng = { lat: number; lng: number };

/** Beirut — the fallback centre when there is nothing else to aim the map at. */
const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];

/** Shared identity, so an absent polygon does not re-run the memo every render. */
const NO_POINTS: LatLng[] = [];
const NO_ZONES: LatLng[][] = [];

/** Full height on a desktop, but never taller than most of a phone screen. */
export const MAP_HEIGHT = "min(500px, 60vh)";

/**
 * Vertex handle. The default Leaflet pin is a 25×41 teardrop whose tip marks
 * the point, which reads badly when a dozen of them outline a polygon — a small
 * centred dot sits exactly on the coordinate it represents.
 */
const vertexIcon = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:var(--accent-primary);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
});

/**
 * Fits the view to the polygon once, not on every change.
 *
 * While drawing, re-fitting after each click yanks the map out from under the
 * cursor, so the next click lands somewhere the operator did not aim at.
 */
function BoundsFitter({
  positions,
  once,
}: {
  positions: [number, number][];
  once: boolean;
}) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length === 0) return;
    if (once && fitted.current) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(positions), { padding: [20, 20] });
  }, [map, positions, once]);
  return null;
}

function ClickToAdd({ onAdd }: { onAdd: (point: LatLng) => void }) {
  useMapEvents({
    click: (event) => onAdd({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

export default function DeliveryZoneMap({
  polygon = NO_POINTS,
  otherZones = NO_ZONES,
  editable = false,
  center,
  onChange,
  emptyText = "No delivery zone defined for this restaurant.",
}: {
  polygon: LatLng[];
  /**
   * The restaurant's other zones, drawn faint and non-interactive so the zone
   * being edited can be lined up against its neighbours.
   */
  otherZones?: LatLng[][];
  editable?: boolean;
  /** Where to open when there is no polygon yet — usually the restaurant pin. */
  center?: LatLng | null;
  onChange?: (next: LatLng[]) => void;
  emptyText?: string;
}) {
  const points = polygon;

  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );

  if (!editable && positions.length === 0) {
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
        <p style={{ color: "var(--text-secondary)" }}>{emptyText}</p>
      </div>
    );
  }

  const initialCenter: [number, number] =
    positions[0] ??
    (center ? [center.lat, center.lng] : DEFAULT_CENTER);

  const replaceAt = (index: number, next: LatLng) =>
    onChange?.(points.map((point, i) => (i === index ? next : point)));

  const removeAt = (index: number) =>
    onChange?.(points.filter((_, i) => i !== index));

  return (
    <div
      style={{
        height: MAP_HEIGHT,
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        position: "relative",
        zIndex: 0,
      }}
    >
      <MapContainer
        center={initialCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {otherZones
          .filter((zone) => zone.length >= 3)
          .map((zone, index) => (
            <Polygon
              key={`other-${index}`}
              positions={zone.map((p) => [p.lat, p.lng] as [number, number])}
              interactive={false}
              pathOptions={{
                color: "var(--text-muted)",
                fillColor: "var(--text-muted)",
                fillOpacity: 0.08,
                weight: 2,
                dashArray: "4 6",
              }}
            />
          ))}

        {positions.length >= 3 ? (
          <Polygon
            positions={positions}
            pathOptions={{
              color: "var(--accent-primary)",
              fillColor: "var(--accent-primary)",
              fillOpacity: 0.2,
              weight: 3,
            }}
          />
        ) : (
          // Fewer than 3 points is not a shape yet, but the operator still needs
          // to see the line they are building.
          positions.length === 2 && (
            <Polyline
              positions={positions}
              pathOptions={{
                color: "var(--accent-primary)",
                weight: 3,
                dashArray: "6 6",
              }}
            />
          )
        )}

        {editable && (
          <>
            <ClickToAdd onAdd={(point) => onChange?.([...points, point])} />
            {points.map((point, index) => (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={vertexIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const { lat, lng } = event.target.getLatLng();
                    replaceAt(index, { lat, lng });
                  },
                  // Right-click removes. A left-click would fight the drag
                  // gesture and delete points the operator meant to move.
                  contextmenu: (event) => {
                    // Otherwise the browser menu opens over the map right after
                    // the corner disappears.
                    L.DomEvent.preventDefault(event.originalEvent);
                    removeAt(index);
                  },
                }}
              />
            ))}
          </>
        )}

        <BoundsFitter positions={positions} once={editable} />
      </MapContainer>
    </div>
  );
}
