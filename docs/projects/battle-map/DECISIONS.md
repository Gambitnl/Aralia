# Battle Map Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D3: Keep `useBattleMapGeneration.ts` filename (G3 naming contract)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should `src/hooks/useBattleMapGeneration.ts` be renamed to match its stateless utility role, or should the hook-shaped filename remain for caller stability? (Required Review Brief in `NORTH_STAR.md`.)

Decision made:
Option B — keep the current filename. Document the stateless utility contract (the module exports the plain `generateBattleSetup` setup helper despite the hook-shaped name) and revisit the rename only when caller churn is already planned.

Rationale and evidence:
- A rename-only sweep would churn stable imports across `CombatView`, `BattleMapDemo`, tests, and docs with no behavior gain.
- The documented contract removes the onboarding ambiguity without code movement.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D17).

Follow-up:
G3 closes as keep-as-is; if a future slice already plans caller churn around the generation helper, fold the rename into that sweep.

### D2: Route tactical spawn scoring to Battle Map

Date: 2026-06-10

Owner: Codex

Decision point:
The external AAA-lite visual-readability report recommended tactically-aware spawn placement using cover, elevation, and chokepoints.

Decision made:
Track this as a Battle Map gap, not an Encounter Generator gap.

Rationale and evidence:
- `src/hooks/useBattleMapGeneration.ts` owns current team placement through `SpawnConfig`, zone rectangles, shuffled walkable tiles, and `MIN_SEP` spreading.
- `src/services/battleMapGenerator.ts` already creates the terrain/elevation/LoS-blocking map facts that a scoring heuristic would consume.
- `docs/projects/encounter-generator` owns encounter content, seedability, difficulty policy, and AI/provider determinism, not tile-level map setup.

Mutation performed:
- Added `G6` to `docs/projects/battle-map/GAPS.md`.

Follow-up:
Keep the first implementation bounded to deterministic 40x30 map-gen scoring and proof that no character starts without a valid tile.

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/battle-map`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.
