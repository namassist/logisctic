import type { DockType, ForkliftStatus, TruckStatus } from '../data';

/** Scene colours, picked to match the dark, warm-lit concept art. */
export const COLORS = {
  background: '#0d1218',
  grass: '#1b241f',
  asphalt: '#2a2e35',
  road: '#22252b',
  concrete: '#7d8085',
  wall: '#7f8792',
  wallTrim: '#454b54',
  laneYellow: '#f2b01e',
  laneWhite: '#d9dce1',
  rackUpright: '#2f5c9e',
  rackBeam: '#e0742a',
  carton: '#c49a5c',
  cartonLow: '#d0563c',
  pallet: '#8a6a43',
  truckCab: '#e9eaec',
  truckCargo: '#a3a9b1',
  chassis: '#1d1f23',
  glass: '#1c2733',
  tyre: '#151618',
  forkliftBody: '#f3b51b',
  forkliftMetal: '#2b2d31',
  shutter: '#a2abb6',
  doorwayGlow: '#ffcf7a',
  hazard: '#e2452f',
  foliage: '#2e5a35',
  trunk: '#4b3826',
} as const;

export const TRUCK_STATUS_COLOR: Record<TruckStatus, string> = {
  loading: '#f5a524',
  unloading: '#f5a524',
  in_transit: '#f5a524',
  idle: '#3b82f6',
  maintenance: '#ef4444',
};

export const FORKLIFT_STATUS_COLOR: Record<ForkliftStatus, string> = {
  active: '#22c55e',
  idle: '#9ca3af',
  charging: '#38bdf8',
  maintenance: '#ef4444',
};

export const DOCK_TYPE_COLOR: Record<DockType, string> = {
  inbound: '#3b82f6',
  outbound: '#f5a524',
  flex: '#a78bfa',
};
