/**
 * Derived lookups over a WareTrackData snapshot. Each relation is stored once
 * (see types.ts); these helpers walk it in the other direction.
 */
import type {
  Dock,
  DockId,
  Forklift,
  InventoryItem,
  IsoDateTime,
  Shipment,
  ShipmentStatus,
  SiteId,
  SiteStop,
  Truck,
  TruckId,
  VehicleClass,
  WareTrackData,
} from './types';

export const ACTIVE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'loading',
  'in_transit',
  'arrived',
  'unloading',
];

const VEHICLE_CLASS_RANK: Record<VehicleClass, number> = { light: 0, medium: 1, heavy: 2 };

export function fitsDock(truck: Truck, dock: Dock): boolean {
  return VEHICLE_CLASS_RANK[truck.vehicleClass] <= VEHICLE_CLASS_RANK[dock.maxVehicleClass];
}

export function indexById<T extends { id: string }>(rows: readonly T[]): Map<T['id'], T> {
  return new Map(rows.map((row) => [row.id, row]));
}

// ── Site → children ─────────────────────────────────────────────────────────

export function docksAtSite(data: WareTrackData, siteId: SiteId): Dock[] {
  return data.docks.filter((d) => d.siteId === siteId);
}

export function forkliftsAtSite(data: WareTrackData, siteId: SiteId): Forklift[] {
  return data.forklifts.filter((f) => f.siteId === siteId);
}

export function inventoryAtSite(data: WareTrackData, siteId: SiteId): InventoryItem[] {
  return data.inventory.filter((i) => i.siteId === siteId);
}

/** Trucks physically at the site right now (at a dock or in the yard). */
export function trucksAtSite(data: WareTrackData, siteId: SiteId): Truck[] {
  const dockSite = new Map(data.docks.map((d) => [d.id, d.siteId]));
  return data.trucks.filter(
    (t) =>
      (t.position.kind === 'yard' && t.position.siteId === siteId) ||
      (t.position.kind === 'dock' && dockSite.get(t.position.dockId) === siteId),
  );
}

/** Shipments leaving from or arriving at the site. */
export function shipmentsForSite(data: WareTrackData, siteId: SiteId): Shipment[] {
  return data.shipments.filter((s) => siteStops(s).some((stop) => stop.siteId === siteId));
}

// ── Dock / truck / shipment ─────────────────────────────────────────────────

export function truckAtDock(data: WareTrackData, dockId: DockId): Truck | undefined {
  return data.trucks.find((t) => t.position.kind === 'dock' && t.position.dockId === dockId);
}

export function forkliftsAtDock(data: WareTrackData, dockId: DockId): Forklift[] {
  return data.forklifts.filter((f) => f.assignedDockId === dockId);
}

export function activeShipmentForTruck(data: WareTrackData, truckId: TruckId): Shipment | undefined {
  return data.shipments.find(
    (s) => s.truckId === truckId && ACTIVE_SHIPMENT_STATUSES.includes(s.status),
  );
}

export function shipmentsForTruck(data: WareTrackData, truckId: TruckId): Shipment[] {
  return data.shipments.filter((s) => s.truckId === truckId);
}

/** The stops of a shipment that are our own sites (one or two). */
export function siteStops(s: Shipment): SiteStop[] {
  switch (s.direction) {
    case 'outbound':
      return [s.origin];
    case 'inbound':
      return [s.destination];
    case 'transfer':
      return [s.origin, s.destination];
  }
}

/** The site whose stock records the shipment's lines point at. */
export function stockSiteOf(s: Shipment): SiteId {
  return s.direction === 'inbound' ? s.destination.siteId : s.origin.siteId;
}

// ── Shipment metrics ────────────────────────────────────────────────────────

export function shipmentWeightKg(data: WareTrackData, s: Shipment): number {
  const items = indexById(data.inventory);
  return s.lines.reduce(
    (sum, line) => sum + line.quantity * (items.get(line.itemId)?.unitWeightKg ?? 0),
    0,
  );
}

/** Minutes the current ETA is behind (positive) or ahead of (negative) plan. */
export function delayMinutes(s: Shipment): number {
  return Math.round((Date.parse(s.eta) - Date.parse(s.plannedEta)) / 60_000);
}

/** 0–1 progress of the road leg, based on time elapsed towards the ETA. */
export function transitProgress(s: Shipment, now: IsoDateTime): number {
  if (s.arrivedAt) return 1;
  if (!s.departedAt) return 0;
  const start = Date.parse(s.departedAt);
  const total = Date.parse(s.eta) - start;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (Date.parse(now) - start) / total));
}

export function isBelowReorderPoint(item: InventoryItem): boolean {
  return item.quantity <= item.reorderPoint;
}
