import { formatTime } from '../state/format';
import { BUILDING, FRONT_Z, RACK, TRUCK_SIZE, type WorldLayout } from './layout';
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

/** Screen-space labels for docks, racking zones and (unfiltered) trucks, in world coordinates. */
export function buildLabels(world: WorldLayout): SceneLabel[] {
  const siteLabels = world.sites.flatMap((site) => [
    ...site.docks.map(({ dock, x, underMaintenance, signColor }): SceneLabel => ({
      key: dock.id,
      position: [site.originX + x, BUILDING.wallHeight + 1.4, FRONT_Z],
      text: String(dock.number).padStart(2, '0'),
      dot: underMaintenance ? COLORS.hazard : signColor,
      variant: 'sign',
    })),
    ...site.zones.map((z): SceneLabel => ({
      key: `${site.siteId}-zone-${z.zone}`,
      position: [site.originX + z.minX + 1.5, RACK.levels * RACK.levelHeight + 1, z.maxZ],
      text: z.zone,
      variant: 'sign',
    })),
  ]);

  const trucks = world.trucks
    .filter((p) => !p.dimmed)
    .map(({ truck, x, z, where, shipment, accent }): SceneLabel => ({
      key: truck.id,
      position: [x, TRUCK_SIZE[truck.vehicleClass].height + 1.6, z],
      text: truck.id,
      meta: where === 'road' && shipment ? `ETA ${formatTime(shipment.eta)}` : undefined,
      dot: accent,
      variant: 'tag',
    }));

  return [...siteLabels, ...trucks];
}
