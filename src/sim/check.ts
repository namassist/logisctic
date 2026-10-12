/**
 * `npm run check:sim` — runs the simulation from the seed for a simulated
 * day and validates every snapshot with the data layer's integrity checks.
 */
import { SEED_NOW, seedData, validateData, type WareTrackData } from '../data';
import { advance, createRng, INITIAL_SIM_STATE, SIM_MINUTES_PER_TICK } from './simulation';

const TICKS = (24 * 60) / SIM_MINUTES_PER_TICK;
/** Being late is a valid live state; the seed check treats it as an error. */
const LATENESS = 'still scheduled after its departure time';

// Any accidental mutation of the seed throws instead of silently passing.
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

let data: WareTrackData = deepFreeze(seedData);
let sim = INITIAL_SIM_STATE;
let now = SEED_NOW;
const rng = createRng(2026);
const errors: string[] = [];
const late = new Set<string>();
const transitions = new Map<string, number>();

for (let i = 1; i <= TICKS; i++) {
  const before = data;
  ({ data, sim, now } = advance(data, sim, now, rng));
  for (const problem of validateData(data, now)) {
    if (problem.includes(LATENESS)) late.add(problem.split(':')[0]);
    else errors.push(`tick ${i} (${now}): ${problem}`);
  }
  const count = (kind: string, a: { id: string; status: string }[], b: { id: string; status: string }[]) => {
    const prev = new Map(a.map((r) => [r.id, r.status]));
    for (const r of b) {
      const from = prev.get(r.id);
      if (from !== r.status) transitions.set(`${kind} ${from} → ${r.status}`, (transitions.get(`${kind} ${from} → ${r.status}`) ?? 0) + 1);
    }
  };
  count('shipment', before.shipments, data.shipments);
  count('truck', before.trucks, data.trucks);
  count('forklift', before.forklifts, data.forklifts);
}

console.log(`Simulated ${TICKS} ticks (${SEED_NOW} → ${now}).`);
console.log('State changes:');
for (const [k, v] of [...transitions].sort()) console.log(`  ${k}: ${v}`);
const byStatus: Record<string, string[]> = {};
for (const s of data.shipments) (byStatus[s.status] ??= []).push(s.id);
console.log('Final shipments:', Object.fromEntries(Object.entries(byStatus).map(([k, ids]) => [k, ids.join(' ')])));
if (late.size) console.log(`Departed late (allowed): ${[...late].join(', ')}`);
if (errors.length) {
  console.error(`\n${errors.length} integrity problem(s), first 15:\n- ${errors.slice(0, 15).join('\n- ')}`);
  process.exit(1);
}
console.log('Every snapshot passed the integrity checks.');
