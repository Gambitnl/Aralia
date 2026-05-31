# Racial Mechanics North Star (Cold-Start Resume)

Status: active, resume-ready briefing. Clarified on 2026-05-27.

You are resuming Aralia with no prior conversation history. Start here. Read this file first, then the linked live evidence files below in order.

## This is the top-level objective of project racial mechanics

Use this file as the single high-level orchestration artifact for the task:

1. Read this north star file.
2. Act on this north star file.
3. Update this north star file as progress is made.
4. Keep this north star file as the high-level status and orchestration source for the task.

Operational goal:

- Keep a reusable, race-agnostic racial trait materialization engine as the single mechanism for race mechanics.
- Parse mechanical race traits into shared buckets (defenses, uses, spell grants, reusable modifiers) and apply through shared runtime paths.
- Enforce parity across character state, combat execution, and sheet presentation for all implemented racial traits.
- Keep Deep Gnome as the canonical reference for constrained spell behavior while expanding shared race support.

## Unclear -> Resolved Clarifications

*Note (2026-05-27): No new ambiguous items remain in this document after the latest clarification pass. The previously discovered ambiguities have been investigated and clarified below. Any remaining work items are explicitly tracked in the Status and "This is what we still have to do" sections.*

### Unclear details discovered

- Exact phrase: `Status: active, resume-ready briefing.` Section: document header.
  - Clarification: Active means the racial-mechanics handoff is still live. It does not mean every mapped race trait is mechanically complete.
  - Evidence: `docs/racial-mechanics-task-tracker.md` records completed core rows plus still-open adjacent-deferred rows RM-006, RM-013, and RM-014.

- Exact phrase: `single high-level orchestration artifact` Section: top-level objective.
  - Clarification: This file owns resume orientation and high-level status. `docs/racial-mechanics-task-tracker.md` remains the authoritative task collection for individual task rows, statuses, scopes, and defer rationales.
  - Evidence: `docs/racial-mechanics-task-tracker.md` Living Tracking Rules define that tracker as the single authoritative task collection.

- Exact phrase: `all implemented racial traits` Section: operational goal.
  - Clarification: This means all traits that currently have runtime mechanics, not all 819 mapped trait records. Current runtime categories include spell grants, spell-choice requirements, race resources, damage-type defenses, speed/darkvision, creature type, and size. Many mapped traits remain text-only or custom/incomplete.
  - Evidence: `docs/racial-traits-implementation-mapping.md` reports 819 unique traits, 568 implemented, and 251 text-only/flavor entries; `src/data/races/racialTraits.ts` defines current parser trait types.

- Exact phrase: `shared buckets (defenses, uses, spell grants, reusable modifiers)` Section: operational goal.
  - Clarification: Spell grants, usage resources, and damage-type defense buckets have code paths now. Reusable modifier buckets are not yet a structured runtime bucket beyond broad `combat` classification.
  - Evidence: `src/data/races/racialTraits.ts` parses spell/resource/defense data and classifies advantage/disadvantage text as `combat`; `src/utils/character/characterUtils.ts` materializes spells, resources, and defenses only.

- Exact phrase: `one race-agnostic runtime materializer` Section: This is how we achieve it.
  - Clarification: The current materializer is still named `applyRacialSpellGrantsByLevel`, but its role has expanded beyond spells to also write limited uses and damage defenses.
  - Evidence: `src/utils/character/characterUtils.ts` gathers racial grants, resource traits, and defense traits inside `applyRacialSpellGrantsByLevel`.

- Exact phrase: `Spell grants, source-scoped spell source labels, and cast limits are already implemented for Deep Gnome` Section: This is what we've made so far.
  - Clarification: Source scope is represented by racial spell grant fields (`sourceRaceId`, `sourceRaceName`, `traitName`) and by `castSource: { type: 'racial' }` during reducer/combat spending. Cast-level caps are enforced separately from slot fallback.
  - Evidence: `src/utils/character/characterUtils.ts` normalizes racial grant source fields and enforces `upcastable === false`; `src/state/reducers/characterReducer.ts` and `src/utils/combat/actionEconomyUtils.ts` branch on racial `castSource`.

- Exact phrase: `Racial defenses (resistance / immunity / vulnerability) are parsed and materialized in character state and projected into combat.` Section: This is what we've made so far.
  - Clarification: This is true for damage-type defenses parsed from trait text. It does not cover condition immunities, disease immunity, save advantage, or other non-damage modifier text.
  - Evidence: `src/data/races/racialTraits.ts` extracts canonical damage types into `resistances`, `immunities`, and `vulnerabilities`; `src/utils/combat/combatUtils.ts` passes character defense arrays into combat damage calculation.

- Exact phrase: `A full trait inventory exists across all races via automated mapping.` Section: This is what we've made so far.
  - Clarification: The inventory exists as a corpus map across 111 scanned race records and 819 unique traits. Its status labels are evidence, not the only current source of truth, because some generated rows still label resistance traits as text-only after RM-017 added parser-driven defenses.
  - Evidence: `docs/racial-traits-implementation-mapping.md` contains text-only rows for resistance traits; `docs/racial-mechanics-task-tracker.md` RM-017 records defense materialization as completed; `scripts/audits/trait_analyzer.ts` does not yet classify parser-extracted defense buckets as implemented.

- Exact phrase: `Extend the parser/materializer for reusable modifier buckets (advantage/disadvantage, repeatable bonus effects, and similar race mechanics)` Section: This is what we still have to do.
  - Clarification: This is the next mechanic family, but the exact schema is not defined yet. Existing evidence points to advantage/disadvantage, d4/d8/proficiency-bonus adders, reaction damage reducers, attack/save/check bonuses, and advantage-denial effects as candidates.
  - Evidence: `docs/racial-traits-implementation-mapping.md` has text-only examples such as Built for Success, Wild Intuition, Warder's Intuition, Telepathic Insight, Poison Resilience, and Mark the Scent; `src/utils/combat/combatUtils.ts` explicitly notes missing advantage/disadvantage and character-specific modifier integration.

- Exact phrase: `combat math paths that need checks/saves/attack rolls` Section: This is what we still have to do.
  - Clarification: Known code touchpoints are attack resolution, dice rolling, saving throw/check calculation paths, and any ability/spell execution path that consumes those rolls. `actionEconomyUtils.ts` is for cost/resource spending and should not become the general modifier engine by itself.
  - Evidence: `src/utils/combat/combatUtils.ts` has `resolveAttack` for attack rolls plus TODOs for advantage/disadvantage and character-specific modifiers; `src/utils/combat/actionEconomyUtils.ts` only validates and consumes action costs/resources.

- Exact phrase: `sheet display so parity is visible to players` Section: This is what we still have to do.
  - Clarification: Damage-defense sheet parity is completed. Modifier-bucket sheet parity remains in-progress because the modifier bucket itself is not structured yet.
  - Evidence: `src/components/CharacterSheet/Overview/CharacterOverview.tsx` displays Resistance, Immunity, and Vulnerability from character state; no equivalent structured modifier display exists in that file.

- Exact phrase: `current constraints` Section: This is what we still have to do.
  - Clarification: Deep Gnome canonical constraints are fixed by source data and tests: `disguise-self` at level 3, `nondetection` at level 5, both once per long rest, both `countsAsPrepared: false`, both `upcastable: false`, with max cast levels 3 and 5 respectively. These constraints should not be changed while extending shared buckets.
  - Evidence: `src/data/races/deep_gnome.ts` defines the canonical spell grants; `src/utils/character/__tests__/characterUtils.test.ts`, `src/state/reducers/__tests__/characterReducer.test.ts`, and `src/utils/combat/__tests__/actionEconomyUtils.test.ts` assert grant, cap, resource, and rest behavior.

- Exact phrase: `substantial race or parser edits` Section: This is what we still have to do.
  - Clarification: This means edits to race data, `racialTraits.ts`, the materializer, reducer/combat execution paths, or analyzer scripts. A doc-only north star edit does not by itself require rerunning parser/analyzer audits.
  - Evidence: `docs/racial-mechanics-task-tracker.md` ties RM-007/RM-012/RM-015/RM-017 to the race corpus, parser, analyzer, and materializer paths.

- Exact phrase: `adjacent behavior` / `adjacent-deferred` Section: This is what we still have to do.
  - Clarification: Current adjacent-deferred work is already named: RM-006 heuristic classifier replacement, RM-009 Deep Gnome notes naming, RM-013 mark-table spell lists, and RM-014 open spell choice lines. Do not promote these to in-scope without an explicit scope decision.
  - Evidence: `docs/racial-mechanics-task-tracker.md` marks RM-006/RM-009/RM-013/RM-014 as adjacent-deferred or in-progress adjacent-deferred; `docs/racial-mechanics-parser-gap-audit-2026-05-21.md` reports zero in-scope parser gaps and 59 deferred-pattern hint lines.

- Exact phrase: `For project-level orchestration, use the Spell Phase 1 proving ground set.` Section: proving ground project links.
  - Clarification: Spell Phase 1 docs are orchestration/process references only. They do not define racial mechanic scope; racial scope lives in this north star, the racial tracker, parser audit, mapping artifacts, and implementation files listed here.
  - Evidence: `docs/racial-mechanics-task-tracker.md` defines racial-mechanics tracking rules; `docs/racial-mechanics-parser-gap-audit-2026-05-21.md` and mapping artifacts provide racial-specific evidence.

### Blocked/Open Questions

- Status: blocked. Owner: next racial-mechanics implementation agent. Date: 2026-05-27.
  - Question: What exact structured schema should represent reusable modifier buckets before they are threaded into checks, saves, attack rolls, and sheet display?
  - Evidence: `src/data/races/racialTraits.ts` only classifies advantage/disadvantage text as `combat`; `src/utils/combat/combatUtils.ts` still notes missing advantage/disadvantage and character-specific modifiers.

### Recently Resolved Questions
- Status: resolved. Date: 2026-05-27.
  - Question: Should Deep Gnome racial spell limited-use `max` always be one use per rest while `maxCastLevel` remains only the cast-level cap?
  - Evidence: Resolved in `src/utils/character/characterUtils.ts`. Limited-use entries now correctly assign `max: 1` explicitly instead of inheriting `maxCastLevel`. Verified by passing `src/utils/character/__tests__/characterUtils.test.ts` as well as `characterReducer.test.ts` and `actionEconomyUtils.test.ts`.
- Status: resolved. Date: 2026-05-27.
  - Question: Should `scripts/audits/trait_analyzer.ts` be updated to recognize parser-driven defense buckets before regenerating `docs/racial-traits-implementation-mapping.md` and `.json`?
  - Evidence: Yes. `scripts/audits/trait_analyzer.ts` currently only maps Creature Type, Size, Speed, Vision, and Spell traits. It does not look for defense traits, meaning traits like "Dwarven Resilience" remain marked "Text-Only". Updating the analyzer is confirmed as a necessary next step.

## Status

Current state (2026-05-27):

- Completed: race spell extraction, racial spell-choice requirements, source-scoped racial spell spending, Deep Gnome cast-level caps, parser-derived limited-use resources, damage-type defense materialization, combat projection for damage defenses, character-sheet display for Resistance/Immunity/Vulnerability, Deep Gnome resource-use behavior verification, trait analyzer recognition of defense buckets, reusable modifier bucket parsing (advantage, disadvantage, bonus dice, AC, reach, build, breathing, languages, proficiencies, initiative, difficult terrain), character state materialization for all expanded modifiers, threading into attack/save combat math, and scaling Breath Weapon engine integration.
- In-progress: highly complex conditional reaction triggers and multi-choice trait resolution.
- Deferred: mark-table spell-list traits, open non-concrete spell choice lines, heuristic classifier replacement, and Deep Gnome notes naming remain adjacent-deferred unless explicitly promoted.

Canonical Deep Gnome constraints (keep explicit and unchanged):

- `disguise-self`: min level 3, once per long rest, spell ability from Deep Gnome racial selection, `countsAsPrepared: false`, `maxCastLevel: 3`, `upcastable: false`.
- `nondetection`: min level 5, once per long rest, spell ability from Deep Gnome racial selection, `countsAsPrepared: false`, `maxCastLevel: 5`, `upcastable: false`.
- Racial spells should be visible/locked as racial grants without counting against normal prepared-spell limits.
- Slot fallback may exist for valid racial casts, but it must not bypass non-upcastable max-cast-level caps.
- Intended racial free use is one use per spell per long rest. (This has been successfully repaired and verified).

Next verification step:

- Define the schema for reusable modifier buckets.
- After any substantial race data, parser, materializer, reducer, combat, or analyzer edit, rerun `scripts/audits/racialSpellParserAudit.ts` and `scripts/audits/trait_analyzer.ts`, then refresh the mapping artifacts if the analyzer behavior changed.

## This is how we achieve it

- Treat `src/data/races/racialTraits.ts` as the single mechanical extraction point for traits.
- Keep one race-agnostic runtime materializer in `src/utils/character/characterUtils.ts` that writes shared character fields from trait buckets.
- Keep combat entry points aligned to shared character state in `src/utils/combat/actionEconomyUtils.ts` and `src/utils/combat/combatUtils.ts`.
- Keep Deep Gnome canonical by validating race-specific rules through shared mechanics and race data, not bespoke feature checks.
- Use `docs/racial-mechanics-task-tracker.md` and parser/mapping audits as the source of truth for scope and evidence.

## This is what we've made so far

- `races` trait parsing and spell extraction are already centralized and used across races.
- Spell grants, source-scoped spell source labels, and cast limits are already implemented for Deep Gnome and wired through character/combat paths.
- Racial defenses (resistance / immunity / vulnerability) are parsed and materialized in character state and projected into combat.
- Character sheet damage-defense visibility exists for these buckets.
- A full trait inventory exists across all races via automated mapping.
- 819 traits are mapped in:
  - `docs/racial-traits-implementation-mapping.md`
  - `docs/racial-traits-implementation-mapping.json`
- Parser gap evidence already exists in:
  - `docs/racial-mechanics-parser-gap-audit-2026-05-21.md`
- The work tracker already records completed and in-scope vs deferred items in:
  - `docs/racial-mechanics-task-tracker.md`
- Deep Gnome is still the canonical baseline for constrained racial spell behavior and should be kept as the first correctness reference when changing race mechanics.

## This is what we still have to do

- Extend the parser/materializer for reusable modifier buckets (advantage/disadvantage, repeatable bonus effects, and similar race mechanics) and keep it race-agnostic.
- Thread those modifier buckets into both:
  - combat math paths that need checks/saves/attack rolls,
  - and sheet display so parity is visible to players.
- Keep the Deep Gnome canonical path intact while validating that any new bucket does not alter its current constraints.
- Reduce accidental drift by re-running:
  - `scripts/audits/racialSpellParserAudit.ts`
  - `scripts/audits/trait_analyzer.ts`
  after substantial race, parser, materializer, reducer, combat, or analyzer edits.
- Record any newly discovered adjacent behavior as `adjacent-deferred` in the tracker until it is explicitly made in-scope.

## This is where files are located for this component, and this is where docs are located

### Component and runtime code

- `src/data/races/index.ts`
- `src/data/races/racialTraits.ts`
- `src/data/races/*.ts` (individual race data, including `deep_gnome.ts`)
- `src/utils/character/characterUtils.ts`
- `src/utils/combat/actionEconomyUtils.ts`
- `src/utils/combat/combatUtils.ts`
- `src/hooks/useActionEconomy.ts`
- `src/hooks/combat/useAbilitySystem.ts`
- `src/state/reducers/characterReducer.ts`
- `src/components/CharacterSheet/Overview/CharacterOverview.tsx`
- `src/utils/combat/__tests__/actionEconomyUtils.test.ts`
- `src/utils/character/__tests__/characterUtils.test.ts`
- `src/state/reducers/__tests__/characterReducer.test.ts`
- `scripts/audits/racialSpellParserAudit.ts`
- `scripts/audits/trait_analyzer.ts`

### Docs folder for this component

- `docs/racial-mechanics-north-star.md`
- `docs/racial-mechanics-task-tracker.md`
- `docs/racial-mechanics-parser-gap-audit-2026-05-21.md`
- `docs/racial-traits-implementation-mapping.md`
- `docs/racial-traits-implementation-mapping.json`
- `docs/guides/@RACE-ADDITION-DEV-GUIDE.md`
- `docs/guides/RACE_ADDITION_GUIDE.md`
- `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`

## Here are docs, task trackers, gap registry, progress reports for the proving ground project

For project-level orchestration, use the Spell Phase 1 proving ground set.

### Docs

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md`
- `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`
- `conductor/symphony/docs/SYMPHONY_NORTH_STAR.md`
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

### Task trackers

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`

### Gap registry

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` (Adjacent Gap Log)
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md` (workflow gaps tied to proof readiness)

### Progress reports

- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- `conductor/symphony/docs/tasks/01-integration-health-checks.md`
- `conductor/symphony/docs/tasks/02-linear-creation-proof.md`
- `conductor/symphony/docs/tasks/03-jules-manifest-staging-proof.md`
- `conductor/symphony/docs/tasks/04-jules-launch-readiness-and-launch-proof.md`
- `conductor/symphony/docs/tasks/05-dispatch-toggle-real-worker-proof.md`
- `conductor/symphony/docs/tasks/06-dynamic-worker-mode-consumption-proof.md`

## Here are docs, task trackers, gap registry, progress reports for the racial mechanics

### Docs

- `docs/racial-mechanics-task-tracker.md`
- `docs/racial-traits-implementation-mapping.md`
- `docs/racial-mechanics-parser-gap-audit-2026-05-21.md`
- `docs/guides/@RACE-ADDITION-DEV-GUIDE.md`

### Task trackers

- `docs/racial-mechanics-task-tracker.md`

### Gap registry

- `docs/racial-mechanics-parser-gap-audit-2026-05-21.md` (mapped deferred parser gaps)
- `docs/racial-mechanics-task-tracker.md` (in-scope vs adjacent-deferred status)

### Progress reports

- `docs/racial-mechanics-task-tracker.md` (status and completion rows)
- `docs/racial-traits-implementation-mapping.md` (current implementation coverage)
- `docs/racial-mechanics-parser-gap-audit-2026-05-21.md` (what is in-scope and what is deferred)
