/** Scene filters: which trucks stay fully visible. Others are ghosted. */
import { activeShipmentForTruck, type SiteId, type Truck, type TruckStatus, type WareTrackData } from '../data';
import type { TruckPlacement } from '../scene/layout';
import { TRUCK_STATE, type StateBadge } from './details';
import { delayedShipmentOf, minutesLate } from './ops';

export interface TruckFilters {
  /** Only trucks carrying a shipment that's running late. */
  delayedOnly: boolean;
  /** Only trucks in this status. */
  status: TruckStatus | 'all';
}

export const NO_FILTERS: TruckFilters = { delayedOnly: false, status: 'all' };

export function filtersActive(f: TruckFilters): boolean {
  return f.delayedOnly || f.status !== 'all';
}

export function truckMatches(data: WareTrackData, truck: Truck, f: TruckFilters): boolean {
  if (f.status !== 'all' && truck.status !== f.status) return false;
  if (f.delayedOnly && !delayedShipmentOf(data, truck)) return false;
  return true;
}

export interface FilterResult {
  truckId: Truck['id'];
  state: StateBadge;
  /** Where to send the camera when the row is picked. */
  siteId: SiteId;
  location: string;
  shipmentId: string | null;
  /** Minutes late, when the truck carries a delayed shipment. */
  minutesLate: number | null;
  lateLabel: string | null;
}

/**
 * Trucks matching the filters, most delayed first. `placements` says where
 * each truck is drawn; trucks out of view are attributed to the site they're
 * heading for (or coming from).
 */
export function filterResults(data: WareTrackData, placements: TruckPlacement[], f: TruckFilters): FilterResult[] {
  if (!filtersActive(f)) return [];
  const drawn = new Map(placements.map((p) => [p.truck.id, p]));
  const codes = new Map(data.sites.map((s) => [s.id, s.code]));
  return data.trucks
    .filter((t) => truckMatches(data, t, f))
    .map((truck): FilterResult => {
      const delayed = delayedShipmentOf(data, truck);
      const shipment = delayed ?? activeShipmentForTruck(data, truck.id) ?? null;
      const placement = drawn.get(truck.id);
      const offMapSite =
        shipment?.destination.kind === 'site'
          ? shipment.destination.siteId
          : shipment?.origin.kind === 'site'
            ? shipment.origin.siteId
            : truck.homeSiteId;
      const siteId = placement?.siteId ?? offMapSite;
      const where = placement?.where ?? 'road';
      return {
        truckId: truck.id,
        state: TRUCK_STATE[truck.status],
        siteId,
        location: where === 'road' ? (placement ? `Road near ${codes.get(siteId)}` : 'On the road') : `${codes.get(siteId)} ${where}`,
        shipmentId: shipment?.id ?? null,
        minutesLate: delayed ? minutesLate(delayed) : null,
        lateLabel: delayed ? `+${minutesLate(delayed)} min` : null,
      };
    })
    .sort((a, b) => (b.minutesLate ?? -1) - (a.minutesLate ?? -1));
}

export interface StatusOption {
  value: TruckFilters['status'];
  label: string;
  count: number;
}

/** Status filter choices with how many trucks are in each right now. */
export function statusOptions(data: WareTrackData): StatusOption[] {
  const counts: Record<Truck['status'], number> = { loading: 0, unloading: 0, in_transit: 0, idle: 0, maintenance: 0 };
  for (const t of data.trucks) counts[t.status]++;
  return [
    { value: 'all', label: 'All', count: data.trucks.length },
    ...(Object.keys(counts) as Truck['status'][]).map((status) => ({
      value: status,
      label: TRUCK_STATE[status].label,
      count: counts[status],
    })),
  ];
}
