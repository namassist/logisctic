import { formatTime } from '../state/format';
import { BUILDING, FRONT_Z, RACK, TRUCK_SIZE, type SiteLayout } from './layout';
import { COLORS } from './palette';

export interface SceneLabel {
  key: string;
  /** World-space anchor; the label is centred on its screen projection. */
  position: [number, number, number];
  text: string;
  meta?: string;
  dot?: string;
  variant: 'tag' | 'sign';
}

/** Screen-space labels for docks, racking zones and trucks. */
export function buildLabels(layout: SiteLayout): SceneLabel[] {
  const docks = layout.docks.map(({ dock, x, underMaintenance, signColor }): SceneLabel => ({
    key: dock.id,
    position: [x, BUILDING.wallHeight + 1.4, FRONT_Z],
    text: String(dock.number).padStart(2, '0'),
    dot: underMaintenance ? COLORS.hazard : signColor,
    variant: 'sign',
  }));

  const zones = layout.zones.map((z): SceneLabel => ({
    key: `zone-${z.zone}`,
    position: [z.minX + 1.5, RACK.levels * RACK.levelHeight + 1, z.maxZ],
    text: z.zone,
    variant: 'sign',
  }));

  const trucks = layout.trucks.map(({ truck, x, z, where, shipment, accent }): SceneLabel => ({
    key: truck.id,
    position: [x, TRUCK_SIZE[truck.vehicleClass].height + 1.6, z],
    text: truck.id,
    meta: where === 'road' && shipment ? `ETA ${formatTime(shipment.eta)}` : undefined,
    dot: accent,
    variant: 'tag',
  }));

  return [...docks, ...zones, ...trucks];
}
