/**
 * Turns a WareTrackData snapshot into world-space placements for one site.
 * Pure functions only — the React components just draw what this returns.
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

// ── Placement types ────────────────────────────────────────────────────────

export interface DockPlacement {
  dock: Dock;
  x: number;
  doorWidth: number;
  occupiedBy: Truck | null;
}

export interface TruckPlacement {
  truck: Truck;
  x: number;
  z: number;
  /** Rotation about y; 0 = cab pointing +z. */
  rotation: number;
  where: 'dock' | 'yard' | 'road';
  shipment: Shipment | null;
}

export interface ForkliftPlacement {
  forklift: Forklift;
  x: number;
  z: number;
  /** Rotation about y; 0 = forks pointing +z. */
  rotation: number;
}

export interface ZonePlacement {
  zone: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RackPlacement {
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
}

export interface SiteLayout {
  siteId: SiteId;
  docks: DockPlacement[];
  trucks: TruckPlacement[];
  forklifts: ForkliftPlacement[];
  zones: ZonePlacement[];
  racks: RackPlacement[];
  stock: StockPlacement[];
}

// ── Layout ─────────────────────────────────────────────────────────────────

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

export function buildSiteLayout(data: WareTrackData, siteId: SiteId, now: IsoDateTime): SiteLayout {
  const siteDocks = docksAtSite(data, siteId).sort((a, b) => a.number - b.number);
  const dockById = new Map(siteDocks.map((d) => [d.id, d]));
  const onSite = trucksAtSite(data, siteId);

  const docks: DockPlacement[] = siteDocks.map((dock) => ({
    dock,
    x: dockX(dock, siteDocks.length),
    doorWidth: DOOR_WIDTH[dock.maxVehicleClass],
    occupiedBy:
      onSite.find((t) => t.position.kind === 'dock' && t.position.dockId === dock.id) ?? null,
  }));

  // Trucks at a dock back onto the door; trucks in the yard fill slots in order.
  const trucks: TruckPlacement[] = [];
  let yardSlot = 0;
  for (const truck of onSite) {
    const shipment = activeShipmentForTruck(data, truck.id) ?? null;
    const { length } = TRUCK_SIZE[truck.vehicleClass];
    if (truck.position.kind === 'dock') {
      const dock = dockById.get(truck.position.dockId)!;
      const x = dockX(dock, siteDocks.length);
      trucks.push({ truck, x, z: FRONT_Z + 0.5 + length / 2, rotation: 0, where: 'dock', shipment });
    } else {
      const col = yardSlot % YARD_SLOT.perRow;
      const row = Math.floor(yardSlot / YARD_SLOT.perRow);
      yardSlot++;
      trucks.push({
        truck,
        x: YARD_SLOT.firstX + col * YARD_SLOT.width,
        z: YARD_SLOT.firstZ + row * YARD_SLOT.rowGap + length / 2,
        rotation: 0,
        where: 'yard',
        shipment,
      });
    }
  }

  // Trucks on their way here are drawn on the access road, closer to the gate
  // the further along their trip they are.
  for (const shipment of data.shipments) {
    if (shipment.status !== 'in_transit' || !shipment.truckId) continue;
    if (shipment.destination.kind !== 'site' || shipment.destination.siteId !== siteId) continue;
    const truck = data.trucks.find((t) => t.id === shipment.truckId);
    if (!truck) continue;
    const remaining = 1 - transitProgress(shipment, now);
    const { length } = TRUCK_SIZE[truck.vehicleClass];
    const x = Math.max(ROAD.minX + length, GATE_X - remaining * APPROACH_SPAN);
    trucks.push({ truck, x, z: ROAD.z - ROAD.width / 4, rotation: Math.PI / 2, where: 'road', shipment });
  }

  // Forklifts work the dock they're assigned to; the rest park along the left wall.
  const forklifts: ForkliftPlacement[] = [];
  const perDock = new Map<string, number>();
  let parked = 0;
  for (const forklift of forkliftsAtSite(data, siteId)) {
    const dock = forklift.assignedDockId ? dockById.get(forklift.assignedDockId) : undefined;
    if (dock) {
      const n = perDock.get(dock.id) ?? 0;
      perDock.set(dock.id, n + 1);
      forklifts.push({ forklift, x: dockX(dock, siteDocks.length) + n * 2.2, z: FRONT_Z - 5, rotation: 0 });
    } else {
      forklifts.push({ forklift, x: -HALF_W + 3, z: FRONT_Z - 4 - parked * 3, rotation: -Math.PI / 2 });
      parked++;
    }
  }

  // Racking: every aisle up to the highest one used in each zone, so the
  // floor looks fully racked even where a bin is empty.
  const items = inventoryAtSite(data, siteId);
  const maxAisle = new Map<string, number>();
  for (const item of items) {
    maxAisle.set(item.bin.zone, Math.max(maxAisle.get(item.bin.zone) ?? 0, item.bin.aisle));
  }
  const zones = [...maxAisle.keys()].sort().map(zoneRect);
  const zoneByName = new Map(zones.map((z) => [z.zone, z]));
  const rackLength = ZONE.depth - 2;
  const bayLength = rackLength / RACK.bays;

  const racks: RackPlacement[] = zones.flatMap((zone) =>
    Array.from({ length: maxAisle.get(zone.zone)! }, (_, i) => ({
      key: `${zone.zone}-${i + 1}`,
      zone: zone.zone,
      aisle: i + 1,
      x: aisleX(zone, i + 1),
      z: (zone.minZ + zone.maxZ) / 2,
      length: rackLength,
    })),
  );

  const stock: StockPlacement[] = items.map((item) => {
    const zone = zoneByName.get(item.bin.zone)!;
    const z0 = (zone.minZ + zone.maxZ) / 2 - rackLength / 2;
    // A row of bays is full at 3× the reorder point; at least one bay if any stock.
    const ratio = item.quantity / item.reorderPoint;
    const bays = item.quantity > 0 ? Math.min(RACK.bays, Math.max(1, Math.ceil((ratio / 3) * RACK.bays))) : 0;
    const level = Math.min(item.bin.level, RACK.levels);
    return {
      item,
      x: aisleX(zone, item.bin.aisle),
      y: (level - 1) * RACK.levelHeight + 0.15,
      bayZs: Array.from({ length: bays }, (_, i) => z0 + bayLength * (i + 0.5)),
      bayLength,
      low: item.quantity <= item.reorderPoint,
    };
  });

  return { siteId, docks, trucks, forklifts, zones, racks, stock };
}
