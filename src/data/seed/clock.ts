import type { IsoDateTime } from '../types';

/**
 * All seed timestamps are in Western Indonesia Time (UTC+7).
 * `wib('2026-10-12 16:42')` → "2026-10-12T16:42:00+07:00".
 */
export function wib(localDateTime: string): IsoDateTime {
  return `${localDateTime.replace(' ', 'T')}:00+07:00`;
}

/**
 * The "current time" the seed data was written against. Statuses, ETAs and
 * truck positions are consistent as of this instant (matches the 16:42 clock
 * in the dashboard mock-up).
 */
export const SEED_NOW: IsoDateTime = wib('2026-10-12 16:42');
