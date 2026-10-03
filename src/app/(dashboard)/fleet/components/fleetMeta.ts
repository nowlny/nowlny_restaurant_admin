import type { MessageKey } from "@/lib/i18n";
import type { FleetDriver } from "@/services/api/fleet";

const VEHICLE_KEYS: Record<string, MessageKey> = {
  motorcycle: "fleet.vehicle.motorcycle",
  car: "fleet.vehicle.car",
  bicycle: "fleet.vehicle.bicycle",
  scooter: "fleet.vehicle.scooter",
};

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const driverName = (driver: FleetDriver, t: T) => driver.fullName?.trim() || t("fleet.unnamed");

/** A type outside the API's enum is shown as sent rather than hidden. */
export const vehicleLabel = (driver: FleetDriver, t: T) => {
  const type = driver.vehicleType;
  if (!type) return t("fleet.vehicle_unknown");
  const key = VEHICLE_KEYS[type.toLowerCase()];
  return key ? t(key) : type;
};

/**
 * The login screen's normalisation: digits only, a pasted 961 prefix dropped,
 * then +961 put back. Returns null when too short to be a real number.
 */
export const toLebanesePhone = (input: string): string | null => {
  let digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("961")) digits = digits.substring(3);
  return digits.length >= 7 ? `+961${digits}` : null;
};
