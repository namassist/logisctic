/**
 * Memoised selectors over the live store. Each derived value is recomputed
 * only when its inputs change identity, and every subscriber gets the same
 * object, so components re-render only when what they show has changed.
 */
import { SEED_NOW, type SiteId } from '../data';
import { buildLabels } from '../scene/labels';
import {
  highlightBox,
  highwayExtent,
  layoutAllForklifts,
  layoutDocks,
  layoutShelving,
  layoutTrucks,
  siteOrigins,
  type HighlightBox,
  type SiteScene,
  type TruckPlacement,
  type WorldLayout,
} from '../scene/layout';
import { buildEntityDetails } from './details';
import { filterResults, filtersActive, statusOptions, truckMatches, type TruckFilters } from './filters';
import { computeSiteKpis, kpiView } from './kpis';
import { delayedShipments } from './ops';
import type { LiveState } from './store';

/** Caches the last result and returns it while the arguments are identical. */
function memoLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | undefined;
  let last!: R;
  return (...args: A) => {
    if (lastArgs && args.length === lastArgs.length && args.every((arg, i) => Object.is(arg, lastArgs![i]))) return last;
    lastArgs = args;
    last = fn(...args);
    return last;
  };
}

/** One memo per site, so a change at one site doesn't rebuild the others. */
function memoPerSite<A extends unknown[], R>(fn: (...args: A) => R) {
  const memos = new Map<SiteId, (...args: A) => R>();
  return (siteId: SiteId, ...args: A): R => {
    let memo = memos.get(siteId);
    if (!memo) memos.set(siteId, (memo = memoLast(fn)));
    return memo(...args);
  };
}

// ── World layout ───────────────────────────────────────────────────────────

const originsFor = memoLast(siteOrigins);
const highwayFor = memoLast(highwayExtent);
const shelvingFor = memoPerSite(layoutShelving);
const docksFor = memoPerSite(layoutDocks);
const siteSceneFor = memoPerSite(
  (siteId: SiteId, originX: number, docks: SiteScene['docks'], shelving: ReturnType<typeof layoutShelving>): SiteScene => ({
    siteId,
    originX,
    docks,
    ...shelving,
  }),
);
const sitesFor = memoLast((...scenes: SiteScene[]) => scenes);
const trucksFor = memoLast(layoutTrucks);
const forkliftsFor = memoLast(layoutAllForklifts);

/** Fade out trucks the filters exclude. */
const filteredTrucksFor = memoLast((trucks: TruckPlacement[], data: LiveState['data'], filters: TruckFilters) =>
  filtersActive(filters) ? trucks.map((p) => ({ ...p, dimmed: !truckMatches(data, p.truck, filters) })) : trucks,
);
const worldFor = memoLast(
  (sites: SiteScene[], trucks: TruckPlacement[], forklifts: WorldLayout['forklifts'], highway: WorldLayout['highway']): WorldLayout => ({
    sites,
    trucks,
    forklifts,
    highway,
  }),
);

export function selectWorldLayout(s: LiveState): WorldLayout {
  const { data } = s;
  const origins = originsFor(data.sites);
  const sites = sitesFor(
    ...data.sites.map((site) =>
      siteSceneFor(
        site.id,
        site.id,
        origins.get(site.id)!,
        docksFor(site.id, data, site.id),
        shelvingFor(site.id, data.inventory, site.id),
      ),
    ),
  );
  const trucks = filteredTrucksFor(trucksFor(data, s.now, origins), data, s.filters);
  return worldFor(sites, trucks, forkliftsFor(data, s.sim.tasks, origins), highwayFor(origins));
}

const labelsFor = memoLast(buildLabels);
export const selectLabels = (s: LiveState) => labelsFor(selectWorldLayout(s));

/** World x of the selected site, where the camera should be. */
export const selectFocusX = (s: LiveState) => originsFor(s.data.sites).get(s.siteId)!;

const highlightFor = memoLast((sites: SiteScene[], selection: LiveState['selection']): HighlightBox | null => {
  for (const site of sites) {
    const box = highlightBox(site, selection);
    if (box) return { ...box, center: [box.center[0] + site.originX, box.center[1], box.center[2]] };
  }
  return null;
});
export const selectHighlight = (s: LiveState) => highlightFor(selectWorldLayout(s).sites, s.selection);

// ── Panels ─────────────────────────────────────────────────────────────────

const detailsFor = memoLast((data: LiveState['data'], now: LiveState['now'], sim: LiveState['sim'], updatedAt: LiveState['updatedAt'], selection: LiveState['selection']) =>
  selection ? buildEntityDetails({ data, now, sim, updatedAt, since: SEED_NOW }, selection) : null,
);
export const selectDetails = (s: LiveState) => detailsFor(s.data, s.now, s.sim, s.updatedAt, s.selection);

const kpisFor = memoLast((data: LiveState['data'], siteId: SiteId, now: LiveState['now']) => kpiView(computeSiteKpis(data, siteId, now)));
export const selectSiteKpis = (s: LiveState) => kpisFor(s.data, s.siteId, s.now);

const resultsFor = memoLast(filterResults);
export const selectFilterResults = (s: LiveState) => resultsFor(s.data, selectWorldLayout(s).trucks, s.filters);

const statusOptionsFor = memoLast(statusOptions);
export const selectStatusOptions = (s: LiveState) => statusOptionsFor(s.data);

const delayedCountFor = memoLast((data: LiveState['data']) => delayedShipments(data).length);
export const selectDelayedCount = (s: LiveState) => delayedCountFor(s.data);
