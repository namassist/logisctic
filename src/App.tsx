import { useEffect, useRef, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { seedData } from './data';
import { formatClock } from './state/format';
import { selectDetails, selectHighlight, selectLabels, selectSiteLayout, selectSiteStats } from './state/selectors';
import { startSimulation, useLiveStore } from './state/store';
import { LabelLayer, LabelProjector, type LabelElements } from './scene/LabelLayer';
import { COLORS, DOCK_TYPE_COLOR, FORKLIFT_STATUS_COLOR, TRUCK_STATUS_COLOR } from './scene/palette';
import { CAMERA, StrategyCamera, cameraPosition } from './scene/StrategyCamera';
import { WarehouseScene } from './scene/WarehouseScene';
import { InspectorPanel } from './ui/InspectorPanel';

const LEGEND: [label: string, color: string][] = [
  ['Truck (active)', TRUCK_STATUS_COLOR.loading],
  ['Truck (idle)', TRUCK_STATUS_COLOR.idle],
  ['Maintenance', TRUCK_STATUS_COLOR.maintenance],
  ['Forklift (active)', FORKLIFT_STATUS_COLOR.active],
  ['Forklift (charging)', FORKLIFT_STATUS_COLOR.charging],
  ['Inbound dock', DOCK_TYPE_COLOR.inbound],
  ['Outbound dock', DOCK_TYPE_COLOR.outbound],
  ['Flex dock', DOCK_TYPE_COLOR.flex],
  ['Low stock', COLORS.cartonLow],
];

/*
 * Connected components: each subscribes to the store slice it shows, so a
 * simulation tick re-renders only what changed and the Canvas is never
 * remounted.
 */

function LiveWarehouse({ labelElements }: { labelElements: RefObject<LabelElements> }) {
  const siteId = useLiveStore((s) => s.siteId);
  const layout = useLiveStore(selectSiteLayout);
  const labels = useLiveStore(selectLabels);
  const selection = useLiveStore((s) => s.selection);
  const highlight = useLiveStore(selectHighlight);
  const select = useLiveStore((s) => s.select);
  return (
    <>
      <WarehouseScene key={siteId} layout={layout} selection={selection} highlight={highlight} onSelect={select} />
      <LabelProjector labels={labels} elements={labelElements} />
    </>
  );
}

function LiveLabels({ labelElements }: { labelElements: RefObject<LabelElements> }) {
  const labels = useLiveStore(selectLabels);
  return <LabelLayer labels={labels} elements={labelElements} />;
}

function SiteStats() {
  const stats = useLiveStore(selectSiteStats);
  return (
    <aside className="hud hud--panel hud--stats">
      {stats.map(([label, value]) => (
        <div key={label} className="stat">
          <span className="stat__label">{label}</span>
          <span className="stat__value">{value}</span>
        </div>
      ))}
    </aside>
  );
}

function SimClock() {
  const now = useLiveStore((s) => s.now);
  return (
    <div className="clock" title="Simulated time (60× real time)">
      <span className="live-dot" />
      Live
      <span className="clock__time">{formatClock(now)}</span>
    </div>
  );
}

function Inspector() {
  const details = useLiveStore(selectDetails);
  const select = useLiveStore((s) => s.select);
  return details ? <InspectorPanel details={details} onClose={() => select(null)} /> : null;
}

export function App() {
  const siteId = useLiveStore((s) => s.siteId);
  const setSite = useLiveStore((s) => s.setSite);
  const select = useLiveStore((s) => s.select);
  const labelElements = useRef<LabelElements>(new Map());
  const site = seedData.sites.find((s) => s.id === siteId)!;

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
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: CAMERA.fov,
          near: 1,
          far: 900,
          position: cameraPosition(CAMERA.startTarget, CAMERA.startDistance),
        }}
        onPointerMissed={() => select(null)}
      >
        <LiveWarehouse labelElements={labelElements} />
        <StrategyCamera />
      </Canvas>
      <LiveLabels labelElements={labelElements} />

      <header className="hud hud--top">
        <div className="brand">
          <span className="brand__mark" />
          <div>
            <div className="brand__name">WareTrack</div>
            <div className="brand__sub">{site.name}</div>
          </div>
        </div>
        <div className="hud__right">
          <SimClock />
          <nav className="sites">
            {seedData.sites.map((s) => (
              <button
                key={s.id}
                className={s.id === siteId ? 'sites__tab sites__tab--active' : 'sites__tab'}
                onClick={() => setSite(s.id)}
              >
                {s.code} · {s.city}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <SiteStats />
      <Inspector />

      <aside className="hud hud--panel hud--legend">
        {LEGEND.map(([label, color]) => (
          <div key={label} className="legend__row">
            <span className="legend__swatch" style={{ background: color }} />
            {label}
          </div>
        ))}
      </aside>

      <footer className="hud hud--panel hud--hint">Click anything to inspect · Drag to pan · Scroll to zoom · Esc to close</footer>
    </div>
  );
}
