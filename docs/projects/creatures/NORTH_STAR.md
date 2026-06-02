# Creatures System North Star

Status: active, documentation-first handoff
Last updated: 2026-05-31

## Why This Project Exists

This project owns the creature taxonomy + stat + encounter-generation slice in Aralia and documents the exact handoff needed before any creature-system behavior changes. The live code is spread across `src/systems/creatures`, `src/data` ingestion, `src/utils/world`, and combat/AI entry points, so source discovery is fragmented. This doc is the cold-start entrypoint for that active surface.

## Intended Outcome

Create a concise, evidence-backed current-state map that lets a future agent resume work without re-discovering:

- taxonomy ownership and implementation state
- monster ingestion and registry pipeline
- encounter parameter/generation/validation flow
- combat and spell target validation handoffs
- unresolved gaps with owners and next proof checks

## Current State (Evidence-Backed)

- Taxonomy lives in `src/systems/creatures/CreatureTaxonomy.ts` with tests in `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts`. It currently supports include/exclude logic, legacy `creatureType` fallback, and case normalization, and it explicitly asks for integration into the spell-target validation path.
- Stat/monster source is generated through `scripts/ingestMonsters.ts` from `vendor/5etools-src` bestiary files, converted by `src/data/adapters/5eTools/index.ts`, and checked in as `src/data/monsters.generated.ts` + re-exported in `src/data/monsters.ts`.
- Runtime access is via `src/data/adapters/runtimeMonsterRegistry.ts` and `src/utils/combat/combatUtils.ts` (monster materialization and combat spawn).
- Encounter generation is split:
  - deterministic generator: `src/utils/world/bestiaryEncounterGenerator.ts`
  - AI validation/rebuild path: `src/utils/encounterUtils.ts` (via re-export and `src/hooks/actions/handleEncounter.ts`)
  - fallback generator: `src/services/geminiServiceFallback.ts`
  - orchestration API: `src/services/gemini/encounters.ts`
  - encounter UI/selection: `src/components/Combat/EncounterModal.tsx`, `src/components/Combat/MonsterPicker.tsx`, and bestiary hook `src/hooks/data/useBestiary.ts`.
- Spell and combat targeting still call legacy checks in their validators and are only partially shared with `CreatureTaxonomy`.

## File Map

| Surface | Paths | Responsibility | Certainty |
|---|---|---|---|
| Core taxonomy | `src/systems/creatures/CreatureTaxonomy.ts` | Canonical target-type validation contract | implemented |
| Taxonomy tests | `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Include/exclude and case-insensitive validation coverage | implemented |
| Concept design | `src/systems/creatures/Creatures_Ralph.md` | Planned hybrid/multi-type model and semantic expansion | partial |
| Source pipeline | `scripts/ingestMonsters.ts`, `src/data/adapters/5eTools/index.ts`, `src/data/monsters.generated.ts`, `src/data/monsters.ts` | Generated stat model and registry source of truth | implemented |
| Runtime registry | `src/data/adapters/runtimeMonsterRegistry.ts`, `src/hooks/data/useBestiary.ts` | Cache-backed lookup + selector exposure | implemented |
| Encounter flow | `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/world/encounterUtils.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts` | Offline + AI encounter builders and validations | partial |
| Combat/spell validation | `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/systems/spells/targeting/TargetResolver.ts` | Targeting validators and filter application | partial |
| Combat conversion | `src/utils/combat/combatUtils.ts` | `getMonster` + monster-to-combat conversion and special effects mapping | implemented |
| Public types | `src/types/creatures.ts`, `src/types/ui.ts`, `src/types/spells.ts` | Creature/type/target filter models in different layers | mixed/legacy |

## Active Task

| Field | Value |
|---|---|
| Task | Enrich and stabilize the Creatures project doc set (this file, `TRACKER.md`, `GAPS.md`) without source edits. |
| Allowed files | `docs/projects/creatures/` only |
| Acceptance | Three docs updated with evidence-backed state, file map, uncertainty notes, concrete gap list, and resume sequence. |
| Stop condition | `git diff --check` passes and no non-document paths changed. |
| Owner | Worker A |

## Scope Boundaries

- In scope: evidence collection, system-state mapping, schema/ownership clarification, gap registration, resume instructions.
- Adjacent but not in scope for this pass: actual creature validation refactor, spell-effect migration, or encounter cap policy implementation.
- Out of scope: any gameplay behavior edits.

## Current Partial and Uncertain Areas

- `TargetConditionFilter` has mixed legacy/new shape fields and is consumed across multiple call paths (`src/types/spells.ts`, validators in spell and combat code).
- Targeting behavior is centralized conceptually but still fragmented at runtime; `CreatureTaxonomy` is not yet the single enforcement point.
- Hybrid/multi-type semantics are explicitly modeled in project docs but not implemented in runtime validator logic.
- Encounter count policy is inconsistent across generators (`4` vs `6` hard limits) and should be normalized before balance-sensitive changes.

## Known Gaps (durable)

- G1, G2, G3, G4 in `docs/projects/creatures/GAPS.md`.
- Global fallback: none imported yet; re-evaluate `docs/projects/GLOBAL_GAPS.md` if ownership drifts beyond this project.

## Evidence and Proof Log

| Evidence | What it proves |
|---|---|
| `src/systems/creatures/CreatureTaxonomy.ts` | Centralized taxonomy logic exists and includes an explicit integration TODO. |
| `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Existing validation expectations (whitelist/exclude/case-insensitive) are explicit and runnable. |
| `scripts/ingestMonsters.ts` + `src/data/adapters/5eTools/index.ts` | Ingestion + conversion path from source data into runtime `MonsterData`. |
| `src/data/monsters.ts` | Checked-in generated registry is current runtime source. |
| `src/data/adapters/runtimeMonsterRegistry.ts` + `src/hooks/data/useBestiary.ts` | Runtime registry + UI-facing entry resolution and caching are in place. |
| `src/utils/world/encounterUtils.ts` + `src/services/geminiServiceFallback.ts` + `src/services/gemini/encounters.ts` | Shows path differences in encounter validation/rebuild behavior and limits. |
| `src/components/Combat/MonsterPicker.tsx` + `src/components/Combat/EncounterModal.tsx` | UI confirms bestiary search, manual edits, AI/bestiary tab wiring in same encounter modal surface. |
| `src/systems/spells/targeting/TargetValidationUtils.ts` + `src/hooks/combat/useTargetValidator.ts` | Validations remain custom and not yet fully centralized. |

## Cold-Start Resume Path (Strict)

When resuming this project:

1. Read this file fully.
2. Read `docs/projects/creatures/TRACKER.md`.
3. Read `docs/projects/creatures/GAPS.md`.
4. Use the file map above to pick first one owned slice: taxonomy integration, schema policy, or encounter-cap policy.
5. Confirm `AGENTS.md`, `docs/projects/PROJECT_TRACKER.md`, and `docs/projects/GLOBAL_GAPS.md` before cross-project routing.

## Artifact Boundary

- Durable: project docs in `docs/projects/creatures/` and gap records.
- Not durable: terminal output, one-off branch notes, generated vendor dumps, and raw local logs.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
