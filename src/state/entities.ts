import type { DockId, ForkliftId, InventoryItemId, SiteId, TruckId } from '../data';

/**
 * Anything the user can select in the scene. Racks aren't a domain entity;
 * they're identified by site, zone and aisle (see rackId).
 */
export type EntityRef =
  | { kind: 'truck'; id: TruckId }
  | { kind: 'forklift'; id: ForkliftId }
  | { kind: 'dock'; id: DockId }
  | { kind: 'item'; id: InventoryItemId }
  | { kind: 'rack'; id: string };

export type EntityKind = EntityRef['kind'];

/** Stable string key, used for update timestamps and equality. */
export type EntityKey = `${EntityKind}:${string}`;

export function entityKey(ref: EntityRef): EntityKey {
  return `${ref.kind}:${ref.id}`;
}

export function sameEntity(a: EntityRef | null, b: EntityRef | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id;
}

export function rackId(siteId: SiteId, zone: string, aisle: number): string {
  return `${siteId}|${zone}|${aisle}`;
}

export function parseRackId(id: string): { siteId: SiteId; zone: string; aisle: number } {
  const [siteId, zone, aisle] = id.split('|');
  return { siteId: siteId as SiteId, zone, aisle: Number(aisle) };
}
