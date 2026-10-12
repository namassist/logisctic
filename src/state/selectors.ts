/**
 * Memoised selectors over the live store. Each derived value is recomputed
 * only when its inputs change identity, and every subscriber gets the same
 * object, so components re-render only when what they show has changed.
 */
import { SEED_NOW } from '../data';
import { buildLabels } from '../scene/labels';
import {
  highlightBox,
  layoutDocks,
  layoutForklifts,
  layoutShelving,
  layoutTrucks,
  type SiteLayout,
} from '../scene/layout';
import { buildEntityDetails } from './details';
import type { LiveState } from './store';

/** Caches the last result and returns it while the arguments are identical. */
function memoLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | undefined;
  let last!: R;
  return (...args: A) => {
    if (lastArgs && args.every((arg, i) => Object.is(arg, lastArgs![i]))) return last;
    lastArgs = args;
    last = fn(...args);
    return last;
  };
}

const docksFor = memoLast(layoutDocks);
const trucksFor = memoLast(layoutTrucks);
const forkliftsFor = memoLast(layoutForklifts);
const shelvingFor = memoLast(layoutShelving);
const combine = memoLast(
  (siteId: SiteLayout['siteId'], docks: SiteLayout['docks'], trucks: SiteLayout['trucks'], forklifts: SiteLayout['forklifts'], shelving: ReturnType<typeof layoutShelving>): SiteLayout => ({
    siteId,
    docks,
    trucks,
    forklifts,
    ...shelving,
  }),
);

export function selectSiteLayout(s: LiveState): SiteLayout {
  return combine(
    s.siteId,
    docksFor(s.data, s.siteId),
    trucksFor(s.data, s.siteId, s.now),
    forkliftsFor(s.data, s.siteId, s.sim.tasks),
    shelvingFor(s.data.inventory, s.siteId),
  );
}

const labelsFor = memoLast(buildLabels);
export const selectLabels = (s: LiveState) => labelsFor(selectSiteLayout(s));

const highlightFor = memoLast(highlightBox);
export const selectHighlight = (s: LiveState) => highlightFor(shelvingFor(s.data.inventory, s.siteId), s.selection);

const detailsFor = memoLast((data: LiveState['data'], now: LiveState['now'], sim: LiveState['sim'], updatedAt: LiveState['updatedAt'], selection: LiveState['selection']) =>
  selection ? buildEntityDetails({ data, now, sim, updatedAt, since: SEED_NOW }, selection) : null,
);
export const selectDetails = (s: LiveState) => detailsFor(s.data, s.now, s.sim, s.updatedAt, s.selection);

const statsFor = memoLast((layout: SiteLayout) => {
  const operational = layout.docks.filter((d) => !d.underMaintenance).length;
  return [
    ['Docks in use', `${layout.docks.filter((d) => d.doorOpen).length} / ${operational}`],
    ['Trucks on site', String(layout.trucks.filter((t) => t.where !== 'road').length)],
    ['On the access road', String(layout.trucks.filter((t) => t.where === 'road').length)],
    ['Forklifts active', `${layout.forklifts.filter((f) => f.forklift.status === 'active').length} / ${layout.forklifts.length}`],
    ['Low-stock SKUs', String(layout.stock.filter((s) => s.low).length)],
  ] as const;
});
export const selectSiteStats = (s: LiveState) => statsFor(selectSiteLayout(s));
