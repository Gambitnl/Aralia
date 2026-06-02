# Spell System Overhaul - Outstanding TODOs

> **Status Note (2026-03-11):**
> - this is the live mixed technical backlog for the spell-overhaul area
> - some entries below were freshly spot-verified during the current docs pass, while others remain inherited backlog items that still need engineering re-verification before implementation
> - where a claim was known to be stale against the current repo, it has been corrected or demoted to historical context

## High Priority

### status-level-0-sync
**Issue**: Completed 2026-06-01. `STATUS_LEVEL_0.md` had stale cantrip inventory wording; current folder and manifest evidence both show 43 level-0 spells.

**Action Required**:
1. No further action for this status-count row.
2. Keep per-cantrip gameplay verification separate from inventory-count sync.
3. Update status for cantrips already migrated

**Related Files**:
- `docs/spells/STATUS_LEVEL_0.md`
- `public/data/spells/level-0/*.json`

---

### area-entry-exit-triggers
**Issue**: Zone effects are partially implemented, but area-trigger behavior still needs consolidation and proof. Current evidence shows entry/exit/end-turn paths and some first-per-turn tests already exist; the remaining risks are duplicate trigger paths, missing `on_move_in_area` behavior tests, simplified containment geometry, and stale spell-level migration notes.

**Action Required**:
1. Verification pending: `AreaEffectTracker` now delegates entry/exit/end-turn effect selection to exported `triggerHandler` helpers while keeping tracker-owned events and movement-within behavior. Run focused area tests before marking the source-of-truth gap done.
2. Add focused `processMovementWithin` tests for Spike Growth-style movement-through-area behavior.
3. Verification pending: `isPositionInArea` now has focused parity coverage against `AoECalculator.containsTile(...)` for cube, sphere, cone, and line zones; run the focused trigger-handler test before closing geometry-zone-aoe-fidelity.
4. Re-audit completed 2026-06-01: `grease.json` and `entangle.json` already carry immediate, `on_enter_area`, and `on_end_turn_in_area` condition rows; `fog-cloud.json` is an obscuring terrain zone and does not need automatic save/damage trigger migration.

**Related Files**:
- `src/systems/spells/effects/AreaEffectTracker.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`
- `src/systems/spells/effects/__tests__/triggerHandler.test.ts`
- `docs/tasks/spell-system-overhaul/GAPS.md` (`SSO-AREA-ENTRY-EXIT-001`, `SSO-AREA-MOVE-WITHIN-COVERAGE-001`, `SSO-AOE-CONTAINMENT-PARITY-001`)

---

### repeat-save-system
**Issue**: Repeat saves are no longer schema-only TODOs. Metadata is preserved onto runtime status effects, and primary `turn_start`, `turn_end`, `on_damage`, and `on_action` timings have source/test evidence. `additionalTimings`, scheduled/immediate `after_forced_movement`, progression success counters, and known progression failure outcomes now have bounded implementation slices but still need focused verification. Remaining open gap is migrated-spell inventory proof.

**Action Required**:
1. Implementation slice added; verification pending. Run the focused repeat-save test that covers Tasha's Hideous Laughter-style `turn_end` plus `on_damage` saves, then fix any failures without widening into forced-movement or progression work.
2. Implementation slices added; verification pending. Run focused scheduled and immediate forced-movement repeat-save proofs for Compulsion-style movement, then fix failures in the relevant bridge without conflating the two paths.
3. Implementation slice added; verification pending. Run the focused repeat-save progression test for Flesh to Stone-style three-success thresholds, then fix any counter/removal failures.
4. Implementation slice added; verification pending. Run focused failure-outcome tests for Petrified transformation and Contagion's seven-day Poisoned duration lock.
5. Refreshed static inventory still shows 52 repeat-save entries across 45 spell files, with no new unsupported metadata families beyond the split rows already tracked.
6. Run focused repeat-save family tests when verification is allowed before closing the repeat-save rows.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/hooks/combat/engine/useCombatEngine.ts`
- `src/hooks/combat/useTurnManager.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/commands/effects/StatusConditionCommand.ts`

---

### spell-executor-integration
**Issue**: Status refreshed 2026-06-01. A dedicated `SpellExecutor` file still does not exist, but rich combat execution is no longer simply relying on `spellAbilityFactory` inference: `useAbilitySystem` calls `SpellCommandFactory.createCommands(...)` and executes the resulting commands through `CommandExecutor`. The remaining issue is orchestration ownership and parity between the rich command path and the separate spell-to-ability preview/bridge path.

**Action Required**: Do not create a broad `SpellExecutor` just because the old plan named one. First decide whether orchestration should become a dedicated coordinator or remain split between `useAbilitySystem`, `SpellCommandFactory`, scheduled-effect registration, and the ability-preview bridge. Track the concrete follow-ups as `SSO-ABILITY-BRIDGE-PARITY-001` and `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`. Test-first slice added for `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`; run the focused `useAbilitySystem` test that expects current `mapData` to reach command creation, then replace or justify the empty game-state placeholder. Test-first slice added for `SSO-ABILITY-BRIDGE-PARITY-001`; run the focused `spellAbilityFactory` mode-choice test, then preserve mode-choice metadata or route preview/selection through original spell metadata consistently.

**Related Files**:
- `src/systems/spells/integration/SpellExecutor.ts` (new)
- `src/hooks/useAbilitySystem.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/utils/character/spellAbilityFactory.ts`

---

### los-and-cover
**Issue**: The older "LoS not implemented" framing is stale. Line of sight is partially wired through resolver, UI validation, teleport destination previews, and other runtime callers. Cover classification is also partly implemented through `calculateCover(...)` and weapon/ability attack AC bonuses, but spell-save cover modifiers, cover-bypass metadata, total-cover legality, and LoS policy are still not unified.

**Action Required**: Split work into LoS policy parity, spell-save cover adoption, total-cover legality, and 2D/3D map feedback. Do not rebuild LoS or cover from scratch before deciding how the existing `blocksLoS` utility, `calculateCover(...)`, `providesCover` tile hint, cover-bypass save metadata, and combat-map targeting feedback should fit together. Test-first slice added for spell-save cover adoption; run the focused `DamageCommand` test that expects a cover modifier on a Dexterity save, then implement cover save modifiers and Sacred Flame-style cover bypass.

**Related Files**:
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/lineOfSight.ts`
- `src/utils/spatial/lineOfSight.ts`
- `src/hooks/combat/useTargetValidator.ts`
- `src/hooks/combat/useTargeting.ts`

---

### concentration-effect-link
**Issue**: The older "concentration commands don't track effect IDs" wording is stale. Current source stores `effectIds` on concentration start and removes linked riders, status effects, conditions, lights, and summons on break, but the linkage is inferred from combat-log data and is not yet proved across every linked effect family.

**Action Required**: Focused cleanup proof has been added for status/condition, light, summon, and rider paths, but it has not been run. 2D rider labels and 3D concentration/status/rider labels now make several cleanup artifacts map-visible, and the light-source live-state/rendering slice now has focused hook proof guards under `SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001`, but rendered proof has not been performed. Run the focused concentration and light-source hook tests when verification is allowed, then render-check 2D/3D cleanup for map-visible concentration artifacts before deciding whether to keep log-derived effect collection or replace it with explicit command-result/effect-id propagation.

**Related Files**:
- `src/commands/effects/ConcentrationCommands.ts`
- `src/commands/factory/SpellCommandFactory.ts`

---

### combat-map-visual-parity
**Issue**: Structured spell execution must answer what the player sees on the combat map in both 2D and 3D. Current visual slices cover several broad categories, but rendered verification has not been run and spell-specific visual language remains uneven.

**Action Required**: Treat 2D/3D map appearance as a required checklist item for every future spell gap. Render-check current active-zone, movement, teleport, target-bound, save/resist/immune, rider/status/concentration, light-source, tactical visibility, and cleanup visuals before claiming visual correctness. `SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001` now has a first consumer slice plus 2D tile, 2D map handoff, 3D map handoff, and 3D mask helper proof guards, but they still need to be run and rendered dark/dim/bright/hidden tile proof remains open. `SSO-VISIBILITY-OBSERVER-POLICY-001` now has a shared helper for the current 2D/3D observer fallback, but still tracks the separate policy decision for which creature or viewpoint owns visibility in player, enemy, preview, and developer/spectator contexts.

**Related Files**:
- `src/components/BattleMap/BattleMapOverlay.tsx`
- `src/components/BattleMap/BattleMap3D.tsx`
- `src/components/BattleMap/vfx/VFXSystem.tsx`
- `src/components/BattleMap/DamageNumberOverlay.tsx`

---

### spell-data-validation-fixes
**Issue**: The old known-broken list (find-familiar, mage-armor, shield, shield-of-faith, tensers-floating-disk, unseen-servant) is stale until reproved. Current files have structured effect blocks, and the repo has both broad and spell-only validation scripts.

**Action Required**: Run `npx tsx scripts/validateSpellJsons.ts` first when verification is allowed, then run broad `npm run validate`. Only split per-spell repair rows from confirmed current failures.

**Related Files**:
- `public/data/spells/*.json`
- `scripts/validate-data.ts`
- `scripts/validateSpellJsons.ts`

---

### monolithic-effect-breakdown
**Issue**: Monolithic-effect debt remains open, but the detection infrastructure already exists. `SpellIntegrityValidator` has normalized duplicate-description detection, and `SpellIntegrityValidator.test.ts` scans all spell levels as a soft warning. The historic `113` count needs a fresh focused test run before conversion work.

**Action Required**:
1. Run the focused integrity test when verification is allowed and capture the current monolithic hit list.
2. Build a prioritized conversion queue from the current output.
3. Convert spells into discrete `SpellEffect` components and validate converted files.

**Related Files**:
- `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`
- `src/systems/spells/validation/SpellIntegrityValidator.ts`
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`
- `public/data/spells`

---

## Medium Priority

### armor-of-agathys-conditional-trigger
**Issue**: Status refreshed 2026-06-01. The data gap is partly solved: Armor of Agathys already has immediate temp HP, `temporary_hit_points_depleted` conditional endings, slot scaling, and retaliation metadata with `on_target_attack` plus `attackFilter.weaponType: melee`. The remaining gap is runtime reactive attack handling, tracked as `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`.

**Current State**: Data is structured, runtime is not verified and likely wrong. `ReactiveEffectCommand` only logs event-listener callbacks. `useActionExecutor` resolves reactive `DAMAGE` triggers for attack-like abilities but ignores hit/miss, melee/ranged/spell filters, and this-spell temp HP ownership; the inspected code also appears to damage the attacked target rather than the attacker.

**Action Required**:
1. Define a reactive attack event payload contract with attacker id, target id, hit/miss, attack kind, and melee/ranged/spell classification.
2. Preserve or identify Armor of Agathys temp HP ownership so retaliation stops when this spell's temp HP is gone.
3. Apply cold retaliation only to the melee attacker on a hit while that spell-owned temp HP remains.
4. Add focused proof for melee-hit retaliation, ranged/spell no-retaliation, no-temp-HP no-retaliation, and attacker-not-target damage application.

**Related Files**:
- `public/data/spells/level-1/armor-of-agathys.json`
- `src/commands/effects/ReactiveEffectCommand.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `docs/tasks/spell-system-overhaul/GAPS.md` (`SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`)

---

### geometry-zone-aoe-fidelity
**Issue**: Zone AoE checks in combat triggers use simplified line/cone math without direction, diverging from targeting preview geometry.

**Action Required**: Verification pending. Current source delegates containment to `AoECalculator` when directional data is available, and focused parity coverage has been added for cube, sphere, cone, and line zones. Run the focused trigger-handler test and only reopen implementation if the proof fails or a directionless-zone caller is found.

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
**Issue**: Status refreshed 2026-06-01. Still open. Current cylinder AoE paths remain 2D: the legacy grid algorithm and shared AoE calculator treat Cylinder like a radius footprint and do not model vertical height.

**Action Required**: Track under `SSO-GEOMETRY-CYLINDER-HEIGHT-001`. Add a 3D/elevation-aware cylinder contract before changing current 2D footprint behavior.

**Related Files**:
- `src/systems/spells/targeting/gridAlgorithms/cylinder.ts:14`
- `src/systems/spells/targeting/AoECalculator.ts`
- `src/utils/combat/aoeCalculations.ts`

---

### geometry-cube-centering
**Issue**: Status refreshed 2026-06-01. Partly solved only as a stable implementation convention. Current shared AoE code uses origin/top-left style cube placement and tests that convention, but the 5e corner/center rule question remains unresolved.

**Action Required**: Track under `SSO-GEOMETRY-CUBE-CENTERING-001`. Define whether Aralia uses grid-origin, cube-corner, or centered placement per cube size before changing shared AoE math.

**Related Files**:
- `src/systems/spells/targeting/gridAlgorithms/cube.ts:15`
- `src/systems/spells/targeting/AoECalculator.ts`
- `src/utils/combat/aoeCalculations.ts`

---

### creature-type-target-filter
**Issue**: Status refreshed 2026-06-01. The original broad claim is stale: schema/data/runtime now support `targeting.filter` and `effect.condition.targetFilter`, and `SpellCommandFactory` gates effect targets through `TargetValidationUtils.matchesFilter`. The remaining gaps are narrower: creature taxonomy is split between `CombatCharacter.creatureTypes` and `stats.creatureTypes`, AI targeting reads a different field path than the resolver, some real spell data has incomplete effect-level filters, and target-filter failures do not yet expose clear combat-map feedback.

**Action Required**: Do not re-add the already-present filter schema/command gate. Work the split rows instead: `SSO-CREATURE-TAXONOMY-NORMALIZATION-001`, `SSO-AI-CREATURE-FILTER-PATH-PARITY-001`, `SSO-SPELL-FILTER-DATA-COMPLETENESS-001`, and `SSO-TARGET-FILTER-FEEDBACK-001`.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/utils/combat/combatAI.ts`
- `public/data/spells/level-1/charm-person.json`
- `public/data/spells/level-2/hold-person.json`
- `public/data/spells/level-4/dominate-beast.json`

---

### ac-mechanics-structured
**Issue**: Status refreshed 2026-06-01. The broad claim is stale: schema/types/data and AC calculation already model AC bonus, base-AC override, AC minimum, reaction triggers, and restrictions. Remaining gaps are narrower: defensive active-effect persistence does not carry all modeled AC mechanics, and Shield-style reaction timing is not wired end-to-end.

**Action Required**: Do not re-add existing schema/data fields. Work the split rows `SSO-AC-DEFENSIVE-PERSISTENCE-001` and `SSO-AC-REACTION-WIREUP-001`.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/combat` (AC calc)
- `src/commands/effects/DefensiveCommand.ts`
- `src/utils/character/statUtils.ts`
- `public/data/spells/level-1/mage-armor.json`
- `public/data/spells/level-1/shield.json`
- `public/data/spells/level-1/shield-of-faith.json`
- `public/data/spells/level-2/barkskin.json`

---

### dynamic-terrain-mutations
**Issue**: Status refreshed 2026-06-01. `TerrainCommand` is no longer a stub when `mapData` is present: it mutates affected map tiles, adds environmental effects, and recalculates movement cost. Remaining gaps are narrower: terrain effects are only logged when no map data exists, and 2D tile-level environmental effect rendering still needs explicit coverage.

**Action Required**: Keep map-present terrain mutation as implemented. `SSO-TERRAIN-MAPLESS-PERSISTENCE-001` now has a mapless `ActiveSpellZone` bridge but needs focused proof. `SSO-MAPLESS-TERRAIN-SUMMARY-UI-001` tracks the separate decision of whether mapless combat needs a player-facing terrain-zone summary. `SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001` now has a direct 2D tile marker slice for existing environmental-effect types, but rendered proof is pending. Do not rebuild the existing command layer.

**Related Files**:
- `src/commands/effects/TerrainCommand.ts`
- `src/types/combat.ts` (BattleMapTile)
- `src/hooks/combat/useGridMovement.ts`
- `src/components/BattleMap/vfx/VFXSystem.tsx`

---

### object-targeting-support
**Issue**: `TargetResolver` rejects object targets; spells cannot target doors/objects.

**Action Required**: Add interactive objects to CombatState and allow `objects` filter in targeting logic with proper stats (AC/HP/immunities).

**Related Files**:
- `src/systems/spells/targeting/TargetResolver.ts`

---

### ai-control-overrides
**Issue**: Status refreshed 2026-06-01. Control/command support is partial, not absent. `command.json` has structured options for Approach, Drop, Flee, Grovel, and Halt. `UtilityCommand` has primitive handlers for those effects, and existing tests cover synthetic single-option Grovel/Flee fixtures. The remaining problems are split into `SSO-CONTROL-OPTION-SELECTION-001` and `SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001`.

**Action Required**:
1. Add a real control-option selection bridge so the actual multi-option Command spell does not always auto-pick Approach.
2. Store selected command directives in a parsable runtime state shape when they need to affect the target's next turn.
3. Make `combatAI.ts` consume those directives before normal action scoring for Approach, Drop, Flee, Grovel, and Halt.
4. Add focused proof for real Command option selection and AI turn enforcement.

**Related Files**:
- `public/data/spells/level-1/command.json`
- `src/commands/effects/UtilityCommand.ts`
- `src/utils/combat/combatAI.ts`
- `src/hooks/combat/useCombatAI.ts`
- `docs/tasks/spell-system-overhaul/GAPS.md` (`SSO-CONTROL-OPTION-SELECTION-001`, `SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001`)

---

### level-1-gap-backlog
**Issue**: Status refreshed 2026-06-01. Level 1 gaps are partly decomposed into current SSO rows, but the canonical level-1 docs still behave as broad pointers. Material costs, ritual casting, and familiar-specific runtime behavior are not explicitly split yet.

**Action Required**: Keep using current mechanic-level SSO rows for decomposed work. Add/route the remaining level-1-specific rows: `SSO-LEVEL1-MATERIAL-COSTS-001`, `SSO-LEVEL1-RITUAL-CASTING-FLOW-001`, and `SSO-LEVEL1-FAMILIAR-RUNTIME-001`.

**Related Files**:
- Various (former LEVEL-1-GAPS summary)

---

### level-2-gap-backlog
**Issue**: Status refreshed 2026-06-01. The referenced `gaps/LEVEL-2-GAPS.md` file is absent, and historical level-2 status docs are not current truth. Current level-2 work is decomposed into mechanic-level SSO rows, but there is no explicit level-2 coverage map tying the 65 level-2 spell files to those rows.

**Action Required**: Track under `SSO-L2-BACKLOG-MAP-001`, `SSO-L2-GAP-HYGIENE-001`, `SSO-L2-MONOLITHIC-QUEUE-L2-001`, and `SSO-L2-SYNC-TRACKER-001`.

**Related Files**:
- Various (former LEVEL-2-GAPS summary)

---

## Low Priority (Future)

### summoning-system
**Issue**: Status refreshed 2026-06-01. The broad "not implemented" claim is stale: `SUMMONING` schema, data, `SummoningCommand`, spell-command routing, `useSummons` scaffolding, summon templates, concentration cleanup, and focused tests already exist. Remaining gaps are integration quality, choice/control behavior, and visible 2D/3D representation for non-creature summons.

**Action Required**: Do not rebuild the summoning system from scratch. Work the split rows `SSO-SUMMONING-RUNTIME-PARITY-001`, `SSO-SUMMONING-FORM-SELECTION-001`, `SSO-SUMMONING-COMMAND-ECONOMY-001`, and `SSO-SUMMONING-MAP-VISUALS-001`.

**Related Files**:
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/combat` / `src/hooks/useAbilitySystem.ts`
- `src/commands/effects/SummoningCommand.ts`
- `src/hooks/combat/useSummons.ts`
- `src/data/summonTemplates.ts`

---

### integration-test-automation
**Issue**: Status refreshed 2026-06-01. Partial automation exists for spell JSON validation and spell-to-ability conversion, but there is still no single end-to-end integration runner covering all proposed steps and no automated status-doc sync.

**Proposal**: Create test runner that:
1. Loads spell JSON
2. Validates via `spellValidator.ts`
3. Tests `SpellContext` loading
4. Tests `spellAbilityFactory` conversion
5. Auto-updates Integration Status in STATUS files

**Related Files**:
- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- `src/utils/character/spellAbilityFactory.ts`
- `src/context/SpellContext.tsx`
- `src/services/SpellService.ts`
- `scripts/validate-data.ts`
- `scripts/validateSpellJsons.ts`
- `scripts/check-spell-integrity.ts`

---

## Completed

- [x] Historical flat-root migration concern retired from active backlog after the current doc pass verified `0` flat spell JSON files directly under `public/data/spells/`
- [x] Fix SPELL_TEMPLATE.json references (archived to `archive/SPELL_TEMPLATE.json`)
- [x] Move `FINAL_SUMMARY.md` into archive and repair live references away from it
- [x] Update TASK_STRATEGY_UPDATE.md references
- [x] Absorb Elements now has DAMAGE effect with `on_attack_hit` trigger
- [x] Armor of Agathys now has DAMAGE effect (trigger needs refinement per above)
- [x] Per-hit riders implemented (GAP-1)
- [x] Reactive triggers implemented (GAP-2)

---

*Last updated: Gap consolidation pass*
