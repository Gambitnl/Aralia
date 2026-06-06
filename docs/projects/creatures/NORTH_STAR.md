# Creatures System North Star

Status: active, cold-start ready
Last updated: 2026-06-05

## Why This Project Exists

This project owns the creature taxonomy, stat, and encounter-generation slice in Aralia and keeps the cold-start handoff current before creature-system behavior changes. The live code is spread across `src/systems/creatures`, `src/data` ingestion, `src/utils/world`, and combat/AI entry points, so source discovery is fragmented. This doc is the cold-start entrypoint for that active surface.

## Intended Outcome

Create a concise, evidence-backed current-state map that lets a future agent resume work without re-discovering:

- taxonomy ownership and implementation state
- monster ingestion and registry pipeline
- encounter parameter/generation/validation flow
- combat and spell target validation handoffs
- unresolved gaps with owners and next proof checks

## Current State (Evidence-Backed)

- `src/systems/creatures/CreatureTaxonomy.ts` centralizes include/exclude logic, legacy `creatureType` fallback, and case normalization, but it still asks for integration into the spell-target validation path.
- Stat and monster source is generated through `scripts/ingestMonsters.ts` from `vendor/5etools-src` bestiary files, converted by `src/data/adapters/5eTools/index.ts`, and checked in as `src/data/monsters.generated.ts` plus `src/data/monsters.ts`.
- Runtime access is via `src/data/adapters/runtimeMonsterRegistry.ts` and `src/utils/combat/combatUtils.ts` for monster materialization and combat spawn.
- Encounter generation stays split between the deterministic generator, AI rebuild path, fallback generator, orchestration API, and encounter UI: `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/encounterUtils.ts`, `src/hooks/actions/handleEncounter.ts`, `src/services/geminiServiceFallback.ts`, `src/services/gemini/encounters.ts`, `src/components/Combat/EncounterModal.tsx`, `src/components/Combat/MonsterPicker.tsx`, and `src/hooks/data/useBestiary.ts`.
- Spell and combat targeting still use legacy checks in their validators, so `CreatureTaxonomy` is not yet the single enforcement point.

## Dashboard Card Schema

Project: Creatures System
Slug: creatures
Category: Gameplay Systems
Status: active
Confidence: medium
Evidence: docs/projects/creatures
Gap signal: 4 open gaps; G1-G3 are immediate, G4 is adjacent
Protocol: living project doc set
Next step: Resolve CT-3 schema policy, then wire CT-2 validator sharing.
Required verification: docs_consistency, git_diff_check
Completed verification: docs_consistency, git_diff_check
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## File Map

| Surface | Paths | Responsibility | Certainty |
|---|---|---|---|
| Core taxonomy | `src/systems/creatures/CreatureTaxonomy.ts` | Canonical target-type validation contract | implemented |
| Taxonomy tests | `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Include/exclude and case-insensitive validation coverage | implemented |
| Concept design | `src/systems/creatures/Creatures_Ralph.md` | Planned hybrid/multi-type model and semantic expansion | partial |
| Source pipeline | `scripts/ingestMonsters.ts`, `src/data/adapters/5eTools/index.ts`, `src/data/monsters.generated.ts`, `src/data/monsters.ts` | Generated stat model and registry source of truth | implemented |
| Runtime registry | `src/data/adapters/runtimeMonsterRegistry.ts`, `src/hooks/data/useBestiary.ts` | Cache-backed lookup and selector exposure | implemented |
| Encounter flow | `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/world/encounterUtils.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts` | Offline and AI encounter builders and validations | partial |
| Combat/spell validation | `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/systems/spells/targeting/TargetResolver.ts` | Targeting validators and filter application | partial |
| Combat conversion | `src/utils/combat/combatUtils.ts` | `getMonster` and monster-to-combat conversion plus special effects mapping | implemented |
| Public types | `src/types/creatures.ts`, `src/types/ui.ts`, `src/types/spells.ts` | Creature, type, and target filter models in different layers | mixed/legacy |

## Active Task

| Field | Value |
|---|---|
| Task | CT-3 - Resolve the creature-type schema policy before deeper validator refactors. |
| Allowed files | `docs/projects/creatures/` plus the schema-related source docs already named by the tracker. |
| Acceptance | Canonical read/write rules for creature-type aliases are documented, CT-2 is clearly gated, and the project docs point the next agent at the right first step. |
| Stop condition | Schema policy is explicit in the docs, the queue order matches the dependency, and the handoff is cold-start readable. |
| Owner | Worker A |

## Scope Boundaries

- In scope: evidence collection, system-state mapping, schema and ownership clarification, gap registration, and resume instructions.
- Adjacent but not in scope for this pass: actual creature validation refactor, spell-effect migration, or encounter cap policy implementation.
- Out of scope: any gameplay behavior edits.

## Current Partial and Uncertain Areas

- `TargetConditionFilter` still carries mixed legacy/new shape fields and is consumed across multiple call paths (`src/types/spells.ts`, validators in spell and combat code).
- Targeting behavior is centralized conceptually but still fragmented at runtime; `CreatureTaxonomy` is not yet the single enforcement point.
- Hybrid/multi-type semantics are explicitly modeled in `src/systems/creatures/Creatures_Ralph.md` and project docs but are not implemented in runtime validator logic.
- Encounter count policy is inconsistent across generators (`4` vs `6` hard limits) and should be normalized before balance-sensitive changes.

## Known Gaps (durable)

- G1, G2, G3, G4 in `docs/projects/creatures/GAPS.md`.
- Global fallback: none imported yet; re-evaluate `docs/projects/GLOBAL_GAPS.md` if ownership drifts beyond this project.

## Evidence and Proof Log

| Evidence | What it proves |
|---|---|
| `src/systems/creatures/CreatureTaxonomy.ts` | Centralized taxonomy logic exists and includes an explicit integration TODO. |
| `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Existing validation expectations (whitelist/exclude/case-insensitive) are explicit and runnable. |
| `scripts/ingestMonsters.ts` + `src/data/adapters/5eTools/index.ts` | Ingestion and conversion path from source data into runtime `MonsterData`. |
| `src/data/monsters.ts` | Checked-in generated registry is current runtime source. |
| `src/data/adapters/runtimeMonsterRegistry.ts` + `src/hooks/data/useBestiary.ts` | Runtime registry and UI-facing entry resolution and caching are in place. |
| `src/utils/world/encounterUtils.ts` + `src/services/geminiServiceFallback.ts` + `src/services/gemini/encounters.ts` | Shows path differences in encounter validation, rebuild behavior, and limits. |
| `src/components/Combat/MonsterPicker.tsx` + `src/components/Combat/EncounterModal.tsx` | UI confirms bestiary search, manual edits, and AI/bestiary tab wiring in the same encounter modal surface. |
| `src/systems/spells/targeting/TargetValidationUtils.ts` + `src/hooks/combat/useTargetValidator.ts` | Validations remain custom and not yet fully centralized. |

## Cold-Start Resume Path (Strict)

When resuming this project:

1. Read this file fully.
2. Read `docs/projects/creatures/TRACKER.md` and `docs/projects/creatures/GAPS.md`.
3. If CT-3 is still unresolved, settle the schema policy first and then return to CT-2.
4. Use the file map above to pick the owned slice with the least ambiguity.
5. Confirm `AGENTS.md`, `docs/projects/PROJECT_TRACKER.md`, and `docs/projects/GLOBAL_GAPS.md` before cross-project routing.

## Artifact Boundary

- Durable: project docs in `docs/projects/creatures/` and gap records.
- Not durable: terminal output, one-off branch notes, generated vendor dumps, and raw local logs.
