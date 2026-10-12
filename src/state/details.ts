/**
 * Inspector view model: what the side panel shows for a selected entity.
 * All wording, status rules and shipment lookups live here so the panel
 * component only lays the result out.
 */
import {
  ACTIVE_SHIPMENT_STATUSES,
  shipmentWeightKg,
  type Dock,
  type DockId,
  type Forklift,
  type ForkliftStatus,
  type InventoryCategory,
  type InventoryItem,
  type IsoDateTime,
  type Shipment,
  type ShipmentStatus,
  type SiteId,
  type StockUnit,
  type Truck,
  type TruckStatus,
  type WareTrackData,
} from '../data';
import { workProgress, type SimState } from '../sim/simulation';
import { entityKey, parseRackId, type EntityKey, type EntityRef } from './entities';
import { formatClock, formatNumber, formatWhen } from './format';
import { minutesLate, ON_TIME_GRACE_MIN } from './ops';

export type Tone = 'amber' | 'blue' | 'green' | 'red' | 'gray';

export interface StateBadge {
  label: string;
  tone: Tone;
}

export interface DetailRow {
  label: string;
  value: string;
  tone?: Tone;
}

export interface ShipmentSummary {
  id: string;
  heading: 'Current shipment' | 'Next shipment';
  direction: string;
  status: StateBadge;
  from: string;
  to: string;
  /** 0–1 progress of the current step (loading, road leg or unloading). */
  progress: number | null;
  /** What `progress` measures, e.g. "Loaded" or "Route". */
  progressLabel: string;
  timing: string;
  delay: StateBadge;
  load: string;
}

export interface EntityDetails {
  key: EntityKey;
  kind: string;
  title: string;
  subtitle: string;
  state: StateBadge;
  shipment: ShipmentSummary | null;
  /** Shown when there's no shipment to summarise. */
  noShipment: string;
  fields: DetailRow[];
  list?: { heading: string; rows: DetailRow[] };
  updatedAt: IsoDateTime;
  updatedLabel: string;
}

export interface DetailsInput {
  data: WareTrackData;
  now: IsoDateTime;
  sim: SimState;
  updatedAt: Partial<Record<EntityKey, IsoDateTime>>;
  /** Fallback for entities that haven't changed since the snapshot was taken. */
  since: IsoDateTime;
}

// ── Labels ─────────────────────────────────────────────────────────────────

export const TRUCK_STATE: Record<TruckStatus, StateBadge> = {
  loading: { label: 'Loading', tone: 'amber' },
  unloading: { label: 'Unloading', tone: 'amber' },
  in_transit: { label: 'In transit', tone: 'amber' },
  idle: { label: 'Idle', tone: 'blue' },
  maintenance: { label: 'Maintenance', tone: 'red' },
};

const FORKLIFT_STATE: Record<ForkliftStatus, StateBadge> = {
  active: { label: 'Active', tone: 'green' },
  idle: { label: 'Idle', tone: 'gray' },
  charging: { label: 'Charging', tone: 'blue' },
  maintenance: { label: 'Maintenance', tone: 'red' },
};

const SHIPMENT_STATE: Record<ShipmentStatus, StateBadge> = {
  scheduled: { label: 'Scheduled', tone: 'blue' },
  loading: { label: 'Loading', tone: 'amber' },
  in_transit: { label: 'In transit', tone: 'amber' },
  arrived: { label: 'Waiting for dock', tone: 'amber' },
  unloading: { label: 'Unloading', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const CATEGORY: Record<InventoryCategory, string> = {
  food_beverage: 'Food & beverage',
  household: 'Household',
  personal_care: 'Personal care',
  electronics: 'Electronics',
  auto_parts: 'Auto parts',
  building_materials: 'Building materials',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad2 = (n: number) => String(n).padStart(2, '0');

function units(n: number, unit: StockUnit): string {
  return `${formatNumber(n)} ${unit === 'piece' ? 'pcs' : `${unit}s`}`;
}

// ── Lookups ────────────────────────────────────────────────────────────────

function siteOf(data: WareTrackData, siteId: SiteId) {
  return data.sites.find((s) => s.id === siteId)!;
}

function dockName(data: WareTrackData, dockId: DockId): string {
  const dock = data.docks.find((d) => d.id === dockId)!;
  return `Dock ${pad2(dock.number)} · ${siteOf(data, dock.siteId).code}`;
}

function stopName(data: WareTrackData, stop: Shipment['origin']): string {
  return stop.kind === 'site' ? siteOf(data, stop.siteId).name : `${stop.name}, ${stop.city}`;
}

/** The active shipment among `candidates`, else the next one still to run. */
function currentOrNext(candidates: Shipment[]): { shipment: Shipment; heading: ShipmentSummary['heading'] } | null {
  const active = candidates.find((s) => ACTIVE_SHIPMENT_STATUSES.includes(s.status));
  if (active) return { shipment: active, heading: 'Current shipment' };
  const next = candidates
    .filter((s) => s.status === 'scheduled')
    .sort((a, b) => Date.parse(a.scheduledDeparture) - Date.parse(b.scheduledDeparture))[0];
  return next ? { shipment: next, heading: 'Next shipment' } : null;
}

function summarize(input: DetailsInput, found: ReturnType<typeof currentOrNext>): ShipmentSummary | null {
  if (!found) return null;
  const { data, now, sim } = input;
  const { shipment: s, heading } = found;

  const timing = {
    scheduled: `Departs ${formatWhen(s.scheduledDeparture, now)} · ETA ${formatWhen(s.eta, now)}`,
    loading: `Departs ${formatWhen(s.scheduledDeparture, now)} · ETA ${formatWhen(s.eta, now)}`,
    in_transit: `Departed ${formatWhen(s.departedAt ?? s.scheduledDeparture, now)} · ETA ${formatWhen(s.eta, now)}`,
    arrived: `Arrived ${formatWhen(s.arrivedAt ?? s.eta, now)}`,
    unloading: `Arrived ${formatWhen(s.arrivedAt ?? s.eta, now)}`,
    completed: `Completed ${formatWhen(s.completedAt ?? s.eta, now)}`,
    cancelled: 'Cancelled',
  }[s.status];

  // Same rule as the on-time KPI and the delayed filter.
  const minutes = minutesLate(s);
  const delay: StateBadge =
    minutes > ON_TIME_GRACE_MIN
      ? { label: `${minutes} min late`, tone: minutes > 60 ? 'red' : 'amber' }
      : minutes < 0
        ? { label: `${-minutes} min early`, tone: 'green' }
        : { label: minutes > 0 ? `On time · +${minutes} min` : 'On time', tone: 'green' };

  return {
    id: s.id,
    heading,
    direction: capitalize(s.direction),
    status: SHIPMENT_STATE[s.status],
    from: stopName(data, s.origin),
    to: stopName(data, s.destination),
    progress: workProgress(s, sim, now),
    progressLabel: s.status === 'loading' ? 'Loaded' : s.status === 'unloading' ? 'Unloaded' : 'Route',
    timing,
    delay,
    load: `${s.lines.length} line${s.lines.length === 1 ? '' : 's'} · ${formatNumber(shipmentWeightKg(data, s))} kg`,
  };
}

function shipmentsWithItems(data: WareTrackData, itemIds: Set<string>): Shipment[] {
  return data.shipments.filter((s) => s.lines.some((l) => itemIds.has(l.itemId)));
}

function lastUpdate(input: DetailsInput, keys: EntityKey[]): IsoDateTime {
  const times = keys.map((k) => input.updatedAt[k] ?? input.since);
  return times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

// ── Per kind ───────────────────────────────────────────────────────────────

function truckDetails(input: DetailsInput, truck: Truck): Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'> {
  const { data } = input;
  const found = currentOrNext(data.shipments.filter((s) => s.truckId === truck.id));
  const pos = truck.position;
  const location =
    pos.kind === 'dock'
      ? dockName(data, pos.dockId)
      : pos.kind === 'yard'
        ? `Yard · ${siteOf(data, pos.siteId).code}`
        : `On the road · ${pos.coordinates.lat.toFixed(3)}, ${pos.coordinates.lng.toFixed(3)}`;
  const home = siteOf(data, truck.homeSiteId);
  return {
    kind: 'Truck',
    title: truck.id,
    subtitle: `${truck.model} · ${truck.plateNumber}`,
    state: TRUCK_STATE[truck.status],
    shipment: summarize(input, found),
    noShipment: 'No shipment assigned',
    fields: [
      { label: 'Location', value: location },
      { label: 'Driver', value: truck.driver?.name ?? 'Unassigned' },
      { label: 'Phone', value: truck.driver?.phone ?? '—' },
      { label: 'Home site', value: `${home.code} · ${home.city}` },
      { label: 'Capacity', value: `${capitalize(truck.vehicleClass)} · ${formatNumber(truck.payloadKg)} kg` },
    ],
  };
}

function forkliftDetails(input: DetailsInput, forklift: Forklift): Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'> {
  const { data, now, sim } = input;
  const task = forklift.status === 'active' ? sim.tasks[forklift.id] : undefined;
  const taskItem = task && data.inventory.find((i) => i.id === task.itemId);
  const dockTruck =
    forklift.assignedDockId &&
    data.trucks.find((t) => t.position.kind === 'dock' && t.position.dockId === forklift.assignedDockId);
  const found = dockTruck ? currentOrNext(data.shipments.filter((s) => s.truckId === dockTruck.id)) : null;

  const state: StateBadge =
    forklift.status === 'active' && forklift.assignedDockId
      ? { label: dockTruck && dockTruck.status === 'unloading' ? 'Unloading' : 'Loading', tone: 'green' }
      : forklift.status === 'active' && taskItem
        ? { label: 'Putaway', tone: 'green' }
        : FORKLIFT_STATE[forklift.status];
  const location = forklift.assignedDockId
    ? dockName(data, forklift.assignedDockId)
    : taskItem
      ? `Aisle ${taskItem.bin.zone}-${pad2(taskItem.bin.aisle)} · ${siteOf(data, forklift.siteId).code}`
      : `Parking · ${siteOf(data, forklift.siteId).code}`;
  const battery = forklift.batteryPct;

  return {
    kind: 'Forklift',
    title: forklift.id,
    subtitle: `${forklift.model} · ${siteOf(data, forklift.siteId).name}`,
    state,
    shipment: summarize(input, found),
    noShipment: taskItem ? `Putting away ${taskItem.name} until ${formatWhen(task!.until, now)}` : 'Not working a shipment',
    fields: [
      { label: 'Location', value: location },
      { label: 'Operator', value: forklift.operatorName ?? '—' },
      battery === null
        ? { label: 'Power', value: 'Diesel' }
        : { label: 'Battery', value: `${battery}%`, tone: battery <= 20 ? 'red' : battery <= 40 ? 'amber' : 'green' },
      { label: 'Lift capacity', value: `${formatNumber(forklift.liftCapacityKg)} kg` },
    ],
  };
}

function dockDetails(input: DetailsInput, dock: Dock): Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'> {
  const { data } = input;
  const truck = data.trucks.find((t) => t.position.kind === 'dock' && t.position.dockId === dock.id);
  const forklifts = data.forklifts.filter((f) => f.assignedDockId === dock.id);
  const usesDock = (s: Shipment) =>
    (s.origin.kind === 'site' && s.origin.dockId === dock.id) ||
    (s.destination.kind === 'site' && s.destination.dockId === dock.id);
  const found = truck
    ? currentOrNext(data.shipments.filter((s) => s.truckId === truck.id))
    : currentOrNext(data.shipments.filter((s) => s.status === 'scheduled' && usesDock(s)));

  const state: StateBadge =
    dock.status === 'maintenance'
      ? { label: 'Maintenance', tone: 'red' }
      : truck
        ? { label: `${TRUCK_STATE[truck.status].label} ${truck.id}`, tone: 'amber' }
        : { label: 'Available', tone: 'green' };

  return {
    kind: 'Dock',
    title: `Dock ${pad2(dock.number)}`,
    subtitle: `${siteOf(data, dock.siteId).name} · ${capitalize(dock.type)}`,
    state,
    shipment: summarize(input, found),
    noShipment: 'Nothing booked at this dock',
    fields: [
      { label: 'Truck', value: truck ? `${truck.id} · ${truck.plateNumber}` : '—' },
      { label: 'Forklifts', value: forklifts.length ? forklifts.map((f) => f.id).join(', ') : '—' },
      { label: 'Door', value: dock.status === 'maintenance' ? 'Closed for maintenance' : truck ? 'Open' : 'Closed' },
      { label: 'Max vehicle', value: capitalize(dock.maxVehicleClass) },
    ],
  };
}

function stockBadge(item: InventoryItem): StateBadge {
  if (item.quantity === 0) return { label: 'Out of stock', tone: 'red' };
  if (item.quantity <= item.reorderPoint) return { label: 'Low stock', tone: 'amber' };
  return { label: 'In stock', tone: 'green' };
}

function itemDetails(input: DetailsInput, item: InventoryItem): Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'> {
  const { data } = input;
  const site = siteOf(data, item.siteId);
  return {
    kind: 'Stock',
    title: item.name,
    subtitle: `${item.sku} · ${site.code} ${item.bin.zone}-${pad2(item.bin.aisle)}-${item.bin.level}`,
    state: stockBadge(item),
    shipment: summarize(input, currentOrNext(shipmentsWithItems(data, new Set([item.id])))),
    noShipment: 'Not on any open shipment',
    fields: [
      { label: 'On hand', value: units(item.quantity, item.unit), tone: stockBadge(item).tone },
      { label: 'Reorder point', value: units(item.reorderPoint, item.unit) },
      { label: 'Weight', value: `${formatNumber(item.quantity * item.unitWeightKg)} kg` },
      { label: 'Category', value: CATEGORY[item.category] },
      { label: 'Bin', value: `Zone ${item.bin.zone} · aisle ${pad2(item.bin.aisle)} · level ${item.bin.level}` },
    ],
  };
}

function rackDetails(input: DetailsInput, id: string): Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'> & { items: InventoryItem[] } {
  const { data } = input;
  const { siteId, zone, aisle } = parseRackId(id);
  const items = data.inventory
    .filter((i) => i.siteId === siteId && i.bin.zone === zone && i.bin.aisle === aisle)
    .sort((a, b) => a.bin.level - b.bin.level);
  const low = items.filter((i) => i.quantity <= i.reorderPoint).length;
  return {
    items,
    kind: 'Rack',
    title: `Rack ${zone}-${pad2(aisle)}`,
    subtitle: siteOf(data, siteId).name,
    state: !items.length
      ? { label: 'Empty', tone: 'gray' }
      : low
        ? { label: `${low} low on stock`, tone: 'amber' }
        : { label: `${items.length} SKU${items.length === 1 ? '' : 's'} stocked`, tone: 'green' },
    shipment: summarize(input, currentOrNext(shipmentsWithItems(data, new Set(items.map((i) => i.id))))),
    noShipment: items.length ? 'No open shipment for this rack' : 'Nothing stored here',
    fields: [
      { label: 'Zone', value: zone },
      { label: 'Aisle', value: pad2(aisle) },
      { label: 'Levels in use', value: `${new Set(items.map((i) => i.bin.level)).size} of 4` },
    ],
    list: {
      heading: 'Contents',
      rows: items.map((i) => ({
        label: `L${i.bin.level} · ${i.name}`,
        value: units(i.quantity, i.unit),
        tone: stockBadge(i).tone === 'green' ? undefined : stockBadge(i).tone,
      })),
    },
  };
}

// ── Entry point ────────────────────────────────────────────────────────────

export function buildEntityDetails(input: DetailsInput, ref: EntityRef): EntityDetails | null {
  const { data } = input;
  const key = entityKey(ref);
  const finish = (d: Omit<EntityDetails, 'key' | 'updatedAt' | 'updatedLabel'>, keys: EntityKey[]): EntityDetails => {
    const updatedAt = lastUpdate(input, keys);
    return { ...d, key, updatedAt, updatedLabel: formatClock(updatedAt) };
  };

  switch (ref.kind) {
    case 'truck': {
      const truck = data.trucks.find((t) => t.id === ref.id);
      return truck ? finish(truckDetails(input, truck), [key]) : null;
    }
    case 'forklift': {
      const forklift = data.forklifts.find((f) => f.id === ref.id);
      return forklift ? finish(forkliftDetails(input, forklift), [key]) : null;
    }
    case 'dock': {
      const dock = data.docks.find((d) => d.id === ref.id);
      return dock ? finish(dockDetails(input, dock), [key]) : null;
    }
    case 'item': {
      const item = data.inventory.find((i) => i.id === ref.id);
      return item ? finish(itemDetails(input, item), [key]) : null;
    }
    case 'rack': {
      const { items, ...rack } = rackDetails(input, ref.id);
      return finish(rack, [key, ...items.map((i) => entityKey({ kind: 'item', id: i.id }))]);
    }
  }
}
