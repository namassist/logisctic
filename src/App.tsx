import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { SEED_NOW, seedData, type SiteId } from './data';
import { buildLabels } from './scene/labels';
import { LabelLayer, LabelProjector, type LabelElements } from './scene/LabelLayer';
import { buildSiteLayout, type SiteLayout } from './scene/layout';
import { DOCK_TYPE_COLOR, FORKLIFT_STATUS_COLOR, TRUCK_STATUS_COLOR, COLORS } from './scene/palette';
import { CAMERA, StrategyCamera, cameraPosition } from './scene/StrategyCamera';
import { WarehouseScene } from './scene/WarehouseScene';

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

function siteStats(layout: SiteLayout) {
  const operational = layout.docks.filter((d) => d.dock.status === 'operational').length;
  return [
    ['Docks in use', `${layout.docks.filter((d) => d.occupiedBy).length} / ${operational}`],
    ['Trucks on site', String(layout.trucks.filter((t) => t.where !== 'road').length)],
    ['Inbound en route', String(layout.trucks.filter((t) => t.where === 'road').length)],
    ['Forklifts active', `${layout.forklifts.filter((f) => f.forklift.status === 'active').length} / ${layout.forklifts.length}`],
    ['Low-stock SKUs', String(layout.stock.filter((s) => s.low).length)],
  ];
}

export function App() {
  const [siteId, setSiteId] = useState<SiteId>(seedData.sites[0].id);
  const layout = useMemo(() => buildSiteLayout(seedData, siteId, SEED_NOW), [siteId]);
  const labels = useMemo(() => buildLabels(layout), [layout]);
  const labelElements = useRef<LabelElements>(new Map());
  const site = seedData.sites.find((s) => s.id === siteId)!;

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
      >
        <WarehouseScene key={siteId} layout={layout} />
        <StrategyCamera />
        <LabelProjector labels={labels} elements={labelElements} />
      </Canvas>
      <LabelLayer labels={labels} elements={labelElements} />

      <header className="hud hud--top">
        <div className="brand">
          <span className="brand__mark" />
          <div>
            <div className="brand__name">WareTrack</div>
            <div className="brand__sub">{site.name}</div>
          </div>
        </div>
        <nav className="sites">
          {seedData.sites.map((s) => (
            <button
              key={s.id}
              className={s.id === siteId ? 'sites__tab sites__tab--active' : 'sites__tab'}
              onClick={() => setSiteId(s.id)}
            >
              {s.code} · {s.city}
            </button>
          ))}
        </nav>
      </header>

      <aside className="hud hud--panel hud--stats">
        {siteStats(layout).map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat__label">{label}</span>
            <span className="stat__value">{value}</span>
          </div>
        ))}
      </aside>

      <aside className="hud hud--panel hud--legend">
        {LEGEND.map(([label, color]) => (
          <div key={label} className="legend__row">
            <span className="legend__swatch" style={{ background: color }} />
            {label}
          </div>
        ))}
      </aside>

      <footer className="hud hud--panel hud--hint">Drag to pan · Scroll to zoom · Arrow keys to move</footer>
    </div>
  );
}
