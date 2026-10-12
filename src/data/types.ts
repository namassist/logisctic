/**
 * WareTrack domain model.
 *
 * Every relation is stored once, as a foreign key on the "child" record
 * (Dock.siteId, Truck.position.dockId, Shipment.truckId, ...). Reverse lookups
 * such as "which truck is at this dock" are derived in `relations.ts`, so the
 * data can never disagree with itself.
 */

// ---------------------------------------------------------------------------
// IDs — template-literal types so a TruckId can't be passed where a DockId is
// expected.
// ---------------------------------------------------------------------------

export type SiteId = `SITE-${string}`;
export type DockId = `DOCK-${string}`;
export type TruckId = `TRK-${string}`;
export type ForkliftId = `FLT-${string}`;
export type InventoryItemId = `INV-${string}`;
export type ShipmentId = `SHP-${string}`;

/** ISO-8601 timestamp with offset, e.g. "2026-10-12T16:42:00+07:00". */
export type IsoDateTime = string;

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Ordered smallest → largest; a dock accepts its class and anything smaller. */
export type VehicleClass = 'light' | 'medium' | 'heavy';

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export interface Site {
  id: SiteId;
  /** Short code shown on maps and badges, e.g. "WH-A". */
  code: string;
  name: string;
  city: string;
  address: string;
  coordinates: Coordinates;
  /** IANA time zone used to display local times. */
  timezone: string;
  /** Total racking capacity, used for utilization figures. */
  palletCapacity: number;
}

// ---------------------------------------------------------------------------
// Dock — belongs to exactly one Site.
// ---------------------------------------------------------------------------

export type DockType = 'inbound' | 'outbound' | 'flex';
export type DockStatus = 'operational' | 'maintenance';

export interface Dock {
  id: DockId;
  siteId: SiteId;
  /** 1-based number painted on the door, e.g. 3 → "Dock 03". */
  number: number;
  type: DockType;
  /** Largest vehicle class the leveler and door can take. */
  maxVehicleClass: VehicleClass;
  status: DockStatus;
}

// ---------------------------------------------------------------------------
// Truck — has a home Site and is at a dock, in a yard, or on the road.
// ---------------------------------------------------------------------------

export type TruckStatus =
  | 'idle'
  | 'loading'
  | 'unloading'
  | 'in_transit'
  | 'maintenance';

export type TruckPosition =
  | { kind: 'dock'; dockId: DockId }
  | { kind: 'yard'; siteId: SiteId }
  | { kind: 'road'; coordinates: Coordinates; updatedAt: IsoDateTime };

export interface Driver {
  name: string;
  phone: string;
}

export interface Truck {
  id: TruckId;
  plateNumber: string;
  model: string;
  vehicleClass: VehicleClass;
  payloadKg: number;
  palletCapacity: number;
  homeSiteId: SiteId;
  status: TruckStatus;
  position: TruckPosition;
  driver: Driver | null;
}

// ---------------------------------------------------------------------------
// Forklift — belongs to one Site, optionally working a Dock at that Site.
// ---------------------------------------------------------------------------

export type ForkliftStatus = 'active' | 'idle' | 'charging' | 'maintenance';
export type PowerSource = 'electric' | 'diesel';

export interface Forklift {
  id: ForkliftId;
  siteId: SiteId;
  model: string;
  power: PowerSource;
  liftCapacityKg: number;
  status: ForkliftStatus;
  /** 0–100 for electric units, null for diesel. */
  batteryPct: number | null;
  operatorName: string | null;
  /** Dock the forklift is currently serving; must be at the same site. */
  assignedDockId: DockId | null;
}

// ---------------------------------------------------------------------------
// InventoryItem — stock of one SKU at one Site. The same SKU can appear at
// several sites as separate records.
// ---------------------------------------------------------------------------

export type InventoryCategory =
  | 'food_beverage'
  | 'household'
  | 'personal_care'
  | 'electronics'
  | 'auto_parts'
  | 'building_materials';

export type StockUnit = 'carton' | 'bag' | 'piece' | 'roll' | 'set' | 'pail' | 'bundle';

export interface BinLocation {
  /** Racking zone as labelled on the floor, e.g. "A1", "B2". */
  zone: string;
  aisle: number;
  level: number;
}

export interface InventoryItem {
  id: InventoryItemId;
  sku: string;
  name: string;
  category: InventoryCategory;
  siteId: SiteId;
  bin: BinLocation;
  quantity: number;
  unit: StockUnit;
  unitWeightKg: number;
  /** Replenish when quantity falls to or below this. */
  reorderPoint: number;
}

// ---------------------------------------------------------------------------
// Shipment — moves inventory lines on a truck between two stops.
// The direction decides which stops are our sites and which are external,
// so an "outbound shipment from a supplier" can't be represented.
// ---------------------------------------------------------------------------

export type ShipmentStatus =
  | 'scheduled'
  | 'loading'
  | 'in_transit'
  | 'arrived'
  | 'unloading'
  | 'completed'
  | 'cancelled';

/** One of our own sites. dockId is null until a dock is assigned. */
export interface SiteStop {
  kind: 'site';
  siteId: SiteId;
  dockId: DockId | null;
}

/** A customer or supplier outside the network. */
export interface ExternalStop {
  kind: 'external';
  name: string;
  city: string;
  coordinates: Coordinates;
}

export interface ShipmentLine {
  /**
   * The stock record this line moves. It lives at the origin site for
   * outbound and transfer shipments, and at the destination site for inbound.
   */
  itemId: InventoryItemId;
  quantity: number;
}

interface ShipmentBase {
  id: ShipmentId;
  status: ShipmentStatus;
  /** null while no truck is assigned yet. */
  truckId: TruckId | null;
  lines: ShipmentLine[];
  scheduledDeparture: IsoDateTime;
  departedAt: IsoDateTime | null;
  /** ETA committed when the shipment was planned. */
  plannedEta: IsoDateTime;
  /** Latest estimate; compare with plannedEta to get the delay. */
  eta: IsoDateTime;
  arrivedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  notes?: string;
}

export interface OutboundShipment extends ShipmentBase {
  direction: 'outbound';
  origin: SiteStop;
  destination: ExternalStop;
}

export interface InboundShipment extends ShipmentBase {
  direction: 'inbound';
  origin: ExternalStop;
  destination: SiteStop;
}

export interface TransferShipment extends ShipmentBase {
  direction: 'transfer';
  origin: SiteStop;
  destination: SiteStop;
}

export type Shipment = OutboundShipment | InboundShipment | TransferShipment;
export type ShipmentDirection = Shipment['direction'];

// ---------------------------------------------------------------------------
// Whole dataset
// ---------------------------------------------------------------------------

export interface WareTrackData {
  sites: Site[];
  docks: Dock[];
  trucks: Truck[];
  forklifts: Forklift[];
  inventory: InventoryItem[];
  shipments: Shipment[];
}
