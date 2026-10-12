import type { IsoDateTime } from '../data';

/** All sites are in Western Indonesia Time. */
const TIME_ZONE = 'Asia/Jakarta';

const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const hms = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TIME_ZONE });

/** "16:42" */
export function formatTime(iso: IsoDateTime): string {
  return hm.format(new Date(iso));
}

/** "16:42:00" */
export function formatClock(iso: IsoDateTime): string {
  return hms.format(new Date(iso));
}

/** "16:42", or "13 Oct 07:00" when it falls on a different day than `relativeTo`. */
export function formatWhen(iso: IsoDateTime, relativeTo: IsoDateTime): string {
  const sameDay = dayMonth.format(new Date(iso)) === dayMonth.format(new Date(relativeTo));
  return sameDay ? formatTime(iso) : `${dayMonth.format(new Date(iso))} ${formatTime(iso)}`;
}

/** Adds minutes and returns a WIB (+07:00) timestamp like the seed data uses. */
export function addMinutes(iso: IsoDateTime, minutes: number): IsoDateTime {
  const ms = Date.parse(iso) + minutes * 60_000;
  return `${new Date(ms + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;
}

export function minutesBetween(from: IsoDateTime, to: IsoDateTime): number {
  return (Date.parse(to) - Date.parse(from)) / 60_000;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
