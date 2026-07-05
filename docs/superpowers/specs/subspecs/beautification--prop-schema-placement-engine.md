# Sub-spec: Prop schema + placement engine

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** DATA layer built + tested 2026-07-04 (`src/systems/worldforge/props/`, 23 tests). Renderer wiring into `GroundWorld` is the next packet.

## Decision
One contract describes every prop: visual form (mesh recipe or source), FULL referee data (cover, blocks-sight, blocks-movement, material + thickness — the `BattleMapTile` vocabulary), and placement tags. The placement engine maps town-plan roles / building types / biomes → seeded prop instances in the ground artifact (dock→crates/nets, smithy→woodpile/anvil, market plaza→stalls; biome→cover scatter with clustering). Deterministic from seed paths: same world → same props, forever.

## Open
- **GroundWorld wiring + adapter** — project a real `GroundWorld` onto
  `PropPlacementContext` and add a `props: PropInstance[]` array (next packet;
  touches hot files another agent may own).
- **Renderer integration** — the WebGPU migration consumes `PropInstance` +
  `gen`/`variation` to build meshes.
- **BG3 density re-calibration** — retune the encoded density bounds against
  Remy's real BG3 captures when they land (proxy pack used for now).

## Decisions (built 2026-07-04 — DATA layer only, `src/systems/worldforge/props/`)
- **Schema file format + where catalogs live** — TypeScript modules under
  `src/systems/worldforge/props/`: `propSchema.ts` (types + validation),
  `catalog.ts` (the 14 WAVE-1 defs as plain data, Remy-editable content),
  `placementEngine.ts` (pure seeded placement). No JSON/DSL — a typed module gives
  compile-time referee-vocabulary safety and zero load cost.
- **Referee cover ladder vs BattleMapTile boolean** — definitions carry the full
  `none|half|three-quarters|full` rung (what the fight-in-place referee needs);
  `providesCover(def)` derives the BattleMapTile boolean (`cover !== 'none'`).
- **Material vocabulary** — props speak ONLY canon `MaterialType`. The strawman's
  "organic" (plant matter) maps to `'wood'`. Hollow props (crate/barrel) carry
  WALL thickness, not solid span (strawman assumption confirmed).
- **Density parameters** — encoded from the BG3 cheat-sheet
  (`../research/2026-07-03-bg3-reference-pack.md`) and asserted in tests: market
  ~1 stall per 4 m of plaza edge (clamped 3–10) + 6–12 understock props/stall;
  docks 4–8 crate/barrel/stack pooled per loading point; wilderness ~18% of
  eligible biome cells seed a 2–6 cover cluster (readable, not carpeted).
- **How instances serialize into `GroundWorld`** — DEFERRED to the next (wiring)
  packet by design. This packet's boundary is exported pure functions returning
  `PropInstance[]`; the engine consumes a decoupled, GroundWorld-SHAPED
  `PropPlacementContext` so the adapter can be added without touching hot files.
  Recommendation stands: a new `props: PropInstance[]` array on `GroundWorld`
  (keeps referee data out of `features`). `PropInstance` uses `xM`/`zM` ground
  meters to match `GroundFeature`/`GroundHostile`.
