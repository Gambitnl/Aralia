# Range Metric Impact Map

Status: research only. No source file changed.
Date: 2026-09-14.
Owner task: agora-79fa.4 (range part).
Related gap: GG-203 in `docs/projects/GLOBAL_GAPS.md` line 93.

Remy chose the straight-line (Euclidean) metric for spell range. This document maps every
distance computation on the 2D combat grid. It shows what disagrees if only spell range
changes. It gives two scopes to pick from.

---

## 1. The two metrics

The 5e grid rule measures distance as the larger of the two axis differences. This is the
Chebyshev metric. A diagonal step costs the same as a cardinal step. The straight-line
metric measures distance as the square root of the sum of the squared axis differences.
This is the Euclidean metric. Each tile is 5 feet. A target four tiles away on the diagonal
is 20 feet by the grid rule. The same target is 28.3 feet by the straight-line metric. A
25-foot spell therefore hits that target under the grid rule and misses it under the
straight-line metric. The repo uses both metrics today. Spell range in
`TargetResolver` uses the straight-line metric. Movement, area of effect, reach, and
targeting all use the grid rule.

---

## 2. Inventory

All line numbers were read and verified on 2026-09-14.

### 2.1 Grid-rule (Chebyshev) computations

| File:line | Function | Metric today | Consumed by |
|---|---|---|---|
| `src/utils/combat/combatUtils.ts:518` | `getDistance` | Chebyshev, tiles | The shared grid ruler. 65 non-test call sites. Feeds AI scoring, movement commands, reach checks, teleport filters, and the map distance badge. |
| `src/utils/combat/combatUtils.ts:570` | `getCharacterDistance` | Chebyshev over both footprints | Size-aware reach. 24 non-test call sites. Feeds opportunity attacks and melee rider effects. |
| `src/utils/combat/combatUtils.ts:477` | action log text builder | Chebyshev, inline | Combat log movement text ("moves 20 ft north"). |
| `src/utils/combat/combatUtils.ts:700` | `resolveAreaDefinition`, circle branch | Chebyshev through `getDistance` | Legacy ability area footprint. |
| `src/utils/combat/combatUtils.ts:743` | `resolveAreaDefinition`, cone branch | Chebyshev through `getDistance` | Legacy ability cone footprint. |
| `src/utils/spatial/elevationGeometry.ts:104` | `getPositionPairDistanceFeet` | Chebyshev horizontal plus true vertical | The primary in-play range ruler. |
| `src/utils/spatial/elevationGeometry.ts:118` | `getCombatDistanceFeet` | Chebyshev, feet | 9 non-test call sites. Used by `useTargetValidator` and `ActionValidator`. |
| `src/utils/spatial/elevationGeometry.ts:146` | `getCombatantToPositionDistanceFeet` | Chebyshev, feet | 3 non-test call sites. Empty-tile targeting, object interaction, summon commands. |
| `src/hooks/combat/useTargetValidator.ts:234` | `getTargetValidation` range check | Chebyshev, feet divided by 5 | The targeting UI range gate. This is what the player sees. |
| `src/systems/actions/ActionValidator.ts:634` | `validateRange` | Chebyshev, inline | Server-side action validation for range and touch. |
| `src/utils/combat/aoeCalculations.ts:314` | `getSphereAoE` | Chebyshev | Area of effect footprint on tiles. Gives a square. |
| `src/utils/combat/aoeCalculations.ts:313` | `getConeAoE` distance gate | Chebyshev | Cone footprint length gate. |
| `src/utils/combat/aoeCalculations.ts:466` | `projectPoint` | Chebyshev scale factor | Line and cone aim point projection. |
| `src/utils/combat/physicsUtils.ts:299` | `calculateChebyshevDistance` | Chebyshev, feet | Light radius. 2 non-test call sites. |
| `src/utils/combat/physicsUtils.ts:330` | `calculateLightLevel` | Chebyshev, feet | Bright and dim light bands. |
| `src/systems/spells/effects/trigger/areaTriggerProcessing.ts:396` | `getChebyshevTileDistance` | Chebyshev, tiles | 3 call sites. Spike Growth style move-in-area damage steps. |
| `src/utils/spatial/pathfinding.ts:41` | `heuristic` | Chebyshev feet plus elevation | A* pathfinding heuristic. |
| `src/systems/combat/fightInPlace/battlefieldEscape.ts:113` | `distanceToBoundary` | Chebyshev to nearest edge | Escape-from-battlefield check. |
| `src/utils/combat/aerialMovementUtils.ts:164` | step count | Chebyshev, inline | Aerial path step count. |
| `src/utils/combat/archfeyUtils.ts:125` | Fey Presence cube | Chebyshev, inline | Subclass area. |
| `src/utils/combat/beastMasterUtils.ts:308` | companion reach | Chebyshev, inline | Companion reach gate. |
| `src/utils/combat/circleOfTheMoonUtils.ts:138` | range gate | Chebyshev, inline | Subclass range. |
| `src/utils/combat/hunterUtils.ts:112` | Giant Killer reach | Chebyshev, inline | Reaction reach gate. |
| `src/utils/combat/shadowMonkUtils.ts:163` | range gate | Chebyshev, inline | Subclass teleport range. |
| `src/components/BattleMap/characters/characterActor/CharacterActor.tsx:152` | `distanceToActive` | Chebyshev through `getDistance` | Distance badge on the 3D token. |
| `src/utils/spatial/vectorMath.ts:119` | `chebyshevDistance2D` | Chebyshev | No non-test consumer. Test only. |

### 2.2 Straight-line (Euclidean) computations

| File:line | Function | Metric today | Consumed by |
|---|---|---|---|
| `src/systems/spells/targeting/TargetResolver.ts:342` | `getDistance` | Euclidean, feet | Spell range check. 2 call sites: line 121 (creature target) and line 321 (object target). This is the split GG-203 records. |
| `src/systems/spells/ai/AISpellArbitrator.ts:334` | `getDistance` | Euclidean, tiles | AI spell prompt text and AI distance scoring. Lines 316 and 323. |
| `src/systems/spells/targeting/gridAlgorithms/sphere.ts:28` | `getSphere` | Euclidean, feet | Grid sphere algorithm. A second, circular sphere footprint. |
| `src/systems/spells/effects/trigger/areaTriggerProcessing.ts:193` | `isPositionInArea` fallback | Euclidean | Fallback zone hit test for malformed zones. Tracked as GG-201. |
| `src/utils/combat/aoeCalculations.ts:146` | `calculateAffectedArea` | Euclidean polygon | Gridless area outline. One consumer: `src/components/BattleMap/GridlessAoEOutline.tsx:38`. |
| `src/utils/combat/aoeCalculations.ts:205` | `polygonContains` | Euclidean | Gridless hit test. Test-only consumer today. |
| `src/utils/combat/aoeCalculations.ts:428` | `pointLineSegmentDistance` | Euclidean | Line width in `getLineAoE`. The line length is still Chebyshev-projected. |
| `src/utils/combat/combatAI.ts:1521` | `getPerpendicularDistanceToLine` | Euclidean | AI interception scoring. |
| `src/utils/spatial/vectorMath.ts:106` | `euclideanDistance2D` | Euclidean | No non-test consumer. Test only. |

### 2.3 DMG 5-10-5 computations

| File:line | Function | Metric today | Consumed by |
|---|---|---|---|
| `src/utils/combat/movementUtils.ts:108` | `calculateMovementCost` | 5-10-5 | Per-step movement cost. |
| `src/utils/combat/movementUtils.ts:127` | `calculateStepMovementCost` | 5-10-5 plus terrain | Per-step cost with terrain. |
| `src/utils/combat/movementUtils.ts:142` | `calculatePathMovementCost` | 5-10-5 plus elevation | Total path cost. |
| `src/utils/combat/movementUtils.ts:172` | `getTargetDistance` | 5-10-5, feet | 2 non-test call sites: `aerialMovementUtils.ts:363` and `grappleUtils.ts:503`. |
| `src/hooks/combat/useGridMovement.ts:90` | reachable-tile search | 5-10-5, breadth-first | The blue movement overlay the player sees. |

### 2.4 Manhattan computations

| File:line | Function | Metric today | Consumed by |
|---|---|---|---|
| `src/utils/spatial/vectorMath.ts:112` | `manhattanDistance2D` | Manhattan | No non-test consumer. |
| `src/utils/spatial/walkabilityUtils.ts:106` | `manhattanDistance` | Manhattan | Town walkability, not combat. |

### 2.5 Not part of the 2D combat grid

These use a Chebyshev or Euclidean metric but on other surfaces. They are out of scope.

- `src/systems/world3d/chunkManager.ts:25` and `src/systems/world3d/lod.ts` chunk streaming.
- `src/utils/travel/TravelCalculator.ts:45` overland travel.
- `src/systems/worldforge/**` region, interior, and dungeon generation.
- `src/systems/combat/worldScenario/**` battlefield placement in world meters.

---

## 3. What breaks with spell range alone on the straight-line metric

Each item gives one worked example.

1. **A target you can walk to is out of spell range.**
   Caster at (0,0). Target at (4,4). Movement charges 5-10-5, so the walk costs 30 feet.
   `getCharacterDistance` reports 4 tiles. `useTargetValidator.ts:234` accepts a 20-foot
   spell. `TargetResolver.ts:342` reports 28.3 feet and rejects the same 20-foot spell.
   Two range gates, two answers, one click.

2. **Two range gates disagree on the same cast.**
   The UI gate is `useTargetValidator.ts:234`, which is Chebyshev. The rules gate is
   `TargetResolver.ts:121`, which is Euclidean. For a 30-foot spell and a target at (5,5),
   the UI says 25 feet and lights the tile. The resolver says 35.4 feet and refuses. The
   player sees a legal target that fails.

3. **`ActionValidator` disagrees with the resolver.**
   `ActionValidator.ts:634` is Chebyshev. For a 30-foot ability and a target at (6,6), the
   validator returns 30 feet and passes. The resolver returns 42.4 feet and fails.
   `ActionValidator.test.ts:322` encodes the passing case.

4. **Range reads as a square, not a circle.**
   The targeting UI highlights tiles that pass the Chebyshev gate. A 30-foot range covers a
   13x13 square of 169 tiles. A true 30-foot circle covers about 121 tiles. The 48 corner
   tiles look legal and are not.

5. **Area of effect footprints stay square.**
   `getSphereAoE` at `aoeCalculations.ts:314` uses Chebyshev. A 20-foot radius returns 81
   tiles (9x9). `sphere.ts:28` uses Euclidean and returns about 45 tiles for the same
   radius. A Fireball placed at maximum straight-line range therefore covers a square
   footprint whose corners lie 28.3 feet from the center, not 20.

6. **Reach and opportunity attacks stay on the grid rule.**
   `OpportunityAttackSystem` uses `getCharacterDistance`. A mover at (1,0) that steps to
   (1,1) stays at distance 1 and provokes nothing. Under the straight-line metric that
   move ends 7.1 feet from a 5-foot reach attacker, so it should provoke.
   `OpportunityAttackSystem.test.ts:60` states the current rule in its comment.

7. **AI scoring assumes grid distance.**
   `combatAI.ts:782` and `combatAI.ts:836` compare `getDistance` tiles against
   `ability.range` tiles. A caster at (0,0) with a 6-tile spell and a target at (6,6)
   scores the target as in range and skips the move leg. The resolver then refuses the
   cast at 42.4 feet. The turn spends an action and does nothing.

8. **The AI spell prompt quotes a third number.**
   `AISpellArbitrator.ts:323` prints Euclidean tiles times 5. For a target at (3,4) it
   prints 25 feet. `combatAI.ts` scores the same target at 4 tiles, which is 20 feet. The
   language model and the scorer read different battlefields.

9. **Light radius stays square.**
   `physicsUtils.ts:330` uses Chebyshev. A 20-foot torch lights (3,3), which is 15 feet by
   the grid rule and 21.2 feet in a straight line. A target can be lit and out of a
   20-foot spell range at the same time.

10. **Move-in-area damage counts grid steps.**
    `areaTriggerProcessing.ts:396` bills a diagonal move of three tiles as three 5-foot
    steps. A straight-line reading is 21.2 feet, which is four steps. Spike Growth damage
    differs by one die.

11. **Tests hold hard-coded expectations.**
    `aoeCalculations.test.ts:26` asserts 81 tiles for a 20-foot sphere.
    `aoeCalculations.test.ts:173` asserts a 30-foot line at 45 degrees reaches (6,-6), and
    its comment states that Euclidean would only reach about 4.2 tiles.
    `physicsUtils_light.test.ts:18` asserts (3,3) is 15 feet.
    `pathfindingHeuristic.test.ts:34` asserts (4,4) is 20.
    Section 6 lists the full set.

12. **One test set does not break.**
    `TargetResolver.test.ts` places every actor on the same row: caster (10,10), ally
    (12,10), close enemy (11,10), far enemy (20,10). All of these are axis-aligned. The two
    metrics agree on them. The source comment at `TargetResolver.ts:353` says the test
    file encodes Euclidean expectations. That claim is wrong for the range cases.

---

## 4. Two scopes

### Scope A: spell range only

Change the straight-line metric into the single spell-range ruler. Leave movement, area of
effect, reach, and light on the grid rule.

Files to change:

- `src/systems/spells/targeting/TargetResolver.ts` (keep line 342 as is; it already is
  Euclidean).
- `src/hooks/combat/useTargetValidator.ts:234` (switch the UI gate to the straight-line
  metric so it agrees with the resolver).
- `src/utils/spatial/elevationGeometry.ts:104` (add a straight-line horizontal option, or
  add a second helper; the vertical term stays additive).
- `src/systems/actions/ActionValidator.ts:634` (switch the range branch only; leave the
  touch branch on adjacency).
- `src/utils/combat/combatAI.ts` (the range comparisons at lines 494, 836, 941, 1067, 1078,
  1301 must use the same ruler as the resolver).
- `src/systems/spells/ai/AISpellArbitrator.ts:334` (already Euclidean; keep).

That is 6 files.

Tests to update: 4.

- `src/systems/actions/__tests__/ActionValidator.test.ts` (line 322, diagonal at 30 feet).
- `src/hooks/combat/__tests__/useTargetValidator.test.ts` (range and elevation cases).
- `src/utils/combat/__tests__/combatAI.test.ts` (lines 354 and 668).
- `src/utils/spatial/__tests__/elevationGeometry.test.ts` (all cases are axis-aligned today,
  so add diagonal cases rather than change them).

Rules of play:

- Range becomes a circle. Area of effect stays a square. A Fireball can be placed at a
  point whose blast corners reach further than the range that allowed the placement.
- Reach and opportunity attacks keep the grid rule. A creature can leave a 5-foot reach on
  the diagonal without provoking, and still be out of a 5-foot touch spell range.
- Movement stays 5-10-5. Diagonal approach still buys less range than the player expects.

Risk: medium. The change is small and the ruler split is visible to players on every
diagonal cast. The split between range and area of effect is a permanent rules oddity.

### Scope B: every distance on the grid

Change every grid ruler to the straight-line metric, movement included.

Files to change (grouped):

- Range and targeting: `TargetResolver.ts`, `useTargetValidator.ts`,
  `ActionValidator.ts`, `elevationGeometry.ts`.
- Shared ruler: `src/utils/combat/combatUtils.ts` (`getDistance` at line 518 and
  `getCharacterDistance` at line 571; 89 call sites inherit the change).
- Area of effect: `src/utils/combat/aoeCalculations.ts` (lines 313, 314, 466) and
  `src/systems/spells/targeting/gridAlgorithms/sphere.ts` (already Euclidean).
- Movement: `src/utils/combat/movementUtils.ts` (lines 109, 127, 142, 172),
  `src/hooks/combat/useGridMovement.ts:90`, `src/utils/spatial/pathfinding.ts:41`.
- Triggers and light: `areaTriggerProcessing.ts:396`, `physicsUtils.ts:299`.
- Inline sites: `aerialMovementUtils.ts:164`, `archfeyUtils.ts:125`,
  `beastMasterUtils.ts:308`, `circleOfTheMoonUtils.ts:138`, `hunterUtils.ts:112`,
  `shadowMonkUtils.ts:163`, `combatUtils.ts:477`, `battlefieldEscape.ts:113`.
- AI: `combatAI.ts` (all `getDistance` comparisons), `AISpellArbitrator.ts`.

That is about 20 files. It also touches 89 inherited call sites through the two shared
helpers.

Tests to update: 14. Section 6 lists them.

Rules of play:

- Every shape becomes round. Range, area of effect, light, and reach all agree.
- Diagonal movement becomes more expensive than 5-10-5. A straight diagonal of four tiles
  costs 28.3 feet, not 30 feet under 5-10-5 and not 20 feet under the grid rule. The
  movement search must carry fractional feet.
- Reach becomes fractional. A 5-foot reach no longer covers the eight surrounding tiles.
  Only the four cardinal neighbors are within 5 feet. The four diagonal neighbors are 7.1
  feet away. This breaks melee as players expect it, unless reach is redefined as a tile
  count rather than a foot count.
- The A* heuristic must stay admissible. A Euclidean heuristic under Euclidean step costs
  stays admissible, so pathfinding remains correct.
- Opportunity attacks fire on more moves, because leaving a diagonal square now crosses the
  reach threshold.

Risk: high. The reach consequence is the one that changes the feel of every melee turn.
Scope B needs a separate ruling on whether melee reach is measured in feet or in tiles.

---

## 5. The 3D gridless map

How it measures today:

- `src/components/BattleMap/GridlessAoEOutline.tsx:38` calls
  `calculateAffectedArea` at `src/utils/combat/aoeCalculations.ts:146`. That function is
  pure Euclidean. A sphere is a 32-segment circle. A cone spans twice `atan(0.5)`. A line
  is a true rectangle.
- `polygonContains` at `aoeCalculations.ts:205` tests a point against that polygon with
  `Math.hypot`. It has no non-test consumer yet.
- The 3D map draws the Euclidean outline **on top of** the Chebyshev tile decals. The
  outline and the highlighted tiles disagree today, by design. The file comment at
  `GridlessAoEOutline.tsx:5` states that the decals show the snapped tile set.
- Range itself is not drawn on the 3D map. `CharacterActor.tsx:152` shows a distance badge,
  and that badge uses `getDistance`, which is Chebyshev.

Does the straight-line metric bring 2D and 3D into agreement?

- For **range**: partly. Scope A makes the 2D range gate Euclidean, and the 3D badge at
  `CharacterActor.tsx:152` must change with it or the badge keeps printing grid feet.
- For **area of effect**: only under Scope B. The 3D outline is already Euclidean. The 2D
  footprint is Chebyshev. Scope A leaves that split untouched. Scope B closes it, and the
  `calculateAffectedArea` polygon becomes the true shape that `calculateAffectedTiles`
  rasterizes.
- For **elevation**: neither scope closes this. `elevationGeometry.ts:104` adds the vertical
  separation to the horizontal distance. A true straight line in three dimensions would use
  the square root of the sum of all three squares. That decision is separate and belongs
  with `SSO-LOS-POLICY-PARITY-001`.

---

## 6. Counts

Non-test call sites on the 2D combat grid, by metric:

| Metric | Call sites |
|---|---|
| Chebyshev (5e grid rule) | 118 |
| Euclidean (straight line) | 9 |
| DMG 5-10-5 | 7 |
| Manhattan | 0 |

Chebyshev breakdown: `getDistance` 65, `getCharacterDistance` 24, `getCombatDistanceFeet`
9, `getChebyshevTileDistance` 3, `getCombatantToPositionDistanceFeet` 3,
`calculateChebyshevDistance` 2, inline `Math.max(Math.abs(...))` in combat code 9,
`ActionValidator.ts:634` 1, `pathfinding.ts:41` 1, `battlefieldEscape.ts:113` 1.

Euclidean breakdown: `TargetResolver` 2, `AISpellArbitrator` 2, `sphere.ts` 1,
`areaTriggerProcessing.ts:193` 1, `calculateAffectedArea` 1, `pointLineSegmentDistance` 1,
`combatAI.ts:1521` 1.

DMG 5-10-5 breakdown: `getTargetDistance` 2 call sites, plus 4 movement-cost functions and
1 reachable-tile search.

Test files that reference a grid distance helper or an area builder: **30**.

Test files with hard-coded distance expectations that a metric change would move: **14**.

1. `src/systems/actions/__tests__/ActionValidator.test.ts` (line 322)
2. `src/utils/combat/__tests__/physicsUtils_light.test.ts` (lines 11, 18, 25)
3. `src/utils/combat/__tests__/aoeCalculations.test.ts` (lines 26, 173)
4. `src/utils/combat/__tests__/aoeCalculations.gridless.test.ts` (lines 11, 12)
5. `src/utils/combat/__tests__/aoeCalculations_width.test.ts`
6. `src/utils/combat/__tests__/movementRules.test.ts` (lines 31 to 39)
7. `src/utils/combat/__tests__/combatAI.test.ts` (lines 354, 668)
8. `src/utils/spatial/__tests__/pathfindingHeuristic.test.ts` (lines 26, 34, 43)
9. `src/utils/__tests__/vectorMath.test.ts` (lines 89 to 100)
10. `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` (line 235)
11. `src/systems/spells/targeting/__tests__/sphere.test.ts` (line 29)
12. `src/systems/combat/reactions/__tests__/OpportunityAttackSystem.test.ts` (lines 60 to 73)
13. `src/systems/combat/fightInPlace/__tests__/battlefieldEscape.test.ts` (lines 55 to 65)
14. `src/components/DesignPreview/steps/scenarioControls/__tests__/areaEffectScenarioControls.test.ts` (line 141)

Also note `src/components/BattleMap/__tests__/fogModel.test.ts:67` and line 92. That file
measures Chebyshev distance to visible cells for fog. It is a threshold model, so the
numbers are tolerance bands rather than exact distances. It is not counted above.

---

## 7. Open points for Remy

1. Under Scope B, is melee reach measured in feet or in tiles? A 5-foot reach in a straight
   line covers only the four cardinal neighbors.
2. Does area of effect follow range, or stay on tiles? Scope A leaves a square blast inside
   a round range.
3. Does the vertical term stay additive, or become the third axis of a true straight line?
