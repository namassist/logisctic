import type { WareTrackData } from './types';
import { docks, sites } from './seed/sites';
import { trucks } from './seed/trucks';
import { forklifts } from './seed/forklifts';
import { inventory } from './seed/inventory';
import { shipments } from './seed/shipments';

export * from './types';
export * from './relations';
export { validateData } from './validate';
export { SEED_NOW } from './seed/clock';

export const seedData: WareTrackData = { sites, docks, trucks, forklifts, inventory, shipments };
