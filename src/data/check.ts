/** `npm run check:data` — fails if the seed data is inconsistent. */
import { SEED_NOW, seedData, validateData } from './index';

const errors = validateData(seedData, SEED_NOW);
const counts = Object.entries(seedData).map(([name, rows]) => `${rows.length} ${name}`);
console.log(`Seed data: ${counts.join(', ')}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('All integrity checks passed.');
