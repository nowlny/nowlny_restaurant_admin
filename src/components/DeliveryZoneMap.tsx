"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
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

function BoundsFitter({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, positions]);
  return null;
}

export default function DeliveryZoneMap({
  polygon,
}: {
  polygon: { lat: number; lng: number }[];
}) {
  if (!polygon || polygon.length === 0) {
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

  // Convert to [lat, lng] arrays for Leaflet
  const positions = polygon.map((p) => [p.lat, p.lng] as [number, number]);

  // Use the first point as default center if fitBounds isn't fast enough
  const center = positions[0];

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
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polygon
          positions={positions}
          pathOptions={{
            color: "var(--accent-primary)",
            fillColor: "var(--accent-primary)",
            fillOpacity: 0.2,
            weight: 3,
          }}
        />
        <BoundsFitter positions={positions} />
      </MapContainer>
    </div>
  );
}
