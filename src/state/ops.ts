/**
 * Operational rules shared by the KPIs, the filters and the inspector, so
 * "late" means the same thing everywhere.
 */
import type { Shipment, Truck, WareTrackData } from '../data';

/** A shipment within this many minutes of its planned ETA still counts as on time. */
export const ON_TIME_GRACE_MIN = 15;

/** Minutes behind plan: actual arrival once arrived, otherwise the current ETA. */
export function minutesLate(s: Shipment): number {
  return Math.round((Date.parse(s.arrivedAt ?? s.eta) - Date.parse(s.plannedEta)) / 60_000);
}

export function isLate(s: Shipment): boolean {
  return minutesLate(s) > ON_TIME_GRACE_MIN;
}

/** Still to be delivered (not completed or cancelled). */
function isOpen(s: Shipment): boolean {
  return s.status !== 'completed' && s.status !== 'cancelled';
}

/** Open shipments running late, latest first. */
export function delayedShipments(data: WareTrackData): Shipment[] {
  return data.shipments.filter((s) => isOpen(s) && isLate(s)).sort((a, b) => minutesLate(b) - minutesLate(a));
}

/** Each truck's most-delayed open shipment, for trucks carrying a late one. */
export function delayedByTruck(data: WareTrackData): Map<Truck['id'], Shipment> {
  const byTruck = new Map<Truck['id'], Shipment>();
  for (const s of delayedShipments(data)) if (s.truckId && !byTruck.has(s.truckId)) byTruck.set(s.truckId, s);
  return byTruck;
}
