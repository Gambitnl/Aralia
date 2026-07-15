# Absorbed: Battle Map (docs/projects/battle-map)

Status: active reference — absorbed into planmap topic `battlemap-retirement` on 2026-07-15.
The living-project folder was deleted (git history is the archive). This doc keeps the
prose future agents still need until the conjured arena retires: the `generateBattleSetup`
utility contract (D17), the 2D/3D parity gate, and the standing decisions.

## What this lane is

The tactical grid layer used by combat, with 2D (`BattleMap.tsx`) and 3D
(`BattleMap3D.tsx`) renderers sharing one interaction contract. `CombatView` owns
`mapData` and orchestrates `useTurnManager`, `useAbilitySystem`, `useBattleMap`, and the
renderer choice. Combat rules live in hooks/utilities, never in renderer components.
The arena retires only after fight-in-place passes the presentation-parity matrix
(see the `battlemap-retirement` topic deps); until then this contract is live.

## D17 utility contract: `generateBattleSetup` (Remy decision 2026-06-10, Option B)

`src/hooks/useBattleMapGeneration.ts` keeps its hook-shaped filename for caller
stability but exports ONE stateless helper — no rename, no caller sweep:

```ts
export const generateBattleSetup = (
    biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
    seed: number,
    initialCharacters: CombatCharacter[],
    presetMapData?: BattleMapData
): { mapData: BattleMapData, positionedCharacters: CombatCharacter[] }
```

Invariants any change must preserve (or record a breaking migration):
- Determinism: identical inputs give byte-equivalent output. One `SeededRandom(seed)`
  instance, draws in fixed order (spawn-config pick, per-team zone shuffle, map-wide
  fallback shuffle). A second RNG, `Math.random()`, or reordered draws breaks it.
- Procedural path: seeded choice among `left-right` / `top-bottom` / `corners-tl-br` /
  `corners-tr-bl` zone rects; `cornerSize = floor(min(w,h) * 0.35)`, rects clamped.
- Tactical scoring (G6, built 2026-06-19): `coverScore + elevation*2 + chokepointScore
  + enemyDistanceScore`, integer weights, stable best-first sort AFTER the seeded
  shuffle so ties break deterministically. Player team places first against the enemy
  zone anchor; enemies place second against actual player tiles.
- `MIN_SEP = 2` (Chebyshev) between teammates on the first pass; same-zone fallback and
  map-wide nearest-walkable fallback drop it so every character gets a defined tile on
  any map with enough walkable tiles. Never fabricate a position — with too few
  walkable tiles, leftover roster entries return unchanged.
- Preset path (`presetMapData` supplied): generator skipped; nearest-walkable placement
  around anchors `(20, 15)` player / `(24, 18)` enemy.
- Budget: <=50 ms for a default 40x30 forest setup; re-run the budget test in
  `src/hooks/__tests__/useBattleMapGeneration.test.ts` after any scoring/zone change.

NOT owned by the helper (do not extend it to cover): renderer/overlay/VFX behavior,
LoS/targeting/movement, encounter content/difficulty/AI, save/load of `mapData`.

## 2D/3D parity gate

Before any behavior expansion touching movement, targeting, overlays, or visibility,
re-run the focused parity tests — they are the durable gate:
`src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`,
`BattleMap3D.parity.test.tsx`, `BattleMap.visibility.test.tsx`,
`BattleMap3D.visibility.test.tsx`. Checked areas: shared state updates, movement
highlight, target highlight, overlay families (spell zones, delayed effects, light
sources, AoE/teleport previews). Visual fallback substitutes are NOT parity — a
placeholder or hidden error boundary fails the gate.

Cave/dungeon connectivity: `ensureConnectivity()` in `battleMapGenerator.ts` carves
deterministic corridors when generation splits walkable regions; a focused seed-2
regression keeps that guarantee visible.

## Open work absorbed into the planmap topic

- G5: `VFXSystem.tsx` (~1083 lines) modularization needs a renderer-boundary proof
  first — `buildTileVisibilityOverlays` export and spell-zone parity are the test
  anchors (routed from code-modularization-audit CMA-G5).
- CMA-G15: `CharacterActor.tsx` / `TerrainMesh.tsx` splits need actor/terrain render
  parity proof before code moves.
- G7: control-option commands (approach, flee, drop, grovel, halt) have gameplay proof
  but no shared visual pose/variant path; define a non-blocking presentation contract
  (from the retired SPRITE-POSE-CONTROL-VARIANTS note).
