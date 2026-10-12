/**
 * Site KPIs, computed from the live snapshot. Definitions:
 * - On-time delivery: shipments to or from the site that arrived in the last
 *   24 h, on time if within ON_TIME_GRACE_MIN of the planned ETA.
 * - Docks in use: docks with a truck at them, out of operational docks.
 * - Active trucks: trucks based at the site that are loading, unloading or
 *   on the road, out of the site's fleet.
 * - Low-stock alerts: SKUs at the site at or below their reorder point.
 */
import type { InventoryItem, IsoDateTime, SiteId, WareTrackData } from '../data';
import type { Tone } from './details';
import { formatNumber } from './format';
import { isLate, ON_TIME_GRACE_MIN } from './ops';

const WINDOW_MS = 24 * 3_600_000;

export interface SiteKpis {
  onTime: { rate: number | null; onTime: number; delivered: number };
  docks: { inUse: number; operational: number; maintenance: number };
  trucks: { active: number; fleet: number; idle: number; maintenance: number };
  lowStock: { count: number; outOfStock: number; items: InventoryItem[] };
}

export function computeSiteKpis(data: WareTrackData, siteId: SiteId, now: IsoDateTime): SiteKpis {
  const nowMs = Date.parse(now);
  const touchesSite = (stop: { kind: string; siteId?: SiteId }) => stop.kind === 'site' && stop.siteId === siteId;

  const delivered = data.shipments.filter((s) => {
    if (!s.arrivedAt || !(touchesSite(s.origin) || touchesSite(s.destination))) return false;
    const age = nowMs - Date.parse(s.arrivedAt);
    return age >= 0 && age <= WINDOW_MS;
  });
  const onTime = delivered.filter((s) => !isLate(s)).length;

  const docks = data.docks.filter((d) => d.siteId === siteId);
  const occupied = new Set(data.trucks.flatMap((t) => (t.position.kind === 'dock' ? [t.position.dockId] : [])));
  const operational = docks.filter((d) => d.status === 'operational');

  const fleet = data.trucks.filter((t) => t.homeSiteId === siteId);
  const active = fleet.filter((t) => t.status === 'loading' || t.status === 'unloading' || t.status === 'in_transit');

  const low = data.inventory
    .filter((i) => i.siteId === siteId && i.quantity <= i.reorderPoint)
    .sort((a, b) => a.quantity / a.reorderPoint - b.quantity / b.reorderPoint);

  return {
    onTime: { rate: delivered.length ? onTime / delivered.length : null, onTime, delivered: delivered.length },
    docks: {
      inUse: operational.filter((d) => occupied.has(d.id)).length,
      operational: operational.length,
      maintenance: docks.length - operational.length,
    },
    trucks: {
      active: active.length,
      fleet: fleet.length,
      idle: fleet.filter((t) => t.status === 'idle').length,
      maintenance: fleet.filter((t) => t.status === 'maintenance').length,
    },
    lowStock: { count: low.length, outOfStock: low.filter((i) => i.quantity === 0).length, items: low },
  };
}

// ── Display ────────────────────────────────────────────────────────────────

export interface KpiCard {
  id: 'onTime' | 'docks' | 'trucks' | 'lowStock';
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  /** 0–1 fill for the card's meter, if it has one. */
  meter: number | null;
  /** How the number is defined (tooltip). */
  definition: string;
}

export interface LowStockRow {
  itemId: InventoryItem['id'];
  name: string;
  level: string;
  tone: Tone;
}

export interface KpiView {
  cards: KpiCard[];
  lowStock: LowStockRow[];
}

const UNIT_SHORT: Record<InventoryItem['unit'], string> = {
  carton: 'ctn',
  bag: 'bags',
  piece: 'pcs',
  roll: 'rolls',
  set: 'sets',
  pail: 'pails',
  bundle: 'bdl',
};

export function kpiView(k: SiteKpis): KpiView {
  const rate = k.onTime.rate;
  return {
    cards: [
      {
        id: 'onTime',
        label: 'On-time delivery',
        value: rate === null ? '—' : `${Math.round(rate * 100)}%`,
        detail: k.onTime.delivered ? `${k.onTime.onTime} of ${k.onTime.delivered} in last 24 h` : 'No deliveries in last 24 h',
        tone: rate === null ? 'gray' : rate >= 0.9 ? 'green' : rate >= 0.75 ? 'amber' : 'red',
        meter: rate,
        definition: `Shipments to or from this site that arrived in the last 24 h within ${ON_TIME_GRACE_MIN} min of their planned ETA.`,
      },
      {
        id: 'docks',
        label: 'Docks in use',
        value: `${k.docks.inUse} / ${k.docks.operational}`,
        detail: k.docks.maintenance ? `${k.docks.maintenance} under maintenance` : 'All docks operational',
        tone: 'amber',
        meter: k.docks.operational ? k.docks.inUse / k.docks.operational : 0,
        definition: 'Docks with a truck at them, out of docks not under maintenance.',
      },
      {
        id: 'trucks',
        label: 'Active trucks',
        value: `${k.trucks.active} / ${k.trucks.fleet}`,
        detail: [`${k.trucks.idle} idle`, k.trucks.maintenance ? `${k.trucks.maintenance} in maintenance` : null]
          .filter(Boolean)
          .join(' · '),
        tone: 'amber',
        meter: k.trucks.fleet ? k.trucks.active / k.trucks.fleet : 0,
        definition: 'Trucks based at this site that are loading, unloading or on the road.',
      },
      {
        id: 'lowStock',
        label: 'Low-stock alerts',
        value: String(k.lowStock.count),
        detail: k.lowStock.count
          ? k.lowStock.outOfStock
            ? `${k.lowStock.outOfStock} out of stock`
            : 'At or below reorder point'
          : 'All SKUs above reorder point',
        tone: k.lowStock.outOfStock ? 'red' : k.lowStock.count ? 'amber' : 'green',
        meter: null,
        definition: 'SKUs at this site at or below their reorder point.',
      },
    ],
    lowStock: k.lowStock.items.map((i) => ({
      itemId: i.id,
      name: i.name,
      level: `${formatNumber(i.quantity)} / ${formatNumber(i.reorderPoint)} ${UNIT_SHORT[i.unit]}`,
      tone: i.quantity === 0 ? 'red' : 'amber',
    })),
  };
}
