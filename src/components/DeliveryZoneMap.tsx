"use client";

import React, { useEffect, useMemo, useRef } from "react";
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

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = { lat: number; lng: number };

/** Beirut — the fallback centre when there is nothing else to aim the map at. */
const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];

/** Shared identity, so an absent polygon does not re-run the memo every render. */
const NO_POINTS: LatLng[] = [];

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
  editable = false,
  center,
  onChange,
}: {
  polygon: LatLng[];
  editable?: boolean;
  /** Where to open when there is no polygon yet — usually the restaurant pin. */
  center?: LatLng | null;
  onChange?: (next: LatLng[]) => void;
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
          height: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
        }}
      >
        <p style={{ color: "var(--text-secondary)" }}>
          No delivery zone defined for this restaurant.
        </p>
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
        height: "500px",
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
