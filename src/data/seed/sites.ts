import type { Dock, DockStatus, DockType, Site, SiteId, VehicleClass } from '../types';

export const sites: Site[] = [
  {
    id: 'SITE-JKT',
    code: 'WH-A',
    name: 'Warehouse A – Cakung',
    city: 'Jakarta',
    address: 'Jl. Raya Bekasi Km 21, Cakung, Jakarta Timur 13910',
    coordinates: { lat: -6.1838, lng: 106.9393 },
    timezone: 'Asia/Jakarta',
    palletCapacity: 4200,
  },
  {
    id: 'SITE-CKR',
    code: 'WH-B',
    name: 'Warehouse B – Cikarang',
    city: 'Bekasi',
    address: 'Kawasan Industri Jababeka II, Jl. Industri Selatan 5, Cikarang 17530',
    coordinates: { lat: -6.295, lng: 107.169 },
    timezone: 'Asia/Jakarta',
    palletCapacity: 5600,
  },
  {
    id: 'SITE-SBY',
    code: 'WH-C',
    name: 'Warehouse C – Rungkut',
    city: 'Surabaya',
    address: 'SIER, Jl. Rungkut Industri III No. 18, Surabaya 60293',
    coordinates: { lat: -7.329, lng: 112.772 },
    timezone: 'Asia/Jakarta',
    palletCapacity: 3800,
  },
];

type DockSpec = [type: DockType, maxVehicleClass: VehicleClass, status: DockStatus];

/** Six doors per site, numbered 01–06 from the gate side. */
const dockLayout: Record<SiteId, DockSpec[]> = {
  'SITE-JKT': [
    ['inbound', 'heavy', 'operational'],
    ['inbound', 'heavy', 'operational'],
    ['outbound', 'heavy', 'operational'],
    ['outbound', 'heavy', 'operational'],
    ['outbound', 'heavy', 'operational'],
    ['flex', 'medium', 'maintenance'],
  ],
  'SITE-CKR': [
    ['inbound', 'heavy', 'operational'],
    ['inbound', 'heavy', 'operational'],
    ['outbound', 'heavy', 'operational'],
    ['outbound', 'medium', 'operational'],
    ['flex', 'heavy', 'operational'],
    ['outbound', 'light', 'operational'],
  ],
  'SITE-SBY': [
    ['inbound', 'heavy', 'operational'],
    ['inbound', 'heavy', 'operational'],
    ['outbound', 'medium', 'operational'],
    ['outbound', 'heavy', 'operational'],
    ['flex', 'heavy', 'maintenance'],
    ['flex', 'light', 'operational'],
  ],
};

export const docks: Dock[] = sites.flatMap((site) =>
  dockLayout[site.id].map(([type, maxVehicleClass, status], i): Dock => {
    const number = i + 1;
    return {
      // SITE-JKT + 3 → DOCK-JKT-03
      id: `DOCK-${site.id.slice('SITE-'.length)}-${String(number).padStart(2, '0')}`,
      siteId: site.id,
      number,
      type,
      maxVehicleClass,
      status,
    };
  }),
);
