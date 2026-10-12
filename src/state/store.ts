import { create } from 'zustand';
import { SEED_NOW, seedData, type IsoDateTime, type SiteId, type WareTrackData } from '../data';
import { advance, createRng, INITIAL_SIM_STATE, TICK_MS, type SimState } from '../sim/simulation';
import { sameEntity, type EntityKey, type EntityRef } from './entities';

export interface LiveState {
  /** Current snapshot; replaced (never mutated) on every tick. */
  data: WareTrackData;
  /** Simulated clock. */
  now: IsoDateTime;
  sim: SimState;
  /** When each entity last changed; entities not listed haven't changed since SEED_NOW. */
  updatedAt: Partial<Record<EntityKey, IsoDateTime>>;
  siteId: SiteId;
  selection: EntityRef | null;

  tick: () => void;
  select: (ref: EntityRef | null) => void;
  setSite: (siteId: SiteId) => void;
}

const rng = createRng(2026);

export const useLiveStore = create<LiveState>()((set, get) => ({
  data: seedData,
  now: SEED_NOW,
  sim: INITIAL_SIM_STATE,
  updatedAt: {},
  siteId: seedData.sites[0].id,
  selection: null,

  tick: () => {
    const { data, sim, now, updatedAt } = get();
    const result = advance(data, sim, now, rng);
    const stamped = { ...updatedAt };
    for (const key of result.changed) stamped[key] = result.now;
    set({ data: result.data, sim: result.sim, now: result.now, updatedAt: stamped });
  },

  select: (ref) => {
    if (!sameEntity(ref, get().selection)) set({ selection: ref });
  },

  setSite: (siteId) => set({ siteId, selection: null }),
}));

/** Ticks the simulation every TICK_MS; returns a stop function. */
export function startSimulation(): () => void {
  const id = setInterval(() => useLiveStore.getState().tick(), TICK_MS);
  return () => clearInterval(id);
}

export function lastUpdated(state: Pick<LiveState, 'updatedAt'>, key: EntityKey): IsoDateTime {
  return state.updatedAt[key] ?? SEED_NOW;
}
