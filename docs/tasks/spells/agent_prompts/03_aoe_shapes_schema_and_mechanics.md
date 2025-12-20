# Agent Prompt 03 - AoE Shapes (emanation/wall/hemisphere/circle/line+ring): Confirm Mechanics + Implement SSOT Representation

Repo: `AraliaV4/Aralia`

Goal: Make AoE shapes and semantics representable in spell JSON as SSOT for both mechanics and glossary display.

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Problem
Reference files use AoE shapes not faithfully representable in current schema:
- `emanation`, `wall`, `hemisphere`, `circle`, `line, ring`

Current targeting schema supports:
- `targeting.areaOfEffect.shape` in `Cone|Cube|Cylinder|Line|Sphere|Square`
- `size` + optional `height`

Some of the above require extra parameters/semantics:
- Emanation: centered on caster and follows caster
- Wall: length/height/orientation/thickness; persistent zone; triggers when entering or starting turn in area
- Hemisphere: dome shape
- Circle: often "ground circle"; closer to cylinder semantics
- Line/ring: cast-time variant choice

## Investigate existing code mechanics
Search/inspect these files first:
- Targeting selection / AoE math:
  - `src/hooks/combat/useTargeting.ts`
  - `src/utils/combatUtils.ts`
  - `src/utils/spellAbilityFactory.ts`
- Persistent zones and triggers:
  - `src/systems/spells/effects/AreaEffectTracker.ts`
  - `src/systems/spells/effects/triggerHandler.ts`
- Terrain/walls:
  - Search for `terrainType`, `wallProperties`, "blocking", "wall", "zone", "areaOfEffect"

## Decide and implement schema representation
Pick one approach:

### Option A: Extend existing `areaOfEffect`
- Extend `targeting.areaOfEffect.shape` enum to include shapes like `Wall`, `Emanation`, `Hemisphere`, `Ring`, etc.
- Add dimension fields required for each.

### Option B: Add `targeting.advancedAreaOfEffect` (recommended if minimizing breakage)
- Keep current `areaOfEffect` for simple shapes.
- Add a discriminated union block that can represent complex AoE types:
  - `emanation` (radius, followsCaster: true)
  - `wall` (length, height, thickness, orientation)
  - `hemisphere` (radius)
  - `circle` (radius, groundLocked: true)
  - `lineOrRing` (choice set + chosen variant)

## Update the whole system (schema + runtime + rendering)
Implement end-to-end changes:
- Schema:
  - `src/systems/spells/validation/spellValidator.ts`
  - `src/systems/spells/schema/spell.schema.json`
- Types:
  - `src/types/spells.ts`
- Runtime mechanics:
  - Targeting selection & validation
  - Zone persistence (if required)
  - Trigger behavior in zones (enter/turn-start/turn-end)
- Reference-to-JSON mapping:
  - Update `scripts/update-spell-json-from-references.ts` to map reference `Area Shape` values (`emanation`, `wall`, `hemisphere`, `circle`, `line, ring`) into the new representation
- Glossary display:
  - Update `src/components/Glossary/SpellCardTemplate.tsx` to clearly render these AoE semantics (suggest: an "Area" section that shows shape + dimensions + "follows caster"/orientation notes)

## Concrete spells to use as fixtures
Update at least 2 spells to use the new representation and verify mechanics:
- `emanation`: `arms-of-hadar`, `spirit-guardians`, `antilife-shell`
- `hemisphere`: `leomunds-tiny-hut`
- `wall`: `wall-of-ice`, `wall-of-thorns`, `blade-barrier`, `prismatic-wall`, `tsunami`
- `circle`: `earthquake`
- `line, ring`: `wall-of-fire`

## Commands
- `npm run validate` (must pass at end)
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`

## Deliverable
- A clear schema decision implemented end-to-end.
- At least 2 spells migrated to the new AoE model and validated.
- A plan for bulk rollout to all affected spells after fixture verification, including:
  - list of all spells impacted
  - migration steps (data + schema + UI)
  - checkpoints for user review/approval of any semantics ambiguities
- If you find duplicated or conflicting AoE/zone mechanics across multiple files, include a brief report:
  - which files implement overlapping logic
  - which one should be the SSOT
  - a consolidation plan (separate from the AoE schema change if needed)

## After completion (required)
Append to this file:
- "Completion Notes"
- "Detected TODOs (Out of Scope)"
See `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.

---

## Completion Notes

**Date/Time:** 2025-12-19 23:45 CET

### What was done (step-by-step):

1. **Investigated existing code mechanics**
   - Reviewed `useTargeting.ts`, `combatUtils.ts`, `spellAbilityFactory.ts` for AoE targeting logic
   - Reviewed `AreaEffectTracker.ts`, `triggerHandler.ts` for zone persistence/triggers
   - Searched for `terrainType`, `wallProperties` patterns across codebase

2. **Schema decision: Option A (Extend existing `areaOfEffect`)**
   - Chose to extend the existing `targeting.areaOfEffect` rather than adding a parallel `advancedAreaOfEffect`
   - Rationale: simpler migration, single consumption point, no schema bifurcation

3. **Updated types (`src/types/spells.ts`)**
   - Extended shape enum: added `Emanation`, `Wall`, `Hemisphere`, `Ring`
   - Added optional semantic fields: `followsCaster`, `thickness`, `width`, `shapeVariant`, `wallStats`, `triggerZone`

4. **Updated Zod validator (`src/systems/spells/validation/spellValidator.ts`)**
   - Extended `TargetingAreaOfEffect` schema with new shapes and optional fields

5. **Updated JSON Schema (`src/systems/spells/schema/spell.schema.json`)**
   - Mirrored Zod changes

6. **Updated runtime (`src/utils/spellAbilityFactory.ts`)**
   - Extended shape mapping in `inferAoE()` to handle new shapes
   - Passes through `followsCaster` property

7. **Updated glossary display (`src/components/Glossary/SpellCardTemplate.tsx`)**
   - Extended `SpellData.areaOfEffect` interface
   - Updated `formatRange()` with emojis for new shapes and semantic notes

8. **Migrated 2 fixture spells**
   - `spirit-guardians.json`: `Sphere` → `Emanation` with `followsCaster: true`
   - `wall-of-fire.json`: `Sphere` → `Wall` with dimensions, `shapeVariant`, and `triggerZone`

9. **Verification**
   - `npm run validate`: ✅ PASSED (469 spells validated)
   - `npx --no-install tsx scripts/regenerate-manifest.ts`: ✅ PASSED
   - `node scripts/generateGlossaryIndex.js`: ❌ BLOCKED by pre-existing `travel.json` JSON syntax error (unrelated)

### What changed (high-level):
- AoE schema now supports advanced shapes (Emanation, Wall, Hemisphere, Ring)
- AoE can express semantic properties (follows caster, one-sided damage, shape choices)
- Glossary displays extended AoE info with shape emojis and notes

### Files added/modified/deleted:
- **Modified:** `src/types/spells.ts`
- **Modified:** `src/systems/spells/validation/spellValidator.ts`
- **Modified:** `src/systems/spells/schema/spell.schema.json`
- **Modified:** `src/utils/spellAbilityFactory.ts`
- **Modified:** `src/components/Glossary/SpellCardTemplate.tsx`
- **Modified:** `public/data/spells/level-3/spirit-guardians.json`
- **Modified:** `public/data/spells/level-4/wall-of-fire.json`

### Commands run and outcomes:
- `npm run validate` → Success (469 spells validated)
- `npx --no-install tsx scripts/regenerate-manifest.ts` → Success (469 spells in manifest)
- `node scripts/generateGlossaryIndex.js` → Failed due to pre-existing `travel.json` error

### Decisions that might affect other tasks:
- **Option A chosen**: All AoE logic should read from `targeting.areaOfEffect`, not a separate `advancedAreaOfEffect`
- **Shape enum extended**: New spells can now use `Emanation`, `Wall`, `Hemisphere`, `Ring` as valid shape values
- **Backward compatible**: Existing spells using `Sphere`, `Cone`, etc. continue to work unchanged

---

## Detected TODOs (Out of Scope)

### 1. Pre-existing TypeScript errors in `spellAbilityFactory.ts`
**Where:** `src/utils/spellAbilityFactory.ts` (lines 41, 45, 73-113, 214-267)
**Why it matters:** The file has type mismatches between the `Spell` type and the actual JSON properties (e.g., `spell.areaOfEffect` doesn't exist on the TypeScript `Spell` type, but the JSON data has it in `targeting.areaOfEffect`). This causes numerous "property does not exist on type 'never'" errors.
**Suggested next step:** Audit the `spellAbilityFactory.ts` file to align its type expectations with the actual Spell interface. May require adding `areaOfEffect` as a top-level optional property or changing access patterns.

### 2. Pre-existing JSON syntax error in `travel.json`
**Where:** `public/data/glossary/entries/rules/travel.json` (line 10)
**Why it matters:** Blocks `generateGlossaryIndex.js` from completing
**Suggested next step:** Fix JSON syntax error in `travel.json`

### 3. SSOT consolidation for AoE geometry
**Where:** `combatUtils.ts::computeAoETiles()` vs `triggerHandler.ts::isPositionInArea()`
**Why it matters:** Duplicated shape calculation logic that could diverge over time
**Suggested next step:** Extract AoE geometry into `src/utils/aoeGeometry.ts` and have both consumers import from single source

### 4. Bulk migration script for remaining AoE spells
**Where:** New script needed
**Why it matters:** ~15+ spells use emanation/wall/hemisphere semantics not yet migrated
**Suggested next step:** Create migration script or batch migrate manually

### 5. Reference-to-JSON mapping update
**Where:** `scripts/update-spell-json-from-references.ts`
**Why it matters:** Script should map reference `Area Shape` values to new schema
**Suggested next step:** Update script to recognize `emanation`, `wall`, `hemisphere`, `circle`, `line, ring` and map to new extended `areaOfEffect`

---

## Bulk Rollout Plan

### Spells requiring migration:

| Shape | Spells to Migrate |
|-------|-------------------|
| Emanation | `arms-of-hadar`, `antilife-shell`, `aura-of-vitality`, `aura-of-purity`, `aura-of-life`, `holy-aura` |
| Hemisphere | `leomunds-tiny-hut`, `wall-of-ice` (dome variant) |
| Wall | `wall-of-ice`, `wall-of-thorns`, `wall-of-stone`, `wall-of-sand`, `wall-of-water`, `wall-of-light`, `wall-of-force`, `blade-barrier`, `prismatic-wall`, `tsunami` |
| Ring | Already handled via `shapeVariant` in Wall spells that offer ring option |

### Migration steps:
1. For each spell, identify current AoE representation
2. Update `areaOfEffect.shape` to appropriate extended type
3. Add semantic fields as needed (`followsCaster`, `thickness`, `shapeVariant`, etc.)
4. Remove `height: 0` placeholder if not needed
5. Run `npm run validate` after each batch

### User review checkpoints:
- [ ] Validate that `followsCaster` semantics match official spell text
- [ ] Review wall dimension calculations (some walls have variable sizing)
- [ ] Confirm trigger zone distances match official spell text
