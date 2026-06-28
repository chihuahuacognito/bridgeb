// scripts/exportLevels.mjs
// Seed gdd/levels.csv + gdd/vehicle_designs.csv from the current code levels (RAW_LEVELS).
// Refuses to overwrite existing files unless run with --force (so it can't clobber edits).
//   npm run export:levels            # first-time seed
//   npm run export:levels -- --force # re-mirror code over your edits
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAW_LEVELS, LEVEL_ORDER } from '../src/data/leveldata.js';
import { serializeLevelsCsv, serializeDesignsCsv } from '../src/data/levelKnobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');
const gddDir = resolve(__dirname, '../gdd');
const levelsPath = resolve(gddDir, 'levels.csv');
const designsPath = resolve(gddDir, 'vehicle_designs.csv');
const ids = LEVEL_ORDER; // L01..L12; DEV_STRESS is a dev sandbox, excluded from the CSV.

if (!existsSync(gddDir)) mkdirSync(gddDir, { recursive: true });
for (const p of [levelsPath, designsPath]) {
  if (existsSync(p) && !force) {
    console.error(`Refusing to overwrite ${p}\n  (pass --force to re-seed from code).`);
    process.exit(1);
  }
}

writeFileSync(levelsPath, serializeLevelsCsv(RAW_LEVELS, ids));
writeFileSync(designsPath, serializeDesignsCsv(RAW_LEVELS, ids));
console.log(`Seeded ${ids.length} levels →\n  ${levelsPath}\n  ${designsPath}`);
