# Combat condition palette unification (GG-229, GG-227)

Deepdive report for Agora task agora-8e37.
Written 2026-09-20 by dd-condpal (ManSui).
Read-only research. No source file was changed.
Planning surface: Plan Map topic `combat-3d-visual-quality` (`public/planmap/topics.json`), gap rows GG-229 and GG-227 in `docs/projects/GLOBAL_GAPS.md`.

## 1. Verdict

Four condition-visual tables exist, not two, and no two of them agree.
`conditionBadges.tsx` holds 18 chip colors, `actorStatusShading.ts` holds 10 body tints, `types/visuals.ts` holds 19 icon-plus-color rows, and `combatUtils.ts` plus `BattleMapOverlay.tsx` hold two copies of a five-case emoji switch.
None of the four keys off the canonical condition enum in `src/types/conditions.ts`, so the engine can apply a condition that every visual table misses.
The WebGPU token in `BattleMap3DGpuScene.tsx` reads no condition at all; it has a death fade only, so GG-227's "no defeat cue" claim is now half stale.
The fix is one plain module, `src/utils/visuals/conditionPalette.ts`, keyed by the condition enum and read by all six consumers.
Section 5 gives the module shape and a per-consumer migration order. Code lands in a later wave.

## 2. Inventory

### 2.1 src/components/BattleMap/characters/characterActor/conditionBadges.tsx - 121 lines

Renders the 3D actor's chip strip inside a drei `<Html>`.
Holds `CONDITION_BADGES`, a `Record<string, {label, color}>` with 18 rows (lines 20-39).
Lookup is an exact, case-sensitive object read (line 56). An unknown name falls back to its first two letters in `#e2e8f0`.

Callers (grep `ConditionBadgeRow`):
- `src/components/BattleMap/characters/characterActor/CharacterActor.tsx:44` imports it, `:270` renders it.
- `src/components/BattleMap/characters/characterActor/conditionBadges.d.ts` is a tracked, hand-kept declaration twin.
- `src/components/BattleMap/characters/__tests__/CharacterActor.conditions.test.tsx:66-105` pins three behaviors.

No other file imports it.

### 2.2 src/components/BattleMap/characters/actorStatusShading.ts - 138 lines

A pure lookup. It turns a `CombatCharacter` into six shader numbers: `rimColor`, `rimIntensity`, `rimPower`, `tintColor`, `tintStrength`, `desaturate` (lines 29-42).
Holds `CONDITION_SHADING`, a 10-row ordered array (lines 85-105). Order is severity: the first match wins.
Lookup is a lowercase substring test (line 128), not an exact match.
Its own header (lines 16-20 and line 82) says the colors "echo" the chip colors. Finding F1 shows one of them does not.

Callers (grep `resolveActorBodyShading`):
- `src/components/BattleMap/characters/characterActor/CharacterActor.tsx:50,133` - the R3F 3D actor.
- `src/components/BattleMap/CharacterToken.tsx:53,678` - the DOM 2D token.

Two of the three token renderers therefore agree on the body cue.

### 2.3 src/components/BattleMap/BattleMap3DGpuScene.tsx - 1,065 lines

The experimental WebGPU battle-map path behind `?gpu=1`.
Its own `CharacterToken` starts at line 596. It reads `character.currentHP`, `character.team` and `character.position` only.
It gives four cues: a team-hued ground ring, ring opacity from the HP fraction (line 633), selection and active rings, and a death fade (line 644 calls `setEntityDeathFade`).
It reads neither `character.conditions` nor `character.statusEffects`. It does not import `resolveActorBodyShading`.
Line 857 lists "defense/condition badges" on the on-screen MISSING panel, so the gap is declared, not hidden.

The tint hook already exists on this path. `src/systems/entities3d/three/gpu/toonNodes.ts:262-266` builds a `death` uniform and stamps it into `material.userData` under `DEATH_FADE_UNIFORM_KEY` (line 145). `src/systems/entities3d/three/gpu/gpuMaterialSwap.ts:167` drives it. A condition tint needs the same pattern with two more uniforms.

### 2.4 src/types/visuals.ts - 632 lines (the third table)

`STATUS_VISUALS` at line 455 is a 19-row `Record<string, StatusVisualSpec>` with `id`, `label`, `icon` (emoji), `color` and `description`.
Keys are lowercase. It adds three non-conditions: `taunted`, `blessed`, `bane`.
`getStatusVisual` at line 494 lowercases and falls back to `DEFAULT_STATUS_VISUAL` (line 480).

Callers:
- `src/commands/effects/StatusConditionCommand.ts:30,865` - the engine stamps `getStatusVisual(name).icon` onto every `StatusEffect` it creates.
- `src/types/__tests__/visuals.test.ts` - unit tests.

No render surface reads it directly. It reaches the screen only through the icon it stamps onto a `StatusEffect`.

### 2.5 src/utils/combat/combatUtils.ts:887 and src/components/BattleMap/BattleMapOverlay.tsx:96 (the fourth table, twice)

`getStatusEffectIcon` (`combatUtils.ts:887`) returns `effect.icon` if set, else one of five emoji by `effect.type`.
`getOverlayStatusEffectIcon` (`BattleMapOverlay.tsx:96`) is the same function with ASCII glyphs (`+`, `!`, `DOT`, `HOT`, `?`) instead of emoji. It is used once, at line 673.

Callers of `getStatusEffectIcon`: `src/components/BattleMap/CharacterToken.tsx:47,237,254` only.

### 2.6 src/components/BattleMap/CharacterToken.tsx - 1,058 lines (the 2D token)

`buildStatusMarkers` (lines 224-259) merges `conditions[]` then `statusEffects[]`, deduped lowercase, conditions first.
The status row draws at most three chips plus a `+N` overflow (lines 998-1032, cap at line 205).
The body wash comes from `resolveActorBodyShading` (line 678) and converts the numeric tint to CSS at lines 681-683.

### 2.7 Canonical name source: src/types/conditions.ts - 197 lines

`ConditionType` (line 8) is the enum: 16 PascalCase names, 15 standard 5e plus `Ignited`.
`ConditionDefinitions` (line 47) carries the rules text for each.
`ConditionName` (`src/types/spellEffectTypes.ts:55`) widens it with `"Slowed"`, `"Slasher Slow"` and `"Disadvantage on attacks vs. caster"`.
`ActiveCondition.name` (`src/types/combat.ts:449`) is `ConditionName | string`, so any string can arrive.

No visual table imports `ConditionType`.

## 3. Findings

**F1. The Ignited color disagreement is real.**
`conditionBadges.tsx:36` gives Ignited the rose `#fb7185`. `actorStatusShading.ts:89` gives it the orange `0xff6a1a`. A burning creature shows a pink chip over an orange body. Five other pairs do agree exactly: Petrified, Paralyzed, Poisoned, Charmed and Stunned (`conditionBadges.tsx:30,29,31,22,34` against `actorStatusShading.ts:93,98,100,102,104`).

**F2. Twelve chip conditions have no body cue.**
Blinded, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Prone, Restrained, Unconscious, Slowed and Slasher Slow appear in `CONDITION_BADGES` but not in `CONDITION_SHADING`. At tactical zoom a 14-pixel chip is unreadable, which is the exact case `actorStatusShading.ts` was written for (its header, lines 16-20).

**F3. The highest-volume monster conditions are in that twelve.**
A tally of `src/data/monsters.generated.ts` gives Charmed 34, Invisible 26, Restrained 18, Incapacitated 14, Paralyzed 11, Blinded 9, Blessed 8. Invisible, Restrained, Incapacitated and Blinded get no body cue. Only Charmed and Paralyzed do.

**F4. Four shading keys are dead in production.**
`burning`, `on fire` (`actorStatusShading.ts:90-91`) and `chilled` (line 96) are matched by no production data. `frozen` (line 95) appears only in the `?actorstatus=1` fixture (`src/components/DesignPreview/steps/PreviewBattleMap.tsx:47`) and one spell test. The fixture therefore proves a code path that no spell can reach.

**F5. Two-letter chip labels collide, and the collisions hit real data.**
The fallback at `conditionBadges.tsx:56-59` takes the first two letters. Against the monster tally that gives: Blessed to `BL`, which is Blinded's label (`:21`); Stable to `ST`, which is Stunned's label (`:34`); Resurrection Ordeal to `RE`, which is Restrained's label (`:33`). Two more collide against the shading keys: Frozen to `FR` equals Frightened, Chilled to `CH` equals Charmed. Slowed and Slasher Slow already share `SL` inside the table (`:37-38`).

**F6. Lookup rules disagree between the two tables.**
Chips use an exact, case-sensitive key (`conditionBadges.tsx:56`). Shading lowercases and substring-matches (`actorStatusShading.ts:128`). A condition written `poisoned` in lowercase gets an orange body tint and a grey fallback chip at the same time.

**F7. Every 2D condition chip shows the same emoji.**
`CharacterToken.tsx:237` builds a synthetic `StatusEffect` with `type: "debuff"` and no `icon`, then calls `getStatusEffectIcon`. That switch has no condition branch, so it returns the skull for all of them (`combatUtils.ts:890-892`). Poisoned, Restrained and Blinded are one glyph on the 2D board. The per-condition emoji in `STATUS_VISUALS` never reach this path because `conditions[]` entries carry no `icon` field.

**F8. `STATUS_VISUALS` is a third, unrelated color set.**
Blinded is `#9CA3AF` there (`types/visuals.ts:456`) against `#94a3b8` on the chip. Charmed is `#EC4899` against `#f472b6`. Poisoned is `#10B981` against `#4ade80`. Paralyzed is the amber `#FBBF24` against the cyan `#22d3ee`, which is a hue disagreement, not a shade one.

**F9. `getStatusEffectIcon` is duplicated with different glyphs.**
`combatUtils.ts:887` and `BattleMapOverlay.tsx:96` are the same five-case switch. One returns emoji, one returns ASCII. Neither surface uses the other.

**F10. The WebGPU token drops every condition.**
`BattleMap3DGpuScene.tsx:596-707` reads no condition field. GG-227 is confirmed for conditions. Its "0 HP renders as healthy" half is now stale: line 644 drives `setEntityDeathFade`, and `toonNodes.ts:262-265` mixes the body toward a 0.55 grey corpse color.

**F11. A fourth renderer exists and is also blind.**
`src/components/BattleMap/pixi/tokenViewModel.ts` (48 lines) and `PixiBattleBoard.tsx` (423 lines) hold no condition or status code. The Pixi board is a prototype behind `?pixiboard=1`, so it is a future consumer, not a current bug.

**F12. `conditionBadges.d.ts` is a tracked, hand-kept twin.**
Any export change to `conditionBadges.tsx` must be mirrored there. Four sibling files in `characterActor/` carry the same pattern.

**F13. Severity order is defined only in one table.**
`CONDITION_SHADING` is an ordered array whose first match wins (`actorStatusShading.ts:79-80,127-131`). The chip row has no order; it draws in `conditions[]` order. The 2D row caps at three and hides the rest behind `+N` (`CharacterToken.tsx:205,1015`), so the hidden markers are chosen by array position, not by importance.

## 4. Decisions for Remy

### D1. Which color set becomes canonical?

The three sets disagree. One must win before the module is written.

Options:
1. The chip set in `conditionBadges.tsx` (18 rows, Tailwind 300-400 tones, tuned against the dark 3D chip background).
2. The `STATUS_VISUALS` set in `types/visuals.ts` (19 rows, Tailwind 500-900 tones, tuned for light UI text).
3. A new set drawn fresh against both the chip background and the body tint.

Recommendation: option 1. It is the larger and the newer table, it already agrees with five of the ten body tints, and its lighter tones survive both the dark chip disc and a body-tint multiply. Option 2's deep tones (Unconscious `#1F2937`, Taunted `#7F1D1D`) go black on a dark chip.

### D2. Emoji or two-letter chips as the one glyph system?

The 2D row draws emoji, the 3D row draws two-letter chips, and the emoji never reach conditions anyway (F7).

Options:
1. Two-letter chips on both surfaces. One glyph system, no font risk, but F5's collisions must be fixed by hand-authored labels.
2. Emoji on both surfaces. Readable at a glance, but emoji render differently per platform and carry no color of their own.
3. Keep both: emoji on the 2D DOM token, letters on the 3D `<Html>` chip, with one shared table supplying both fields.

Recommendation: option 3. The shared module carries `chipLabel` and `icon` side by side, so the two surfaces stay different by design instead of by accident. This also keeps `StatusConditionCommand`'s log icons working unchanged.

### D3. Do the dead shading keys stay?

`burning`, `on fire` and `chilled` match nothing in production (F4).

Options:
1. Delete them and keep `frozen` as a fixture-only alias.
2. Keep all four as declared aliases of `Ignited` and of a new `Frozen` condition.
3. Promote Frozen and Chilled to real members of `ConditionType` and give a spell or hazard that applies them.

Recommendation: option 2 for the unification wave, then option 3 as its own gameplay task. Deletion would silently change the `?actorstatus=1` showcase, which is the only visual proof surface this work has.

### D4. Does the WebGPU path get the condition tint in this wave?

GG-227 needs two new uniforms in `toonNodes.ts` and a per-frame write in the GPU scene.

Options:
1. Yes. Ship the palette and the GPU tint together, so all three renderers land in agreement.
2. No. Ship the palette first across the two WebGL surfaces, then the GPU tint as a follow-up.

Recommendation: option 2. The GPU tint needs a real-GPU eyeball, because the headless path shows only the fail-fast pane. The palette work can be proven in unit tests plus a WebGL capture. A split keeps the palette change unblocked.

## 5. Follow-up work

### T1. Author the shared condition palette module

Module path: `src/utils/visuals/conditionPalette.ts`.
It sits beside the existing `src/utils/visuals/combatIconVisuals.ts`. It is plain TypeScript: no React, no three, no drei, so the engine, the DOM token, the R3F actor and the WebGPU scene can all import it.

Exported shape:

```ts
export interface ConditionVisual {
  /** Canonical name, spelled as ConditionType spells it. */
  name: string;
  /** Lowercase lookup key. */
  key: string;
  /** Two-letter chip label. Unique across the whole table. */
  chipLabel: string;
  /** Chip stroke and text color, CSS hex string. */
  chipColor: string;
  /** Emoji or glyph for the 2D row and the combat log. */
  icon: string;
  /** Body tint as a three hex number, or null for no body cue. */
  tintColor: number | null;
  /** How far the body moves toward tintColor, 0 to 1. Zero when tintColor is null. */
  tintStrength: number;
  /** How far the body moves toward greyscale, 0 to 1. */
  desaturate: number;
  /** Lower wins when a character carries several conditions. */
  severity: number;
  /** Alternate spellings that resolve to this entry. */
  aliases?: readonly string[];
}

export const CONDITION_VISUALS: Readonly<Record<string, ConditionVisual>>;
export const DEFAULT_CONDITION_VISUAL: ConditionVisual;

/** Exact key, then alias, then the two-letter fallback. Never throws. */
export function resolveConditionVisual(name: string): ConditionVisual;

/** Lowest severity among the names that carry a tint, or null. */
export function resolveDominantCondition(names: readonly string[]): ConditionVisual | null;
```

Rules the module must hold:
- Every `ConditionType` member has a row. A compile-time `Record<ConditionType, ConditionVisual>` slice proves it.
- `chipLabel` is unique. A test asserts it.
- Lookup is one rule for all callers: lowercase the input, read the key map, then the alias map, then fall back.
- Substring matching is retired. Aliases replace it.

Migration order is T2 through T7 below, one task per consumer.

### T2. Move `conditionBadges.tsx` onto the palette
Delete `CONDITION_BADGES`. Call `resolveConditionVisual(name)` for `chipLabel` and `chipColor`. Update `conditionBadges.d.ts` if the export surface moves.
Acceptance: `CharacterActor.conditions.test.tsx` passes unchanged; the Poisoned chip still reads `PO`; an unknown name still shows two letters.

### T3. Move `actorStatusShading.ts` onto the palette
Delete `CONDITION_SHADING`. Keep `BASE` and `DEFEATED`, because the rim numbers are shading, not palette. Replace the substring loop with `resolveDominantCondition(statusNames(character))`.
Acceptance: a poisoned-and-burning character still resolves to the burning tint; defeat still beats every condition; a new test asserts every `CONDITION_VISUALS` key returns either a tint or an explicit `tintColor: null`.

### T4. Give the 2D token per-condition icons and chip colors
In `CharacterToken.tsx:228-246`, replace the synthetic `StatusEffect` and the `getStatusEffectIcon` call with `resolveConditionVisual(name)`. Use `.icon` for the glyph and `.chipColor` for the chip border.
Acceptance: Poisoned, Restrained and Blinded show three different glyphs on the 2D board, proven in `CharacterToken.test.tsx`.

### T5. Fold the condition rows out of `STATUS_VISUALS`
Keep only the non-conditions (`taunted`, `blessed`, `bane`) in `types/visuals.ts`. Have `getStatusVisual` delegate a condition name to `resolveConditionVisual` and map the result into a `StatusVisualSpec`.
Acceptance: `src/types/__tests__/visuals.test.ts` passes; `StatusConditionCommand` still stamps an icon on every effect it creates.

### T6. Retire the duplicate icon switch
Delete `getOverlayStatusEffectIcon` from `BattleMapOverlay.tsx:96`. Have line 673 call the shared resolver. Decide whether the overlay keeps ASCII glyphs; if it does, add an `overlayGlyph` field rather than a second function.
Acceptance: no two files hold a five-case status-icon switch; `grep -rn "case 'dot':" src/` returns one hit.

### T7. Give the WebGPU token the condition tint (GG-227)
Add `CONDITION_TINT_UNIFORM_KEY` and `CONDITION_TINT_STRENGTH_UNIFORM_KEY` beside `DEATH_FADE_UNIFORM_KEY` in `toonNodes.ts:145`. Mix the tint into `material.colorNode` before the death mix. Add a `setEntityConditionTint` driver in `gpuMaterialSwap.ts` beside `setEntityDeathFade:167`. Call it from the `BattleMap3DGpuScene.tsx` CharacterToken with `resolveDominantCondition`.
Acceptance: a real-GPU `?gpu=1` capture of `?actorstatus=1` where Poisoned Skulker, Burning Magus, Frozen Brute and the 0 HP Fallen Reaver are all distinct from Healthy Control.

### T8. Correct the stale half of GG-227
`docs/projects/GLOBAL_GAPS.md:69` says the WebGPU token draws no defeat cue. `BattleMap3DGpuScene.tsx:644` drives a death fade today.
Acceptance: the GG-227 row says "no condition cue" and names the death fade as present.

### T9. Fix the chip-label collisions
Hand-author `chipLabel` for the names that collide today: Blessed, Stable, Resurrection Ordeal, Frozen, Chilled (F5).
Acceptance: a unit test asserts every `chipLabel` in `CONDITION_VISUALS` is unique.

## 6. Workflow gaps

Three, all filed in `tools/agora/WORKFLOW_GAPS.md`.

**WF-G189 - `task edit --append-body` is documented but broken.**
The help text prints `[--append-body "..."]`. Every call returns `400 nothing to edit: every named field already has that value`. It failed on seven task ids in a row. A direct `PATCH /tasks/<id>` with the full concatenated body returned 200 for all seven, so only the append path is broken. The workaround is a raw fetch with the saved bearer token, which loses any edit another agent made between the read and the write.

**WF-G191 - `task lint` cannot acknowledge a path the task creates.**
`agora-f821.10` creates `src/utils/visuals/conditionPalette.ts`. Its body opens with a `CREATES (new file, does not exist yet, this task creates it):` line. `task lint` still exits 1 and advises "say in the body which of the rest the task is going to create", which the body already does. Eight of the nine tasks filed here cannot lint clean for this reason. Only `agora-f821.36`, which creates nothing, linted clean.

**WF-G194 - `--category` takes any string and nothing lists the valid values.**
`task new --help` enumerates no categories. `combat` was copied off the parent task `agora-8e37`. `docs` was guessed and accepted silently. Nothing reports whether a category is existing or newly invented, and categories are how the orchestrator drains the board.

## 7. Filed artifacts

Nine follow-up tasks, all on campaign `agora-f821`, ref `docs/deepdives/combat-condition-palette-unification.md`:

| Task | Section |
|---|---|
| `agora-f821.10` | T1 - author the palette module (all others depend on it) |
| `agora-f821.23` | T2 - `conditionBadges.tsx` |
| `agora-f821.24` | T3 - `actorStatusShading.ts` |
| `agora-f821.29` | T4 - 2D token icons |
| `agora-f821.30` | T5 - `STATUS_VISUALS` |
| `agora-f821.31` | T6 - duplicate icon switch |
| `agora-f821.35` | T7 - WebGPU condition tint (GG-227) |
| `agora-f821.36` | T8 - correct the stale half of GG-227 |
| `agora-f821.37` | T9 - chip-label collisions |

Workflow gaps: WF-G189, WF-G191, WF-G194.
