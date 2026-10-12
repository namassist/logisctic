/**
 * Scene model: turns a WareTrackData snapshot into world-space placements
 * for one site, with everything a component needs to draw (colours, open
 * doors, animation flags) already decided. Pure functions only — the scene
 * components just render what this returns.
 *
 * World axes: x → right, y → up, z → towards the dock side. 1 unit ≈ 1 m.
 * The warehouse sits at the origin with its docks on the +z wall; the apron
 * and access road are further +z and the truck yard is to the +x side.
 */
import {
  activeShipmentForTruck,
  docksAtSite,
  forkliftsAtSite,
  inventoryAtSite,
  transitProgress,
  trucksAtSite,
} from '../data';
import type {
  Dock,
  Forklift,
  InventoryItem,
  IsoDateTime,
  Shipment,
  SiteId,
  Truck,
  VehicleClass,
  WareTrackData,
} from '../data';
import type { ForkliftTask, SimState } from '../sim/simulation';
import { rackId, type EntityRef } from '../state/entities';
import { COLORS, DOCK_TYPE_COLOR, FORKLIFT_STATUS_COLOR, TRUCK_STATUS_COLOR } from './palette';

// ── Fixed site geometry ────────────────────────────────────────────────────

export const BUILDING = {
  width: 64,
  depth: 44,
  wallHeight: 6.5,
  wallThickness: 0.5,
  doorHeight: 4.6,
} as const;

/** z of the wall the docks are in. */
export const FRONT_Z = BUILDING.depth / 2;
const HALF_W = BUILDING.width / 2;

export const DOCK_SPACING = 8;

export const ROAD = { z: 62, width: 9, minX: -110, maxX: 110 } as const;

/** Paved area between the dock wall and the road. */
export const APRON = { minX: -38, maxX: 36, minZ: FRONT_Z, maxZ: ROAD.z - ROAD.width / 2 } as const;

/** Truck parking to the right of the building. */
export const YARD = { minX: 36, maxX: 66, minZ: -10, maxZ: APRON.maxZ } as const;
export const YARD_SLOT = { firstX: 40, width: 5, perRow: 5, firstZ: 4, rowGap: 18 } as const;

/** Where in-transit trucks turn off the road into the apron. */
const GATE_X = 26;
/** Road length that stands in for a whole trip when placing approaching trucks. */
const APPROACH_SPAN = 120;

/** Extent of the playable map; the camera view is kept inside it. */
export const MAP_BOUNDS = { minX: -62, maxX: 76, minZ: -40, maxZ: 74 } as const;

export const RACK = {
  levels: 4,
  levelHeight: 1.4,
  depth: 1.1,
  bays: 4,
  aisleSpacing: 3,
} as const;

const ZONE = { width: 27, depth: 11, gapX: 5, gapZ: 3, backMargin: 2, sideMargin: 2.5 } as const;

export const TRUCK_SIZE: Record<VehicleClass, { length: number; width: number; height: number }> = {
  light: { length: 6.2, width: 2.1, height: 2.7 },
  medium: { length: 7.8, width: 2.3, height: 3.2 },
  heavy: { length: 11.5, width: 2.5, height: 3.8 },
};

export const DOOR_WIDTH: Record<VehicleClass, number> = { light: 3.2, medium: 3.6, heavy: 4 };


const YARD_SLOTS = YARD_SLOT.perRow * 2;

// ── Placement types ────────────────────────────────────────────────────────

export interface DockPlacement {
  dock: Dock;
  x: number;
  doorWidth: number;
  occupiedBy: Truck | null;
  doorOpen: boolean;
  underMaintenance: boolean;
  signColor: string;
}

export interface TruckPlacement {
  truck: Truck;
  x: number;
  z: number;
  /** Rotation about y; 0 = cab pointing +z. */
  rotation: number;
  where: 'dock' | 'yard' | 'road';
  shipment: Shipment | null;
  accent: string;
}

export interface ForkliftPlacement {
  forklift: Forklift;
  x: number;
  z: number;
  /** Rotation about y; 0 = forks pointing +z. */
  rotation: number;
  accent: string;
  /** Shuttles back and forth along its forks while working. */
  moving: boolean;
  carrying: boolean;
  charging: boolean;
  /** Animation phase offset so units don't move in lockstep. */
  phase: number;
}

export interface ZonePlacement {
  zone: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RackPlacement {
  /** Rack entity id (see rackId). */
  key: string;
  zone: string;
  aisle: number;
  x: number;
  /** Rack runs along z, centred on this. */
  z: number;
  length: number;
}

export interface StockPlacement {
  item: InventoryItem;
  x: number;
  /** Height of the shelf the stock sits on. */
  y: number;
  /** z centre of each filled bay. */
  bayZs: number[];
  bayLength: number;
  low: boolean;
  color: string;
}

export interface ShelvingLayout {
  zones: ZonePlacement[];
  racks: RackPlacement[];
  stock: StockPlacement[];
}

export interface SiteLayout extends ShelvingLayout {
  siteId: SiteId;
  docks: DockPlacement[];
  trucks: TruckPlacement[];
  forklifts: ForkliftPlacement[];
}

/** Box drawn around a selection that has no mesh of its own (instanced racks and stock). */
export interface HighlightBox {
  center: [number, number, number];
  size: [number, number, number];
}

// ── Geometry helpers ───────────────────────────────────────────────────────

export function dockX(dock: Dock, dockCount: number): number {
  return (dock.number - (dockCount + 1) / 2) * DOCK_SPACING;
}

export function zoneRect(zone: string): ZonePlacement {
  const row = zone.charCodeAt(0) - 'A'.charCodeAt(0); // A = back row
  const col = Number(zone.slice(1)) - 1; // 1 = left
  const minX = -HALF_W + ZONE.sideMargin + col * (ZONE.width + ZONE.gapX);
  const minZ = -FRONT_Z + ZONE.backMargin + row * (ZONE.depth + ZONE.gapZ);
  return { zone, minX, maxX: minX + ZONE.width, minZ, maxZ: minZ + ZONE.depth };
}

function aisleX(zone: ZonePlacement, aisle: number): number {
  return zone.minX + RACK.aisleSpacing / 2 + (aisle - 1) * RACK.aisleSpacing;
}

const RACK_LENGTH = ZONE.depth - 2;
const RACK_HEIGHT = RACK.levels * RACK.levelHeight;

// ── Layout ─────────────────────────────────────────────────────────────────

export function layoutDocks(data: WareTrackData, siteId: SiteId): DockPlacement[] {
  const siteDocks = docksAtSite(data, siteId).sort((a, b) => a.number - b.number);
  return siteDocks.map((dock) => {
    const occupiedBy =
      data.trucks.find((t) => t.position.kind === 'dock' && t.position.dockId === dock.id) ?? null;
    return {
      dock,
      x: dockX(dock, siteDocks.length),
      doorWidth: DOOR_WIDTH[dock.maxVehicleClass],
      occupiedBy,
      doorOpen: occupiedBy !== null,
      underMaintenance: dock.status === 'maintenance',
      signColor: DOCK_TYPE_COLOR[dock.type],
    };
  });
}

/**
 * Trucks at a dock back onto the door; trucks in the yard keep a stable slot;
 * trucks travelling to or from the site are drawn on the access road, placed
 * by how far along their trip they are.
 */
export function layoutTrucks(data: WareTrackData, siteId: SiteId, now: IsoDateTime): TruckPlacement[] {
  const siteDocks = docksAtSite(data, siteId);
  const dockById = new Map(siteDocks.map((d) => [d.id, d]));
  const trucks: TruckPlacement[] = [];
  const usedSlots = new Set<number>();

  for (const truck of trucksAtSite(data, siteId)) {
    const shipment = activeShipmentForTruck(data, truck.id) ?? null;
    const accent = TRUCK_STATUS_COLOR[truck.status];
    const { length } = TRUCK_SIZE[truck.vehicleClass];
    if (truck.position.kind === 'dock') {
      const x = dockX(dockById.get(truck.position.dockId)!, siteDocks.length);
      trucks.push({ truck, x, z: FRONT_Z + 0.5 + length / 2, rotation: 0, where: 'dock', shipment, accent });
      continue;
    }
    // Each truck prefers the same slot every time, so the yard doesn't reshuffle.
    let slot = data.trucks.indexOf(truck) % YARD_SLOTS;
    while (usedSlots.has(slot) && usedSlots.size < YARD_SLOTS) slot = (slot + 1) % YARD_SLOTS;
    usedSlots.add(slot);
    trucks.push({
      truck,
      x: YARD_SLOT.firstX + (slot % YARD_SLOT.perRow) * YARD_SLOT.width,
      z: YARD_SLOT.firstZ + Math.floor(slot / YARD_SLOT.perRow) * YARD_SLOT.rowGap + length / 2,
      rotation: 0,
      where: 'yard',
      shipment,
      accent,
    });
  }

  for (const shipment of data.shipments) {
    if (shipment.status !== 'in_transit' || !shipment.truckId) continue;
    const inbound = shipment.destination.kind === 'site' && shipment.destination.siteId === siteId;
    const outbound = shipment.origin.kind === 'site' && shipment.origin.siteId === siteId;
    if (!inbound && !outbound) continue;
    const truck = data.trucks.find((t) => t.id === shipment.truckId);
    if (!truck) continue;
    const progress = transitProgress(shipment, now);
    const { length } = TRUCK_SIZE[truck.vehicleClass];
    const x = inbound
      ? Math.max(ROAD.minX + length, GATE_X - (1 - progress) * APPROACH_SPAN)
      : GATE_X + progress * APPROACH_SPAN;
    if (x > ROAD.maxX - length / 2) continue; // already well down the road
    trucks.push({
      truck,
      x,
      z: ROAD.z - ROAD.width / 4,
      rotation: Math.PI / 2,
      where: 'road',
      shipment,
      accent: TRUCK_STATUS_COLOR[truck.status],
    });
  }
  return trucks;
}

/**
 * Forklifts work the dock they're assigned to, or the aisle of their putaway
 * job; the rest park along the left wall, each in its own bay.
 */
export function layoutForklifts(
  data: WareTrackData,
  siteId: SiteId,
  tasks: SimState['tasks'] = {},
): ForkliftPlacement[] {
  const siteDocks = docksAtSite(data, siteId);
  const dockById = new Map(siteDocks.map((d) => [d.id, d]));
  const perDock = new Map<string, number>();

  return forkliftsAtSite(data, siteId).map((forklift, index) => {
    const look = {
      forklift,
      accent: FORKLIFT_STATUS_COLOR[forklift.status],
      moving: forklift.status === 'active',
      carrying: forklift.status === 'active',
      charging: forklift.status === 'charging',
      phase: index * 1.7,
    };
    const dock = forklift.assignedDockId ? dockById.get(forklift.assignedDockId) : undefined;
    if (dock) {
      const n = perDock.get(dock.id) ?? 0;
      perDock.set(dock.id, n + 1);
      return { ...look, x: dockX(dock, siteDocks.length) + n * 2.2, z: FRONT_Z - 5, rotation: 0 };
    }
    const task: ForkliftTask | undefined = forklift.status === 'active' ? tasks[forklift.id] : undefined;
    const item = task && data.inventory.find((i) => i.id === task.itemId);
    if (item) {
      // At the end of the aisle beside the item's rack, forks pointing in.
      const zone = zoneRect(item.bin.zone);
      return { ...look, x: aisleX(zone, item.bin.aisle) + RACK.aisleSpacing / 2, z: zone.maxZ + 1.5, rotation: Math.PI };
    }
    return { ...look, x: -HALF_W + 3, z: FRONT_Z - 4 - index * 3, rotation: -Math.PI / 2 };
  });
}

/**
 * Racking: every aisle up to the highest one used in each zone, so the floor
 * looks fully racked even where a bin is empty. Stock fills one bay per third
 * of the reorder point, up to a full row of bays.
 */
export function layoutShelving(inventory: InventoryItem[], siteId: SiteId): ShelvingLayout {
  const items = inventoryAtSite({ inventory } as WareTrackData, siteId);
  const maxAisle = new Map<string, number>();
  for (const item of items) {
    maxAisle.set(item.bin.zone, Math.max(maxAisle.get(item.bin.zone) ?? 0, item.bin.aisle));
  }
  const zones = [...maxAisle.keys()].sort().map(zoneRect);
  const zoneByName = new Map(zones.map((z) => [z.zone, z]));
  const bayLength = RACK_LENGTH / RACK.bays;

  const racks: RackPlacement[] = zones.flatMap((zone) =>
    Array.from({ length: maxAisle.get(zone.zone)! }, (_, i) => ({
      key: rackId(siteId, zone.zone, i + 1),
      zone: zone.zone,
      aisle: i + 1,
      x: aisleX(zone, i + 1),
      z: (zone.minZ + zone.maxZ) / 2,
      length: RACK_LENGTH,
    })),
  );

  const stock: StockPlacement[] = items.map((item) => {
    const zone = zoneByName.get(item.bin.zone)!;
    const z0 = (zone.minZ + zone.maxZ) / 2 - RACK_LENGTH / 2;
    const ratio = item.quantity / item.reorderPoint;
    const bays = item.quantity > 0 ? Math.min(RACK.bays, Math.max(1, Math.ceil((ratio / 3) * RACK.bays))) : 0;
    const level = Math.min(item.bin.level, RACK.levels);
    const low = item.quantity <= item.reorderPoint;
    return {
      item,
      x: aisleX(zone, item.bin.aisle),
      y: (level - 1) * RACK.levelHeight + 0.15,
      bayZs: Array.from({ length: bays }, (_, i) => z0 + bayLength * (i + 0.5)),
      bayLength,
      low,
      color: low ? COLORS.cartonLow : COLORS.carton,
    };
  });

  return { zones, racks, stock };
}

export function buildSiteLayout(
  data: WareTrackData,
  siteId: SiteId,
  now: IsoDateTime,
  tasks: SimState['tasks'] = {},
): SiteLayout {
  return {
    siteId,
    docks: layoutDocks(data, siteId),
    trucks: layoutTrucks(data, siteId, now),
    forklifts: layoutForklifts(data, siteId, tasks),
    ...layoutShelving(data.inventory, siteId),
  };
}

/** Outline box for a selected rack or stock item; null for anything else. */
export function highlightBox(shelving: ShelvingLayout, ref: EntityRef | null): HighlightBox | null {
  const pad = 0.25;
  if (ref?.kind === 'rack') {
    const rack = shelving.racks.find((r) => r.key === ref.id);
    if (!rack) return null;
    return { center: [rack.x, RACK_HEIGHT / 2, rack.z], size: [RACK.depth + pad, RACK_HEIGHT + pad, rack.length + pad] };
  }
  if (ref?.kind === 'item') {
    const s = shelving.stock.find((st) => st.item.id === ref.id);
    if (!s) return null;
    const rackZ = (zoneRect(s.item.bin.zone).minZ + zoneRect(s.item.bin.zone).maxZ) / 2;
    const [zMin, zMax] = s.bayZs.length
      ? [s.bayZs[0] - s.bayLength / 2, s.bayZs[s.bayZs.length - 1] + s.bayLength / 2]
      : [rackZ - RACK_LENGTH / 2, rackZ + RACK_LENGTH / 2];
    const height = RACK.levelHeight - 0.2;
    return {
      center: [s.x, s.y + height / 2, (zMin + zMax) / 2],
      size: [RACK.depth + pad, height + pad, zMax - zMin + pad],
    };
  }
  return null;
}
