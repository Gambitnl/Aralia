# Sub-spec: Prop schema + placement engine

**Parent:** `../2026-07-02-world-beautification-wave.md` · **Status:** specced, not built. Everything else in the wave depends on this — build first.

## Decision
One contract describes every prop: visual form (mesh recipe or source), FULL referee data (cover, blocks-sight, blocks-movement, material + thickness — the `BattleMapTile` vocabulary), and placement tags. The placement engine maps town-plan roles / building types / biomes → seeded prop instances in the ground artifact (dock→crates/nets, smithy→woodpile/anvil, market plaza→stalls; biome→cover scatter with clustering). Deterministic from seed paths: same world → same props, forever.

## Open
- Schema file format + where catalogs live.
- Density parameters per context (calibrate against BG3 anchor shots).
- How instances serialize into `GroundWorld` (extend `features` or a new `props` array).
