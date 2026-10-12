import { useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { seedData } from './data';
import type { FilterResult } from './state/filters';
import { formatClock } from './state/format';
import {
  selectDelayedCount,
  selectDetails,
  selectFilterResults,
  selectFocusX,
  selectHighlight,
  selectLabels,
  selectSiteKpis,
  selectStatusOptions,
  selectWorldLayout,
} from './state/selectors';
import { startSimulation, useLiveStore } from './state/store';
import { LabelLayer, LabelProjector, type LabelElements } from './scene/LabelLayer';
import { COLORS, DOCK_TYPE_COLOR, FORKLIFT_STATUS_COLOR, TRUCK_STATUS_COLOR } from './scene/palette';
import { CAMERA, StrategyCamera, cameraPosition, siteStartTarget } from './scene/StrategyCamera';
import { WarehouseScene } from './scene/WarehouseScene';
import { FilterPanel } from './ui/FilterPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { KpiPanel } from './ui/KpiPanel';
import { StatusBar } from './ui/StatusBar';
import { TopBar } from './ui/TopBar';

const LEGEND: [label: string, color: string][] = [
  ['Truck active', TRUCK_STATUS_COLOR.loading],
  ['Truck idle', TRUCK_STATUS_COLOR.idle],
  ['Maintenance', TRUCK_STATUS_COLOR.maintenance],
  ['Forklift active', FORKLIFT_STATUS_COLOR.active],
  ['Charging', FORKLIFT_STATUS_COLOR.charging],
  ['Inbound dock', DOCK_TYPE_COLOR.inbound],
  ['Outbound dock', DOCK_TYPE_COLOR.outbound],
  ['Flex dock', DOCK_TYPE_COLOR.flex],
  ['Low stock', COLORS.cartonLow],
];

const SITES = seedData.sites.map(({ id, code, name, city }) => ({ id, code, name, city }));
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

/*
 * Connected components: each subscribes to the store slice it shows, so a
 * simulation tick re-renders only what changed and the Canvas is never
 * remounted.
 */

function LiveWorld({ labelElements }: { labelElements: RefObject<LabelElements> }) {
  const world = useLiveStore(selectWorldLayout);
  const labels = useLiveStore(selectLabels);
  const selection = useLiveStore((s) => s.selection);
  const highlight = useLiveStore(selectHighlight);
  const focusX = useLiveStore(selectFocusX);
  const select = useLiveStore((s) => s.select);
  return (
    <>
      <WarehouseScene world={world} selection={selection} highlight={highlight} onSelect={select} />
      <StrategyCamera focusX={focusX} />
      <LabelProjector labels={labels} elements={labelElements} />
    </>
  );
}

function LiveLabels({ labelElements }: { labelElements: RefObject<LabelElements> }) {
  const labels = useLiveStore(selectLabels);
  return <LabelLayer labels={labels} elements={labelElements} />;
}

function LiveTopBar() {
  const siteId = useLiveStore((s) => s.siteId);
  const setSite = useLiveStore((s) => s.setSite);
  const now = useLiveStore((s) => s.now);
  return (
    <TopBar
      sites={SITES}
      activeId={siteId}
      onSelectSite={setSite}
      clock={formatClock(now)}
      date={dateFormat.format(new Date(now))}
    />
  );
}

function LiveKpis() {
  const view = useLiveStore(selectSiteKpis);
  const siteId = useLiveStore((s) => s.siteId);
  const select = useLiveStore((s) => s.select);
  const site = SITES.find((s) => s.id === siteId)!;
  return <KpiPanel siteName={`${site.code} · ${site.city}`} view={view} onPickItem={(id) => select({ kind: 'item', id })} />;
}

function LiveFilters() {
  const filters = useLiveStore((s) => s.filters);
  const setFilters = useLiveStore((s) => s.setFilters);
  const options = useLiveStore(selectStatusOptions);
  const delayedCount = useLiveStore(selectDelayedCount);
  const results = useLiveStore(selectFilterResults);
  const select = useLiveStore((s) => s.select);
  const setSite = useLiveStore((s) => s.setSite);
  const pick = (row: FilterResult) => {
    select({ kind: 'truck', id: row.truckId });
    setSite(row.siteId); // fly to where the truck is
  };
  return (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      statusOptions={options}
      delayedCount={delayedCount}
      results={results}
      onPickResult={pick}
    />
  );
}

function Inspector() {
  const details = useLiveStore(selectDetails);
  const select = useLiveStore((s) => s.select);
  return details ? <InspectorPanel details={details} onClose={() => select(null)} /> : null;
}

export function App() {
  const select = useLiveStore((s) => s.select);
  const labelElements = useRef<LabelElements>(new Map());
  // The camera starts over the initially selected site; later moves are flights.
  const [initialCamera] = useState(() => ({
    fov: CAMERA.fov,
    near: 1,
    far: 1200,
    position: cameraPosition(siteStartTarget(selectFocusX(useLiveStore.getState())), CAMERA.startDistance),
  }));

  useEffect(() => startSimulation(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  return (
    <div className="app">
      <Canvas shadows dpr={[1, 2]} camera={initialCamera} onPointerMissed={() => select(null)}>
        <LiveWorld labelElements={labelElements} />
      </Canvas>
      <LiveLabels labelElements={labelElements} />

      <LiveTopBar />
      <aside className="sidebar">
        <LiveKpis />
        <LiveFilters />
      </aside>
      <Inspector />
      <StatusBar legend={LEGEND} />
    </div>
  );
}

