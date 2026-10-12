/**
 * Live-operations simulation. Pure: `advance()` takes a snapshot and returns
 * the next one, so it can run in the store, in tests, or headless.
 *
 * Each tick moves a simulated clock forward and applies the rules a real
 * yard would follow: shipments load, depart, travel, arrive, unload and
 * complete; trucks and docks follow their shipments; forklifts are sent to
 * docks that are being worked, run putaway jobs, drain and recharge.
 * Every result passes `validateData()` (see sim/check.ts).
 *
 * Simplifications:
 * - A truck that delivers to a customer is back in its home yard on the next
 *   tick (the return leg isn't modelled).
 * - A shipment that can't start on time keeps its planned departure; only its
 *   ETA slips.
 */
import { fitsDock, transitProgress } from '../data';
import type {
  Coordinates,
  Dock,
  DockId,
  DockType,
  Forklift,
  ForkliftId,
  InventoryItem,
  InventoryItemId,
  IsoDateTime,
  Shipment,
  ShipmentId,
  SiteId,
  SiteStop,
  Truck,
  TruckId,
  WareTrackData,
} from '../data';
import { entityKey, type EntityKey } from '../state/entities';
import { addMinutes, minutesBetween } from '../state/format';

// ── Tuning ──────────────────────────────────────────────────────────────────

/** Real time between ticks. */
export const TICK_MS = 2000;
/** Simulated minutes per tick (60× real time). */
export const SIM_MINUTES_PER_TICK = 2;

const LOADING_LEAD_MIN = 45; // truck goes to the dock this long before departure
const MIN_LOADING_MIN = 20;
const UNLOADING_MIN = 30;
const BATTERY_DRAIN_PER_TICK = 2;
const BATTERY_CHARGE_PER_TICK = 5;
const BATTERY_LOW = 20; // stop work and go charging
const BATTERY_READY = 95; // charging finished
const BATTERY_MIN_FOR_DOCK = 30;
const BATTERY_MIN_FOR_PUTAWAY = 40;
const PUTAWAY_CHANCE = 0.2;
const REPAIR_CHANCE = 0.03;
const TRAFFIC_DELAY_CHANCE = 0.12;
const TRAFFIC_RECOVER_CHANCE = 0.05;

/** Operators on shift at each site; forklifts draw from this pool. */
const OPERATORS: Record<SiteId, string[]> = {
  'SITE-JKT': ['Agus Setiawan', 'Dedi Kurniawan', 'Rudi Hartono'],
  'SITE-CKR': ['Hendra Wijaya', 'Slamet Riyadi', 'Wawan Gunawan'],
  'SITE-SBY': ['Bayu Nugroho', 'Fikri Ramadhani'],
};

// ── Simulation-only state ──────────────────────────────────────────────────

/** A putaway job: the forklift works the rack holding `itemId` until `until`. */
export interface ForkliftTask {
  itemId: InventoryItemId;
  until: IsoDateTime;
}

/** Bookkeeping the domain model has no field for. */
export interface SimState {
  tasks: Partial<Record<ForkliftId, ForkliftTask>>;
  /** When loading or unloading started, per shipment. */
  workStartedAt: Partial<Record<ShipmentId, IsoDateTime>>;
}

export const INITIAL_SIM_STATE: SimState = { tasks: {}, workStartedAt: {} };

export interface TickResult {
  data: WareTrackData;
  sim: SimState;
  now: IsoDateTime;
  /** Entities whose state changed this tick. */
  changed: EntityKey[];
}

export type Rng = () => number;

/** Small seeded PRNG so runs are reproducible. */
export function createRng(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Copy-on-write working set ──────────────────────────────────────────────

/** Mutable view of a snapshot that only copies the records it changes. */
class World {
  readonly trucks: Map<TruckId, Truck>;
  readonly forklifts: Map<ForkliftId, Forklift>;
  readonly shipments: Map<ShipmentId, Shipment>;
  readonly inventory: Map<InventoryItemId, InventoryItem>;
  readonly docks: Map<DockId, Dock>;
  readonly changed = new Set<EntityKey>();
  private readonly dirty = new Set<keyof WareTrackData>();

  constructor(private readonly data: WareTrackData) {
    this.trucks = new Map(data.trucks.map((t) => [t.id, t]));
    this.forklifts = new Map(data.forklifts.map((f) => [f.id, f]));
    this.shipments = new Map(data.shipments.map((s) => [s.id, s]));
    this.inventory = new Map(data.inventory.map((i) => [i.id, i]));
    this.docks = new Map(data.docks.map((d) => [d.id, d]));
  }

  site(siteId: SiteId) {
    return this.data.sites.find((s) => s.id === siteId)!;
  }

  truck(id: TruckId) {
    return this.trucks.get(id)!;
  }

  patchTruck(id: TruckId, patch: Partial<Truck>) {
    const before = this.truck(id);
    // A truck leaving or entering a dock changes that dock too.
    for (const pos of [before.position, patch.position]) {
      if (pos?.kind === 'dock') this.touchDock(pos.dockId);
    }
    this.trucks.set(id, { ...before, ...patch });
    this.mark('trucks', entityKey({ kind: 'truck', id }));
  }

  patchForklift(id: ForkliftId, patch: Partial<Forklift>) {
    this.forklifts.set(id, { ...this.forklifts.get(id)!, ...patch });
    this.mark('forklifts', entityKey({ kind: 'forklift', id }));
  }

  patchShipment(id: ShipmentId, patch: Partial<Shipment>) {
    this.shipments.set(id, { ...this.shipments.get(id)!, ...patch } as Shipment);
    this.dirty.add('shipments');
  }

  adjustStock(id: InventoryItemId, delta: number) {
    const item = this.inventory.get(id)!;
    this.inventory.set(id, { ...item, quantity: Math.max(0, item.quantity + delta) });
    this.mark('inventory', entityKey({ kind: 'item', id }));
  }

  touchDock(id: DockId) {
    this.changed.add(entityKey({ kind: 'dock', id }));
  }

  /** Records that a truck's work progressed (and its dock's) without a field changing. */
  touchWork(truckId: TruckId) {
    this.changed.add(entityKey({ kind: 'truck', id: truckId }));
    const pos = this.truck(truckId).position;
    if (pos.kind === 'dock') this.touchDock(pos.dockId);
  }

  touchForklift(id: ForkliftId) {
    this.changed.add(entityKey({ kind: 'forklift', id }));
  }

  truckAtDock(dockId: DockId): Truck | undefined {
    for (const t of this.trucks.values()) {
      if (t.position.kind === 'dock' && t.position.dockId === dockId) return t;
    }
    return undefined;
  }

  hasActiveShipment(truckId: TruckId, except?: ShipmentId): boolean {
    for (const s of this.shipments.values()) {
      if (s.id !== except && s.truckId === truckId && isActive(s)) return true;
    }
    return false;
  }

  /** Snapshot with untouched collections (and records) passed through as-is. */
  build(): WareTrackData {
    const d = this.data;
    return {
      ...d,
      trucks: this.dirty.has('trucks') ? d.trucks.map((r) => this.trucks.get(r.id)!) : d.trucks,
      forklifts: this.dirty.has('forklifts') ? d.forklifts.map((r) => this.forklifts.get(r.id)!) : d.forklifts,
      shipments: this.dirty.has('shipments') ? d.shipments.map((r) => this.shipments.get(r.id)!) : d.shipments,
      inventory: this.dirty.has('inventory') ? d.inventory.map((r) => this.inventory.get(r.id)!) : d.inventory,
    };
  }

  weightKg(s: Shipment): number {
    return s.lines.reduce((sum, l) => sum + l.quantity * (this.inventory.get(l.itemId)?.unitWeightKg ?? 0), 0);
  }

  private mark(collection: keyof WareTrackData, key: EntityKey) {
    this.dirty.add(collection);
    this.changed.add(key);
  }
}

function isActive(s: Shipment): boolean {
  return s.status === 'loading' || s.status === 'in_transit' || s.status === 'arrived' || s.status === 'unloading';
}

function at(t: IsoDateTime, iso: IsoDateTime): boolean {
  return Date.parse(t) >= Date.parse(iso);
}

function lerpCoordinates(a: Coordinates, b: Coordinates, k: number): Coordinates {
  const round = (v: number) => Math.round(v * 10_000) / 10_000;
  return { lat: round(a.lat + (b.lat - a.lat) * k), lng: round(a.lng + (b.lng - a.lng) * k) };
}

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ── Entry point ────────────────────────────────────────────────────────────

export function advance(data: WareTrackData, sim: SimState, now: IsoDateTime, rng: Rng): TickResult {
  const t = addMinutes(now, SIM_MINUTES_PER_TICK);
  const world = new World(data);
  const next: SimState = { tasks: { ...sim.tasks }, workStartedAt: { ...sim.workStartedAt } };

  const order = [...data.shipments].sort((a, b) => Date.parse(a.scheduledDeparture) - Date.parse(b.scheduledDeparture));
  for (const { id } of order) advanceShipment(world, next, id, t, rng);
  advanceForklifts(world, next, t, rng);

  return { data: world.build(), sim: next, now: t, changed: [...world.changed] };
}

// ── Shipments ──────────────────────────────────────────────────────────────

function stopCoordinates(world: World, stop: Shipment['origin']): Coordinates {
  return stop.kind === 'site' ? world.site(stop.siteId).coordinates : stop.coordinates;
}

/** Planned door-to-door duration. */
function travelMinutes(s: Shipment): number {
  return minutesBetween(s.scheduledDeparture, s.plannedEta);
}

function advanceShipment(world: World, sim: SimState, id: ShipmentId, t: IsoDateTime, rng: Rng) {
  const s = world.shipments.get(id)!;
  switch (s.status) {
    case 'scheduled':
      return startShipment(world, sim, s, t);
    case 'loading':
      return continueLoading(world, sim, s, t);
    case 'in_transit':
      return continueTransit(world, sim, s, t, rng);
    case 'arrived':
      return tryDockArrival(world, sim, s, t);
    case 'unloading':
      return continueUnloading(world, sim, s, t);
  }
}

function startShipment(world: World, sim: SimState, s: Shipment, t: IsoDateTime) {
  if (s.direction === 'inbound') {
    // Pickup at a supplier: the truck sets off at the planned time.
    if (!at(t, s.scheduledDeparture)) return;
    const truckId = s.truckId ?? findIdleTruck(world, s, s.destination.siteId, s.id);
    const truck = truckId ? world.truck(truckId) : undefined;
    if (!truck || truck.status !== 'idle' || world.hasActiveShipment(truck.id, s.id)) return slip(world, s, t);
    const destination = ensureDock(world, s.destination, truck, ['inbound', 'flex']);
    if (!destination) return slip(world, s, t);
    world.patchShipment(s.id, {
      truckId: truck.id,
      destination,
      status: 'in_transit',
      departedAt: t,
      eta: addMinutes(t, travelMinutes(s)),
    });
    world.patchTruck(truck.id, {
      status: 'in_transit',
      position: { kind: 'road', coordinates: stopCoordinates(world, s.origin), updatedAt: t },
    });
    return;
  }

  // Leaving one of our sites: bring a truck to the dock ahead of departure.
  if (!at(t, addMinutes(s.scheduledDeparture, -LOADING_LEAD_MIN))) return;
  const origin = s.origin;
  const truckId = s.truckId ?? findIdleTruck(world, s, origin.siteId, s.id);
  const truck = truckId ? world.truck(truckId) : undefined;
  const ready =
    truck &&
    truck.status === 'idle' &&
    truck.position.kind === 'yard' &&
    truck.position.siteId === origin.siteId &&
    !world.hasActiveShipment(truck.id, s.id);
  if (!truck || !ready) return slip(world, s, t);

  const originStop = ensureDock(world, origin, truck, ['outbound', 'flex'], { mustBeFree: true });
  const destination =
    s.destination.kind === 'site' ? ensureDock(world, s.destination, truck, ['inbound', 'flex']) : s.destination;
  if (!originStop || !destination || world.truckAtDock(originStop.dockId!)) return slip(world, s, t);

  world.patchShipment(s.id, { truckId: truck.id, origin: originStop, destination, status: 'loading' } as Partial<Shipment>);
  world.patchTruck(truck.id, { status: 'loading', position: { kind: 'dock', dockId: originStop.dockId! } });
  sim.workStartedAt[s.id] = t;
  updateProjectedEta(world, s.id, t);
}

/** A shipment that couldn't start on time keeps its plan; its ETA moves out. */
function slip(world: World, s: Shipment, t: IsoDateTime) {
  if (at(t, s.scheduledDeparture)) updateProjectedEta(world, s.id, t);
}

/** ETA for a shipment that hasn't left yet, given the earliest it can depart. */
function updateProjectedEta(world: World, id: ShipmentId, earliestDeparture: IsoDateTime) {
  const s = world.shipments.get(id)!;
  const departure = Math.max(Date.parse(s.scheduledDeparture), Date.parse(earliestDeparture));
  const eta = addMinutes(new Date(departure).toISOString(), travelMinutes(s));
  if (Date.parse(eta) !== Date.parse(s.eta)) world.patchShipment(id, { eta });
}

/** When loading began and when it can finish (departure, or the minimum loading time). */
function loadingWindow(s: Shipment, sim: SimState): [IsoDateTime, IsoDateTime] {
  const started = sim.workStartedAt[s.id] ?? addMinutes(s.scheduledDeparture, -LOADING_LEAD_MIN);
  const minDone = addMinutes(started, MIN_LOADING_MIN);
  return [started, Date.parse(minDone) > Date.parse(s.scheduledDeparture) ? minDone : s.scheduledDeparture];
}

function unloadingWindow(s: Shipment, sim: SimState): [IsoDateTime, IsoDateTime] {
  const started = sim.workStartedAt[s.id] ?? s.arrivedAt ?? s.eta;
  return [started, addMinutes(started, UNLOADING_MIN)];
}

/**
 * 0–1 progress of whatever the shipment is doing now: loading, the road leg,
 * or unloading. Null when it isn't under way.
 */
export function workProgress(s: Shipment, sim: SimState, now: IsoDateTime): number | null {
  if (s.status === 'in_transit') return transitProgress(s, now);
  if (s.status !== 'loading' && s.status !== 'unloading') return null;
  const [start, end] = s.status === 'loading' ? loadingWindow(s, sim) : unloadingWindow(s, sim);
  const span = Date.parse(end) - Date.parse(start);
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (Date.parse(now) - Date.parse(start)) / span));
}

function continueLoading(world: World, sim: SimState, s: Shipment, t: IsoDateTime) {
  const [, doneAt] = loadingWindow(s, sim);
  if (!at(t, doneAt)) {
    world.touchWork(s.truckId!);
    return updateProjectedEta(world, s.id, doneAt);
  }

  // Depart: stock leaves the origin site and the dock frees up.
  for (const line of s.lines) world.adjustStock(line.itemId, -line.quantity);
  world.patchShipment(s.id, { status: 'in_transit', departedAt: t, eta: addMinutes(t, travelMinutes(s)) });
  world.patchTruck(s.truckId!, {
    status: 'in_transit',
    position: { kind: 'road', coordinates: stopCoordinates(world, s.origin), updatedAt: t },
  });
  delete sim.workStartedAt[s.id];
}

function continueTransit(world: World, sim: SimState, s: Shipment, t: IsoDateTime, rng: Rng) {
  // Traffic nudges the ETA now and then.
  let eta = s.eta;
  const roll = rng();
  if (roll < TRAFFIC_DELAY_CHANCE) eta = addMinutes(eta, randInt(rng, 1, 4));
  else if (roll < TRAFFIC_DELAY_CHANCE + TRAFFIC_RECOVER_CHANCE && minutesBetween(t, eta) > SIM_MINUTES_PER_TICK + 2) {
    eta = addMinutes(eta, -randInt(rng, 1, 2));
  }
  if (eta !== s.eta) world.patchShipment(s.id, { eta });

  const truckId = s.truckId!;
  if (!at(t, eta)) {
    const progress = transitProgress({ ...s, eta }, t);
    const coordinates = lerpCoordinates(stopCoordinates(world, s.origin), stopCoordinates(world, s.destination), progress);
    world.patchTruck(truckId, { position: { kind: 'road', coordinates, updatedAt: t } });
    return;
  }

  // Arrived.
  if (s.destination.kind === 'external') {
    world.patchShipment(s.id, { status: 'completed', arrivedAt: eta, completedAt: t });
    const truck = world.truck(truckId);
    world.patchTruck(truckId, { status: 'idle', position: { kind: 'yard', siteId: truck.homeSiteId } });
    return;
  }
  world.patchShipment(s.id, { status: 'arrived', arrivedAt: eta });
  world.patchTruck(truckId, { status: 'idle', position: { kind: 'yard', siteId: s.destination.siteId } });
  tryDockArrival(world, sim, world.shipments.get(s.id)!, t);
}

function tryDockArrival(world: World, sim: SimState, s: Shipment, t: IsoDateTime) {
  if (s.destination.kind !== 'site') return;
  const truck = world.truck(s.truckId!);
  const destination = ensureDock(world, s.destination, truck, ['inbound', 'flex'], { mustBeFree: true, reassign: true });
  if (!destination || world.truckAtDock(destination.dockId!)) return; // wait in the yard
  world.patchShipment(s.id, { status: 'unloading', destination } as Partial<Shipment>);
  world.patchTruck(truck.id, { status: 'unloading', position: { kind: 'dock', dockId: destination.dockId! } });
  sim.workStartedAt[s.id] = t;
}

function continueUnloading(world: World, sim: SimState, s: Shipment, t: IsoDateTime) {
  const [, doneAt] = unloadingWindow(s, sim);
  if (s.destination.kind !== 'site') return;
  if (!at(t, doneAt)) return world.touchWork(s.truckId!);

  // Stock lands at the destination: the line's own record for inbound, the
  // same SKU's record at the destination for transfers.
  const destSite = s.destination.siteId;
  for (const line of s.lines) {
    const item = world.inventory.get(line.itemId)!;
    const target =
      item.siteId === destSite
        ? item
        : [...world.inventory.values()].find((i) => i.siteId === destSite && i.sku === item.sku);
    if (target) world.adjustStock(target.id, line.quantity);
  }
  world.patchShipment(s.id, { status: 'completed', completedAt: t });
  world.patchTruck(s.truckId!, { status: 'idle', position: { kind: 'yard', siteId: destSite } });
  delete sim.workStartedAt[s.id];
}

/** An idle truck at the site with room for the load and nothing else booked. */
function findIdleTruck(world: World, s: Shipment, siteId: SiteId, shipmentId: ShipmentId): TruckId | null {
  const weight = world.weightKg(s);
  for (const truck of world.trucks.values()) {
    if (truck.status !== 'idle' || truck.position.kind !== 'yard' || truck.position.siteId !== siteId) continue;
    if (truck.payloadKg < weight) continue;
    const booked = [...world.shipments.values()].some(
      (o) => o.id !== shipmentId && o.truckId === truck.id && (o.status === 'scheduled' || isActive(o)),
    );
    if (!booked) return truck.id;
  }
  return null;
}

/**
 * Makes sure a site stop has a usable dock for this truck. Keeps the current
 * one if it fits (and, with mustBeFree, is free or `reassign` is off);
 * otherwise picks a fitting operational dock, preferring free ones.
 */
function ensureDock(
  world: World,
  stop: SiteStop,
  truck: Truck,
  types: DockType[],
  opts: { mustBeFree?: boolean; reassign?: boolean } = {},
): SiteStop | null {
  const usable = (d: Dock | undefined): d is Dock =>
    !!d && d.siteId === stop.siteId && d.status === 'operational' && types.includes(d.type) && fitsDock(truck, d);
  const isFree = (d: Dock) => {
    const occupant = world.truckAtDock(d.id);
    return !occupant || occupant.id === truck.id;
  };

  const current = stop.dockId ? world.docks.get(stop.dockId) : undefined;
  if (usable(current) && (!opts.mustBeFree || isFree(current) || !opts.reassign)) return stop;

  const candidates = [...world.docks.values()].filter(usable);
  const choice = candidates.find(isFree) ?? (opts.mustBeFree ? undefined : candidates[0]);
  return choice ? { ...stop, dockId: choice.id } : null;
}

// ── Forklifts ──────────────────────────────────────────────────────────────

function advanceForklifts(world: World, sim: SimState, t: IsoDateTime, rng: Rng) {
  const workingDocks = new Set<DockId>();
  for (const truck of world.trucks.values()) {
    if (truck.position.kind === 'dock' && (truck.status === 'loading' || truck.status === 'unloading')) {
      workingDocks.add(truck.position.dockId);
    }
  }

  const release = (f: Forklift, status: Forklift['status']) => {
    delete sim.tasks[f.id];
    world.patchForklift(f.id, { status, assignedDockId: null, operatorName: null });
  };

  for (const f of [...world.forklifts.values()]) {
    const task = sim.tasks[f.id];

    // Work finished: the dock's truck left, or the putaway job is done.
    if (f.status === 'active' && f.assignedDockId && !workingDocks.has(f.assignedDockId)) {
      release(f, 'idle');
      continue;
    }
    if (f.status === 'active' && task && at(t, task.until)) {
      release(f, 'idle');
      continue;
    }

    if (f.power === 'electric' && f.batteryPct !== null) {
      if (f.status === 'active') {
        const batteryPct = Math.max(0, f.batteryPct - BATTERY_DRAIN_PER_TICK);
        if (batteryPct <= BATTERY_LOW) release({ ...f, batteryPct }, 'charging');
        world.patchForklift(f.id, { batteryPct });
      } else if (f.status === 'charging') {
        const batteryPct = Math.min(100, f.batteryPct + BATTERY_CHARGE_PER_TICK);
        world.patchForklift(f.id, { batteryPct, ...(batteryPct >= BATTERY_READY ? { status: 'idle' as const } : {}) });
      }
    }

    if (f.status === 'maintenance' && rng() < REPAIR_CHANCE) world.patchForklift(f.id, { status: 'idle' });
    // A working forklift reports in every tick, diesel ones included.
    if (world.forklifts.get(f.id)!.status === 'active') world.touchForklift(f.id);
  }

  // Send a forklift to every dock that's being worked and has none.
  for (const dockId of workingDocks) {
    const forklifts = [...world.forklifts.values()];
    if (forklifts.some((f) => f.assignedDockId === dockId && f.status === 'active')) continue;
    const dock = world.docks.get(dockId)!;
    const candidate = forklifts
      .filter((f) => f.siteId === dock.siteId && f.status === 'idle' && hasCharge(f, BATTERY_MIN_FOR_DOCK))
      .sort((a, b) => (b.batteryPct ?? 100) - (a.batteryPct ?? 100))[0];
    const operator = candidate && freeOperator(world, candidate.siteId);
    if (candidate && operator) {
      world.patchForklift(candidate.id, { status: 'active', assignedDockId: dockId, operatorName: operator });
    }
  }

  // Idle forklifts pick up putaway jobs now and then.
  for (const f of [...world.forklifts.values()]) {
    if (f.status !== 'idle' || !hasCharge(f, BATTERY_MIN_FOR_PUTAWAY) || rng() >= PUTAWAY_CHANCE) continue;
    const items = [...world.inventory.values()].filter((i) => i.siteId === f.siteId);
    const operator = freeOperator(world, f.siteId);
    if (!items.length || !operator) continue;
    const item = items[Math.floor(rng() * items.length)];
    sim.tasks[f.id] = { itemId: item.id, until: addMinutes(t, randInt(rng, 3, 6) * SIM_MINUTES_PER_TICK) };
    world.patchForklift(f.id, { status: 'active', assignedDockId: null, operatorName: operator });
  }
}

function hasCharge(f: Forklift, minPct: number): boolean {
  return f.batteryPct === null || f.batteryPct >= minPct;
}

function freeOperator(world: World, siteId: SiteId): string | undefined {
  const busy = new Set([...world.forklifts.values()].map((f) => f.operatorName).filter(Boolean));
  return OPERATORS[siteId]?.find((name) => !busy.has(name));
}
