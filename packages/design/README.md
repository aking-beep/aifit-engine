# @aifit/design

The AI Fit 2.0 design system: tokens (`tokens.css`) and components (`src/`), ported from the Magic
Patterns export in `design/magic-patterns/ai-fit-design-system`.

**Edit here, then run `npm run sync -w @aifit/design`** (or `node scripts/sync-design.mjs`). It copies `src/`
and `tokens.css` into `apps/web/src/design/` and `apps/teams/src/design/`. The apps import those copies,
because AI Fit (`apps/web`) is outside the npm workspace and runs React 19, while the workspace root
resolves React 18. `node scripts/sync-design.mjs --check` (run in CI) fails if a copy has drifted.

Changes from the export:
- `'use client'` on interactive modules;
- SSR-safe portals;
- unique SVG marker ids;
- real links (`LinkProvider`, `DLink`) in `AppShell`;
- self-hosted fonts (@fontsource) instead of remote imports;
- a persisted theme with a pre-paint boot script;
- `EngineProgress` driven by the real request (`done`);
- no sample data or `SampleDataTag`, and `DATA_MODE = 'live'`;
- engine-to-design mappings (`verdictFromOutcome`, `evidenceFromBasis`).
