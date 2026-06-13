---
schema_version: 1
project: Encounter Generator
slug: encounter-generator
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-09
iteration: 3
confidence: medium
evidence: docs/projects/encounter-generator
gap_signal: 1 open gap (G4 AI determinism boundary)
protocol: living project doc set
next_step: Resolve G4 human decision (full AI replay vs local-only replay contract), then resume T3/T4 implementation if approved.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Encounter Generator North Star

Status: review-required
Last updated: 2026-06-09

## Dashboard Card Schema

Project: Encounter Generator
Slug: encounter-generator
Category: Feature/UI Projects
Status: review-required
Confidence: medium
Evidence: docs/projects/encounter-generator
Gap signal: 1 open gap (G4 AI determinism boundary)
Protocol: living project doc set
Next step: Resolve G4 human decision (full AI replay vs local-only replay contract), then resume T3/T4 implementation if approved.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Required Review Brief

Title: AI determinism boundary for encounter replay
Question: Should encounter replay guarantee identical AI-generated encounters for the same seed, or only guarantee deterministic local/fallback generation?
Issue: The seed now reaches the AI trigger, fallback, validation, and bestiary paths, but Gemini output can still vary for the same prompt and seed-like context.
Current behavior: Bestiary and fallback generation are deterministic with a fixed seed; provider-backed AI generation is constrained by prompt/seed context but not guaranteed to replay exactly.
Decision blocked: Forward replay/sharing work needs a product decision before agents expand beyond the local deterministic contract.

| Decision axis | Option A | Option B |
|---|---|---|
| Replay contract | Require strict AI replay | Accept local/fallback deterministic replay only |
| Required work | Add seed-to-cache/model binding and CI replay proof | Document provider nondeterminism and keep current seed contract |
| Consequence | Stronger reproducibility, larger service/storage contract | Faster rollout, but AI encounter replay remains best-effort |

Evidence: `src/hooks/actions/handleEncounter.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts`, `src/utils/world/bestiaryEncounterGenerator.ts`
Decision owner: Human/product owner for replay and sharing policy
Proof after decision: Add a focused replay acceptance test or an explicit docs boundary before implementation resumes.

## Purpose and scope

The Encounter Generator project tracks how encounters are generated (AI, fallback, and bestiary), validated, and moved into combat.

## Implementation map

| File | Why it matters |
|---|---|
| src/components/Combat/EncounterModal.tsx | Main encounter creation flow (AI, custom, bestiary) |
| src/hooks/actions/handleEncounter.ts | Encounter action entry and deterministic seed source |
| src/services/gemini/encounters.ts | AI encounter generation and fallback handoff |
| src/services/geminiServiceFallback.ts | Fallback encounter generation and deterministic seed injection |
| src/utils/world/bestiaryEncounterGenerator.ts | Offline bestiary encounter generation |
| src/utils/world/encounterUtils.ts | Encounter validation and fallback rebuild policy |
| src/utils/combat/encounterDifficulty.ts | Shared difficulty math contract |

## Implemented state

- Encounter flow is connected across AI, custom, and bestiary tabs.
- Seedability is now wired through one deterministic replay input in:
  - AI trigger path (`handleEncounter.ts`)
  - Gemini fallback (`geminiServiceFallback.ts`)
  - Bestiary generation and rerolls (`bestiaryEncounterGenerator.ts`, `EncounterModal.tsx`)
- Difficulty is computed through the shared `calculateDifficulty` contract in `encounterDifficulty.ts` in all relevant display/validation paths.
- Scope remains the combat encounter flow; `EncounterGenerator/` currently holds auxiliary party utilities only.

## Integrations

- `EncounterModal` opens and dispatches actions through `GameModals.tsx`, then hands encounter payloads to combat reducer paths.
- AI and fallback paths both return encounter arrays that are normalized before combat and displayed through shared difficulty logic.
- Bestiary local generation uses deterministic seeds in the roll loop and supports reroll + filter changes.

## Scope note

This project intentionally does not claim a standalone encounter runtime under `src/components/EncounterGenerator/*` as the implementation owner. Core runtime behavior lives in `Combat` and shared world/services utilities.

## Resume path

- Start from `TRACKER.md` task T3.
- Keep this slice bounded to seedability + difficulty contract consistency.
- Use the same seed source path and `calculateDifficulty` as the contract baseline for additional encounter features.

## Next checks

- Decide whether strict AI output determinism is required (seed-only replay currently does not control provider generation).
- Add scoped tests for any additional generation path touched in the next slice.
- Update gap entries if scope or policy shifts.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first.
- review source around seed flow and difficulty contract in the active task scope.
- add/route one real project gap if a new ambiguity remains after this slice.
- do not create artificial gaps to satisfy a quota.
