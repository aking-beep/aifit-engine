import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIXTURE_DIR, computeGolden } from './golden.js';

// `npm run golden` after an intentional rules or engine change. Both the
// TypeScript and Python suites compare against this file.
writeFileSync(resolve(FIXTURE_DIR, 'golden.json'), JSON.stringify(computeGolden(), null, 2) + '\n');
console.log('wrote fixtures/golden.json');
