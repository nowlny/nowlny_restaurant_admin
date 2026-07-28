"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n";

export interface TrackingPoint {
  latitude: number;
  longitude: number;
}

interface DriverTrackingMapProps {
  driver: TrackingPoint | null;
  destination: TrackingPoint | null;
  restaurant: TrackingPoint | null;
  restaurantLogo: string | null;
}

const MARKER_SHADOW = "0 5px 14px rgba(17, 24, 39, 0.3)";
const NOWLNY_DRIVER_MARKER =
  "data:image/png;base64,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";

function createMarkerElement(
  size: number,
  background: string,
  border: string,
) {
  const element = document.createElement("div");
  Object.assign(element.style, {
    width: `${size}px`,
    height: `${size}px`,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background,
    border,
    boxShadow: MARKER_SHADOW,
    overflow: "hidden",
  });
  return element;
}

function toLeafletIcon(element: HTMLElement, size: number) {
  return L.divIcon({
    html: element,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

function createDriverIcon() {
  const size = 44;
  const image = document.createElement("img");
  image.src = NOWLNY_DRIVER_MARKER;
  image.alt = "";
  image.draggable = false;
  Object.assign(image.style, {
    width: `${size}px`,
    height: `${size}px`,
    display: "block",
    objectFit: "contain",
  });
  return toLeafletIcon(image, size);
}

function createCustomerIcon() {
  const size = 48;
  const element = createMarkerElement(size, "#ff5a36", "3px solid #ffffff");
  const person = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  person.setAttribute("viewBox", "0 0 24 24");
  person.setAttribute("width", "25");
  person.setAttribute("height", "25");
  person.setAttribute("fill", "none");
  person.setAttribute("stroke", "white");
  person.setAttribute("stroke-width", "2.4");
  person.setAttribute("stroke-linecap", "round");
  person.setAttribute("stroke-linejoin", "round");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  head.setAttribute("cx", "12");
  head.setAttribute("cy", "8");
  head.setAttribute("r", "4");
  const shoulders = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shoulders.setAttribute("d", "M4.5 21a7.5 7.5 0 0 1 15 0");
  person.append(head, shoulders);
  element.appendChild(person);
  return toLeafletIcon(element, size);
}

function addRestaurantFallback(element: HTMLElement) {
  element.replaceChildren();
  element.textContent = "🍽️";
  element.style.fontSize = "24px";
}

function createRestaurantIcon(logo: string | null) {
  const size = 52;
  const element = createMarkerElement(
    size,
    "#ffffff",
    "3px solid #f59e0b",
  );
  if (logo) {
    const image = document.createElement("img");
    image.src = logo;
    image.alt = "";
    Object.assign(image.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    });
    image.addEventListener("error", () => addRestaurantFallback(element), {
      once: true,
    });
    element.appendChild(image);
  } else {
    addRestaurantFallback(element);
  }
  return toLeafletIcon(element, size);
}

function FitTrackingBounds({ points }: { points: TrackingPoint[] }) {
  const map = useMap();
  const pointKey = points
    .map((point) => `${point.latitude},${point.longitude}`)
    .join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15, {
        animate: true,
      });
      return;
    }
    map.fitBounds(
      L.latLngBounds(
        points.map((point) => [point.latitude, point.longitude]),
      ),
      { padding: [48, 48], maxZoom: 16, animate: true },
    );
  }, [map, pointKey, points]);

  return null;
}

export default function DriverTrackingMap({
  driver,
  destination,
  restaurant,
  restaurantLogo,
}: DriverTrackingMapProps) {
  const { t } = useI18n();
  const points = useMemo(
    () => [driver, destination, restaurant].filter(Boolean) as TrackingPoint[],
    [driver, destination, restaurant],
  );
  const driverIcon = useMemo(() => createDriverIcon(), []);
  const customerIcon = useMemo(() => createCustomerIcon(), []);
  const restaurantIcon = useMemo(
    () => createRestaurantIcon(restaurantLogo),
    [restaurantLogo],
  );

  if (points.length === 0) return null;
  const center = points[0];

  return (
    <div
      style={{
        height: "360px",
        width: "100%",
        overflow: "hidden",
        borderRadius: "14px",
        border: "1px solid var(--border-color)",
        position: "relative",
        zIndex: 0,
      }}
    >
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {restaurant && (
          <Marker
            position={[restaurant.latitude, restaurant.longitude]}
            icon={restaurantIcon}
          >
            <Popup>{t("tracking.marker_restaurant")}</Popup>
          </Marker>
        )}
        {destination && (
          <Marker
            position={[destination.latitude, destination.longitude]}
            icon={customerIcon}
          >
            <Popup>{t("tracking.marker_customer")}</Popup>
          </Marker>
        )}
        {driver && (
          <Marker
            position={[driver.latitude, driver.longitude]}
            icon={driverIcon}
            zIndexOffset={1000}
          >
            <Popup>Driver&apos;s live position</Popup>
          </Marker>
        )}
        <FitTrackingBounds points={points} />
      </MapContainer>
    </div>
  );
}
