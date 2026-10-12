/**
 * Referential-integrity and consistency checks for a WareTrackData snapshot.
 * Returns a list of human-readable problems; an empty list means the data is
 * consistent as of `now`.
 */
import {
  ACTIVE_SHIPMENT_STATUSES,
  fitsDock,
  indexById,
  shipmentWeightKg,
  stockSiteOf,
} from './relations';
import type { DockType, IsoDateTime, Shipment, SiteStop, WareTrackData } from './types';

export function validateData(data: WareTrackData, now: IsoDateTime): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(msg);

  const sites = indexById(data.sites);
  const docks = indexById(data.docks);
  const trucks = indexById(data.trucks);
  const items = indexById(data.inventory);
  const nowMs = Date.parse(now);

  for (const [name, rows] of Object.entries(data)) {
    const ids = (rows as { id: string }[]).map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) fail(`${name}: duplicate ids ${dupes.join(', ')}`);
  }

  // Docks
  for (const dock of data.docks) {
    if (!sites.has(dock.siteId)) fail(`${dock.id}: unknown site ${dock.siteId}`);
  }

  // Trucks
  const occupiedDocks = new Map<string, string>();
  for (const truck of data.trucks) {
    if (!sites.has(truck.homeSiteId)) fail(`${truck.id}: unknown home site ${truck.homeSiteId}`);
    const pos = truck.position;
    const expectedPosition = {
      idle: 'yard',
      maintenance: 'yard',
      loading: 'dock',
      unloading: 'dock',
      in_transit: 'road',
    }[truck.status];
    if (pos.kind !== expectedPosition) fail(`${truck.id}: status ${truck.status} but position is ${pos.kind}`);
    if (pos.kind === 'yard' && !sites.has(pos.siteId)) fail(`${truck.id}: unknown yard site ${pos.siteId}`);
    if (pos.kind === 'dock') {
      const dock = docks.get(pos.dockId);
      if (!dock) {
        fail(`${truck.id}: unknown dock ${pos.dockId}`);
      } else {
        if (dock.status !== 'operational') fail(`${truck.id}: parked at ${dock.id}, which is under maintenance`);
        if (!fitsDock(truck, dock)) fail(`${truck.id}: ${truck.vehicleClass} truck does not fit ${dock.id}`);
      }
      const other = occupiedDocks.get(pos.dockId);
      if (other) fail(`${pos.dockId}: occupied by both ${other} and ${truck.id}`);
      occupiedDocks.set(pos.dockId, truck.id);
    }
    if (truck.status !== 'maintenance' && !truck.driver) fail(`${truck.id}: ${truck.status} without a driver`);
  }

  // Forklifts
  for (const fl of data.forklifts) {
    if (!sites.has(fl.siteId)) fail(`${fl.id}: unknown site ${fl.siteId}`);
    if ((fl.power === 'electric') !== (fl.batteryPct !== null)) fail(`${fl.id}: batteryPct must be set iff electric`);
    if (fl.status === 'charging' && fl.power !== 'electric') fail(`${fl.id}: diesel unit cannot be charging`);
    if (fl.status === 'active' && !fl.operatorName) fail(`${fl.id}: active without an operator`);
    if (fl.assignedDockId) {
      const dock = docks.get(fl.assignedDockId);
      if (!dock) fail(`${fl.id}: unknown dock ${fl.assignedDockId}`);
      else if (dock.siteId !== fl.siteId) fail(`${fl.id}: assigned to ${dock.id} at another site`);
    }
  }

  // Inventory
  for (const item of data.inventory) {
    if (!sites.has(item.siteId)) fail(`${item.id}: unknown site ${item.siteId}`);
    if (item.quantity < 0) fail(`${item.id}: negative quantity`);
  }

  // Shipments
  const activeByTruck = new Map<string, string>();
  for (const s of data.shipments) {
    const truck = s.truckId ? trucks.get(s.truckId) : undefined;
    if (s.truckId && !truck) fail(`${s.id}: unknown truck ${s.truckId}`);

    checkStop(s, s.origin, s.direction === 'inbound' ? null : ['outbound', 'flex']);
    checkStop(s, s.destination, s.direction === 'outbound' ? null : ['inbound', 'flex']);

    for (const line of s.lines) {
      const item = items.get(line.itemId);
      if (!item) {
        fail(`${s.id}: unknown item ${line.itemId}`);
        continue;
      }
      if (line.quantity <= 0) fail(`${s.id}: non-positive quantity for ${line.itemId}`);
      if (item.siteId !== stockSiteOf(s)) fail(`${s.id}: ${item.id} is stocked at ${item.siteId}, expected ${stockSiteOf(s)}`);
      if (s.direction === 'transfer') {
        const destSite = s.destination.siteId;
        if (!data.inventory.some((i) => i.siteId === destSite && i.sku === item.sku)) {
          fail(`${s.id}: ${destSite} has no stock record for SKU ${item.sku}`);
        }
      }
    }
    if (s.lines.length === 0) fail(`${s.id}: no lines`);
    if (truck && shipmentWeightKg(data, s) > truck.payloadKg) {
      fail(`${s.id}: ${shipmentWeightKg(data, s)} kg exceeds ${truck.id} payload ${truck.payloadKg} kg`);
    }

    checkTimeline(s);

    if (ACTIVE_SHIPMENT_STATUSES.includes(s.status)) {
      if (!truck) {
        fail(`${s.id}: ${s.status} without a truck`);
        continue;
      }
      const other = activeByTruck.get(truck.id);
      if (other) fail(`${truck.id}: active on both ${other} and ${s.id}`);
      activeByTruck.set(truck.id, s.id);

      const expectedTruckStatus = {
        loading: 'loading',
        in_transit: 'in_transit',
        arrived: 'idle',
        unloading: 'unloading',
      }[s.status as 'loading' | 'in_transit' | 'arrived' | 'unloading'];
      if (truck.status !== expectedTruckStatus) fail(`${s.id} is ${s.status} but ${truck.id} is ${truck.status}`);

      const workDock =
        s.status === 'loading' && s.origin.kind === 'site' ? s.origin.dockId
        : s.status === 'unloading' && s.destination.kind === 'site' ? s.destination.dockId
        : null;
      if (workDock && (truck.position.kind !== 'dock' || truck.position.dockId !== workDock)) {
        fail(`${s.id}: ${truck.id} should be at ${workDock}`);
      }
    }
  }

  for (const truck of data.trucks) {
    if (['loading', 'unloading', 'in_transit'].includes(truck.status) && !activeByTruck.has(truck.id)) {
      fail(`${truck.id}: ${truck.status} with no active shipment`);
    }
  }

  return errors;

  function checkStop(s: Shipment, stop: SiteStop | Shipment['origin'], allowedDockTypes: DockType[] | null) {
    const shouldBeSite = allowedDockTypes !== null;
    if ((stop.kind === 'site') !== shouldBeSite) {
      fail(`${s.id}: ${s.direction} shipment has a ${stop.kind} stop in the wrong place`);
      return;
    }
    if (stop.kind !== 'site') return;
    if (!sites.has(stop.siteId)) fail(`${s.id}: unknown site ${stop.siteId}`);
    if (!stop.dockId) {
      if (s.status !== 'scheduled' && s.status !== 'cancelled') fail(`${s.id}: ${s.status} without a dock at ${stop.siteId}`);
      return;
    }
    const dock = docks.get(stop.dockId);
    if (!dock) return fail(`${s.id}: unknown dock ${stop.dockId}`);
    if (dock.siteId !== stop.siteId) fail(`${s.id}: ${dock.id} is not at ${stop.siteId}`);
    if (!allowedDockTypes!.includes(dock.type)) fail(`${s.id}: ${dock.id} is a ${dock.type} dock`);
    const truck = s.truckId ? trucks.get(s.truckId) : undefined;
    if (truck && !fitsDock(truck, dock)) fail(`${s.id}: ${truck.id} does not fit ${dock.id}`);
  }

  function checkTimeline(s: Shipment) {
    const t = (v: IsoDateTime | null) => (v === null ? null : Date.parse(v));
    const [sched, dep, planned, eta, arr, done] = [
      s.scheduledDeparture, s.departedAt, s.plannedEta, s.eta, s.arrivedAt, s.completedAt,
    ].map(t);
    for (const [label, v] of Object.entries({ scheduledDeparture: sched, plannedEta: planned, eta })) {
      if (Number.isNaN(v)) fail(`${s.id}: invalid ${label}`);
    }
    if (planned! <= sched!) fail(`${s.id}: plannedEta must be after scheduledDeparture`);

    const has = { departed: dep !== null, arrived: arr !== null, completed: done !== null };
    const expected: Record<Shipment['status'], [boolean, boolean, boolean] | null> = {
      scheduled: [false, false, false],
      loading: [false, false, false],
      in_transit: [true, false, false],
      arrived: [true, true, false],
      unloading: [true, true, false],
      completed: [true, true, true],
      cancelled: null,
    };
    const exp = expected[s.status];
    if (exp && (exp[0] !== has.departed || exp[1] !== has.arrived || exp[2] !== has.completed)) {
      fail(`${s.id}: timestamps don't match status ${s.status}`);
    }
    if (s.status === 'cancelled' && (has.arrived || has.completed)) fail(`${s.id}: cancelled but has arrival/completion`);

    if (dep !== null && arr !== null && arr < dep) fail(`${s.id}: arrived before departing`);
    if (arr !== null && done !== null && done < arr) fail(`${s.id}: completed before arriving`);
    if (dep !== null && eta! <= dep) fail(`${s.id}: eta must be after departure`);
    for (const v of [dep, arr, done]) if (v !== null && v > nowMs) fail(`${s.id}: event in the future`);
    if (['scheduled', 'loading', 'in_transit'].includes(s.status) && eta! <= nowMs) {
      fail(`${s.id}: ${s.status} but eta has already passed`);
    }
    if (s.status === 'scheduled' && sched! <= nowMs) fail(`${s.id}: still scheduled after its departure time`);
  }
}

