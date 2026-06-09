---
schema_version: 1
project: Creatures System
slug: creatures
category: Gameplay Systems
main_category: Gameplay Systems
subcategory: Creatures and Encounters
status: active
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/creatures
gap_signal: "1 open gap; G4 remains adjacent"
protocol: living project doc set
next_step: Keep G4 adjacent until product direction is recorded; G5 is resolved via generator-owned proof.
agent_comments: "G5 proof added in AUDIT_OR_PROOF.md; no generated corpus edits were made."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - AUDIT_OR_PROOF.md
optional_docs:
  - DECISIONS.md
  - RUNBOOK.md
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
  - git_diff_check
completed_verification:
  - docs_consistency
  - git_diff_check
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: no
---

# Creatures System North Star

Status: active, cold-start ready
Last updated: 2026-06-08

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

- `src/systems/creatures/CreatureTaxonomy.ts` centralizes include/exclude logic, legacy `creatureType` fallback, and case normalization, and is now used by both spell and manual combat validators through `CreatureTaxonomy.isValidTarget`.
- CT-3 schema policy is resolved: new spell-targeting filters should write plural fields (`creatureTypes`, `sizes`, `alignments`, `excludeCreatureTypes`), while validators may read legacy singular aliases (`creatureType`, `size`, `alignment`) only to preserve existing data.
- Stat and monster source is generated through `scripts/ingestMonsters.ts` from `vendor/5etools-src` bestiary files, converted by `src/data/adapters/5eTools/index.ts`, and checked in as `src/data/monsters.generated.ts` plus `src/data/monsters.ts`.
- G5 is resolved by source-backed proof: `scripts/ingestMonsters.ts` owns the generated monster corpus, `src/data/monsters.generated.ts` remains intact, and `src/data/monsters.ts` stays a re-export instead of a manual shard boundary.
- Runtime access is via `src/data/adapters/runtimeMonsterRegistry.ts` and `src/utils/combat/combatUtils.ts` for monster materialization and combat spawn.
- Encounter generation stays split between the deterministic generator, AI rebuild path, fallback generator, orchestration API, and encounter UI: `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/encounterUtils.ts`, `src/hooks/actions/handleEncounter.ts`, `src/services/geminiServiceFallback.ts`, `src/services/gemini/encounters.ts`, `src/components/Combat/EncounterModal.tsx`, `src/components/Combat/MonsterPicker.tsx`, and `src/hooks/data/useBestiary.ts`.

## Dashboard Card Schema

Project: Creatures System
Slug: creatures
Category: Gameplay Systems
Status: active
Confidence: medium
Evidence: docs/projects/creatures
Gap signal: 1 open gap; G4 remains adjacent
Protocol: living project doc set
Next step: CT-2 is complete. G5 is resolved; next safe follow-up is G4 adjacency-only work, not this validator gate.
Required verification: docs_consistency, git_diff_check
Completed verification: docs_consistency, git_diff_check
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Agent comments: G5 proof added in AUDIT_OR_PROOF.md; no generated corpus edits were made.

## File Map

| Surface | Paths | Responsibility | Certainty |
|---|---|---|---|
| Core taxonomy | `src/systems/creatures/CreatureTaxonomy.ts` | Canonical target-type validation contract | implemented |
| Taxonomy tests | `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Include/exclude and case-insensitive validation coverage | implemented |
| Concept design | `src/systems/creatures/Creatures_Ralph.md` | Planned hybrid/multi-type model and semantic expansion | partial |
| Source pipeline | `scripts/ingestMonsters.ts`, `src/data/adapters/5eTools/index.ts`, `src/data/monsters.generated.ts`, `src/data/monsters.ts` | Generated stat model and registry source of truth | implemented |
| Runtime registry | `src/data/adapters/runtimeMonsterRegistry.ts`, `src/hooks/data/useBestiary.ts` | Cache-backed lookup and selector exposure | implemented |
| Encounter flow | `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/world/encounterUtils.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts` | Offline and AI encounter builders and validations | partial |
| Combat/spell validation | `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/systems/spells/targeting/TargetResolver.ts` | Targeting validators and filter application | implemented |
| Combat conversion | `src/utils/combat/combatUtils.ts` | `getMonster` and monster-to-combat conversion plus special effects mapping | implemented |
| Public types | `src/types/creatures.ts`, `src/types/ui.ts`, `src/types/spells.ts` | Creature, type, and target filter models in different layers | mixed/legacy |

## Active Task

| Field | Value |
|---|---|
| Task | G4 - preserve adjacent hybrid semantics notes while keeping CT-2 runtime behavior stable. |
| Allowed files | `src/systems/creatures/CreatureTaxonomy.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/hooks/combat/useTargetValidator.ts`, focused tests for those paths, and this project doc set. |
| Acceptance | RT2 stays complete: both validator paths share `CreatureTaxonomy` include/exclude semantics with legacy-read alias compatibility. G4 remains adjacent and documentation-only for this cycle. |
| Stop condition | Validator behavior is shared without removing legacy filter support or changing hybrid semantics. |
| Owner | Worker A |

## Scope Boundaries

- In scope: validator sharing through existing taxonomy helpers, schema-compatible tests, and gap/documentation updates.
- Adjacent but not in scope for this pass: hybrid/multi-type semantics, generated monster sharding, or broader spell-effect migration.
- Out of scope: deleting legacy aliases, changing spell corpus format, or replacing encounter-generation behavior.

## Current Partial and Uncertain Areas

- `TargetConditionFilter` still carries mixed legacy/new shape fields and is consumed across multiple call paths, but CT-3 now defines the migration rule: plural fields are canonical for new writes; singular fields are read-only compatibility inputs.
- `CreatureTaxonomy` is now the shared enforcement point for both automated spell and manual combat creature filtering. Hybrid/multi-type behavior remains adjacent in G4.
- Hybrid/multi-type semantics are explicitly modeled in `src/systems/creatures/Creatures_Ralph.md` and project docs but are not implemented in runtime validator logic.
- The monster corpus stays generator-owned: `scripts/ingestMonsters.ts` writes `src/data/monsters.generated.ts`, and `src/data/monsters.ts` is only the runtime re-export. G5 is resolved as a documentation/proof task rather than a data-sharding task.

## Known Gaps (durable)

- G4 in `docs/projects/creatures/GAPS.md`; G1/CT-2, G2/CT-3, G3, and G5 are resolved.
- Global fallback: none imported yet; re-evaluate `docs/projects/GLOBAL_GAPS.md` if ownership drifts beyond this project.

## Evidence and Proof Log

| Evidence | What it proves |
|---|---|
| `src/systems/creatures/CreatureTaxonomy.ts` | Centralized taxonomy logic now drives include/exclude checks in spell and manual combat validation paths. |
| `src/systems/spells/targeting/TargetValidationUtils.ts` + `src/hooks/combat/useTargetValidator.ts` | Spell and manual combat validators now route creature-type include/exclude checks through the shared taxonomy helper with legacy alias support preserved. |
| `src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts` | Focused include/exclude and legacy alias coverage added for spell validator behavior. |
| `src/hooks/combat/__tests__/useTargetValidator.test.ts` | Focused manual validation reason-path coverage added for include/exclude and legacy alias behavior. |
| `src/systems/creatures/__tests__/CreatureTaxonomy.test.ts` | Existing validation expectations (whitelist/exclude/case-insensitive) are explicit and runnable. |
| `scripts/ingestMonsters.ts` + `src/data/adapters/5eTools/index.ts` | Ingestion and conversion path from source data into runtime `MonsterData`. |
| `src/data/monsters.ts` | Checked-in generated registry is current runtime source. |
| `src/data/adapters/runtimeMonsterRegistry.ts` + `src/hooks/data/useBestiary.ts` | Runtime registry and UI-facing entry resolution and caching are in place. |
| `src/utils/world/encounterUtils.ts` + `src/services/geminiServiceFallback.ts` + `src/services/gemini/encounters.ts` | Shows path differences in encounter validation, rebuild behavior, and limits. |
| `src/components/Combat/MonsterPicker.tsx` + `src/components/Combat/EncounterModal.tsx` | UI confirms bestiary search, manual edits, and AI/bestiary tab wiring in the same encounter modal surface. |
| `src/systems/spells/targeting/TargetValidationUtils.ts` + `src/hooks/combat/useTargetValidator.ts` | Both validators now use the shared `CreatureTaxonomy` checks for creature-type compatibility logic. |
| `src/types/spells.ts` + `src/systems/spells/validation/targetingSchemas.ts` | Spell targeting schema favors plural arrays for new writes while preserving legacy singular aliases in the TypeScript interface. |
| `src/types/combat.ts` | Combat-side target filters already use plural `creatureTypes` and singular `alignment`, confirming validator integration must preserve multiple consumer shapes. |
| `docs/projects/creatures/AUDIT_OR_PROOF.md` | Documents the source-backed monster-corpus boundary and confirms that generated creature data remains pipeline-owned. |

## Cold-Start Resume Path (Strict)

When resuming this project:

1. Read this file fully.
2. Read `docs/projects/creatures/TRACKER.md` and `docs/projects/creatures/GAPS.md`.
3. Start with G4/G5 as adjacent follow-ups: review semantics and corpus/data-ownership decisions first.
4. Use the file map above to pick the owned slice with the least ambiguity.
5. Confirm `AGENTS.md`, `docs/projects/PROJECT_TRACKER.md`, and `docs/projects/GLOBAL_GAPS.md` before cross-project routing.

## Artifact Boundary

- Durable: project docs in `docs/projects/creatures/` and gap records.
- Not durable: terminal output, one-off branch notes, generated vendor dumps, and raw local logs.
