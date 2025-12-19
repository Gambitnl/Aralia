# Spell System Overhaul - Outstanding TODOs

## High Priority

### flat-to-nested-migration
**Issue**: 214 legacy spell JSONs exist in flat `public/data/spells/*.json` while new spells use nested `public/data/spells/level-{N}/` structure.

**Risk**: Dual directory structure may cause loading inconsistencies.

**Action Required**:
1. Audit which flat files are duplicates of nested files
2. Create migration script to move remaining flat files to level-N folders
3. Update manifest generation to handle transition
4. Delete flat files once nested migration complete

**Related Files**:
- `src/context/SpellContext.tsx` - spell loading logic
- `public/data/spells_manifest.json` - spell manifest

---

### status-level-0-sync
**Issue**: `STATUS_LEVEL_0.md` shows ~38 cantrips but `level-0/` folder has 44 files. Table is out of sync.

**Action Required**:
1. Run diff between STATUS table and actual files
2. Add missing cantrips to table
3. Update status for cantrips already migrated

**Related Files**:
- `docs/spells/STATUS_LEVEL_0.md`
- `public/data/spells/level-0/*.json`

---

### area-entry-exit-triggers
**Issue**: Zone effects still use simplified entry/exit handling; needs first-per-turn gating and exit handling aligned with targeting geometry.

**Action Required**:
1. Replace `isPositionInArea` logic with direction-aware AoE (see geometry-zone-aoe-fidelity).
2. Add exit detection and first-per-turn enforcement via an AreaEffectTracker.
3. Migrate `grease.json`, `fog-cloud.json`, `entangle.json` to entry/exit/end-turn triggers.

**Related Files**:
- `src/systems/spells/effects/triggerHandler.ts:157`

---

### repeat-save-system
**Issue**: Repeat/save modifiers (end-of-turn, on-damage, size-based advantage) are prose-only; schema/runtime do not resurface them.

**Action Required**:
1. Add `repeatSave` and expanded `saveModifiers` to `STATUS_CONDITION` schema.
2. Track "damaged this turn" and prompt repeat saves at the correct timings.
3. Add on-action escape handling (wrathful smite) and migrate laugh/hold/ensnaring spells.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/effects/triggerHandler.ts`

---

### spell-executor-integration
**Issue**: Orchestration layer (`SpellExecutor`) never built; `useAbilitySystem` still relies on legacy factory inference.

**Action Required**: Implement `SpellExecutor` to coordinate targeting/mechanics/command execution and refactor ability system to use it; add integration tests.

**Related Files**:
- `src/systems/spells/integration/SpellExecutor.ts` (new)
- `src/hooks/useAbilitySystem.ts`

---

### los-and-cover
**Issue**: Line-of-sight uses permissive checks and ignores cover; targeting can shoot through walls.

**Action Required**: Add raycast-based LoS with obstacle data and cover calculation (+2/+5 AC/total cover) in TargetResolver.

**Related Files**:
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/lineOfSight.ts`

---

### concentration-effect-link
**Issue**: Concentration commands don't track effect IDs; breaking concentration leaves buffs/debuffs active.

**Action Required**: Pre-generate/collect effect IDs in SpellCommandFactory, store on StartConcentration, and remove on BreakConcentration.

**Related Files**:
- `src/commands/effects/ConcentrationCommands.ts`
- `src/commands/factory/SpellCommandFactory.ts`

---

### spell-data-validation-fixes
**Issue**: Validator reports known broken spell JSONs (find-familiar, mage-armor, shield, shield-of-faith, tensers-floating-disk, unseen-servant).

**Action Required**: Fix schema violations and rerun validation.

**Related Files**:
- `public/data/spells/*.json`
- `scripts/validate-data.ts`

---

## Medium Priority

### armor-of-agathys-conditional-trigger
**Issue**: Armor of Agathys retaliation damage uses `on_target_attack` trigger but per D&D 5e rules, cold damage only occurs on melee hits while temp HP remains active.

**Current State**: ✅ Has DAMAGE effect with `on_target_attack` trigger and slot-level scaling.

**Enhancement Needed**: Add condition to verify:
1. Attack was melee (not ranged)
2. Attack hit (not miss)
3. Caster still has temp HP from this spell

**Related Files**:
- `public/data/spells/level-1/armor-of-agathys.json:52-63`
- `src/systems/spells/validation/spellValidator.ts` - may need new trigger type

---

### geometry-zone-aoe-fidelity
**Issue**: Zone AoE checks in combat triggers use simplified line/cone math without direction, diverging from targeting preview geometry.

**Action Required**: Replace `isPositionInArea` line/cone handling with direction-aware AoECalculator logic so on_enter/on_end triggers match targeting footprints.

**Related Files**:
- `src/systems/spells/effects/triggerHandler.ts:157`

---

### geometry-distance-elevation-and-size
**Issue**: Target range checks ignore elevation, sub-grid coordinates, and creature size; large/flying targets can fail/over-pass range validation.

**Action Required**: Extend distance calculation to use elevation (z), support fractional coordinates, and measure to nearest edge of target footprint.

**Related Files**:
- `src/systems/spells/targeting/TargetResolver.ts:81`

---

### geometry-cylinder-height
**Issue**: Cylinder AoE uses sphere math and ignores vertical extent.

**Action Required**: Add height support and 3D checks for cylinders once elevation is modeled.

**Related Files**:
- `src/systems/spells/targeting/gridAlgorithms/cylinder.ts:14`

---

### geometry-cube-centering
**Issue**: Cube AoE centering for even vs odd sizes is biased (top-left) and may not match 5e corner/center rules (e.g., 10ft vs 15ft cubes).

**Action Required**: Define and implement centering rules per 5e (corner for even sizes; centered for odd), and adjust tile generation accordingly.

**Related Files**:
- `src/systems/spells/targeting/gridAlgorithms/cube.ts:15`

---

### creature-type-target-filter
**Issue**: Effects cannot filter by creature type/size/alignment; targeting filters are prose-only.

**Action Required**: Add `targetFilter` to `EffectCondition`, ensure creature data has types, and gate effects in the command pipeline.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/commands/factory/SpellCommandFactory.ts`

---

### ac-mechanics-structured
**Issue**: AC buffs/minimums/base-AC overrides and reaction AC (Shield) are unmodeled in DEFENSIVE effects.

**Action Required**: Add AC fields (`acBonus`, `baseACFormula`, `acMinimum`, `reactionTrigger`, restrictions) to schema and wire into AC calc/reaction flow; migrate mage-armor/shield/shield-of-faith/barkskin.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/combat` (AC calc)
- `src/commands/effects/DefensiveCommand.ts`

---

### dynamic-terrain-mutations
**Issue**: TerrainCommand is stubbed; map tiles are not mutated for grease/web/spike-growth, so movement/cost/visuals don't change.

**Action Required**: Add map mutation layer and update TerrainCommand to apply tile effects and movement cost; render overlays.

**Related Files**:
- `src/commands/effects/TerrainCommand.ts`
- `src/types/combat.ts` (BattleMapTile)

---

### object-targeting-support
**Issue**: `TargetResolver` rejects object targets; spells cannot target doors/objects.

**Action Required**: Add interactive objects to CombatState and allow `objects` filter in targeting logic with proper stats (AC/HP/immunities).

**Related Files**:
- `src/systems/spells/targeting/TargetResolver.ts`

---

### ai-control-overrides
**Issue**: Control/command effects set status text but AI ignores directives (flee/grovel/halt).

**Action Required**: Standardize AI override states and enforce in combatAI planning; ensure UtilityCommand applies parsable flags.

**Related Files**:
- `src/commands/effects/UtilityCommand.ts`
- `src/utils/combat/combatAI.ts`

---

### level-1-gap-backlog
**Issue**: Level 1 gaps include material costs, vision/obscurement, behavior/charm logic, ongoing ticks, forced movement/concentration links, summons/familiar handling, buff stacking/duration UI, ritual casting flow, and reaction triggers.

**Action Required**: Break out targeted tasks for these mechanics and wire into combat/AI/casting flows.

**Related Files**:
- Various (former LEVEL-1-GAPS summary)

---

### level-2-gap-backlog
**Issue**: Level 2 gaps mirror Level 1 with added needs (material consumption, sight/illusion adjudication, emotional/deception modeling, ongoing hazards, link/shared effects, illusion verification, multi-target slot scaling UI).

**Action Required**: Plan and implement per-mechanic tasks across casting/AI/targeting.

**Related Files**:
- Various (former LEVEL-2-GAPS summary)

---

## Low Priority (Future)

### summoning-system
**Issue**: SUMMONING effect schema/engine/UI not implemented; familiars/servants/disks/conjures are prose-only.

**Action Required**: Define SUMMONING schema, build SummonedEntityManager and command economy, and migrate summon spells.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/combat` / `src/hooks/useAbilitySystem.ts`

---

### integration-test-automation
**Issue**: STATUS files have "Integration Status" column but no automated test flow exists.

**Proposal**: Create test runner that:
1. Loads spell JSON
2. Validates via `spellValidator.ts`
3. Tests `SpellContext` loading
4. Tests `spellAbilityFactory` conversion
5. Auto-updates Integration Status in STATUS files

**Related Files**:
- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- `src/utils/spellAbilityFactory.ts`

---

## Completed

- [x] Fix SPELL_TEMPLATE.json references (archived to `archive/SPELL_TEMPLATE.json`)
- [x] Update FINAL_SUMMARY.md broken link
- [x] Update TASK_STRATEGY_UPDATE.md references
- [x] Absorb Elements now has DAMAGE effect with `on_attack_hit` trigger
- [x] Armor of Agathys now has DAMAGE effect (trigger needs refinement per above)
- [x] Per-hit riders implemented (GAP-1)
- [x] Reactive triggers implemented (GAP-2)

---

*Last updated: Gap consolidation pass*
