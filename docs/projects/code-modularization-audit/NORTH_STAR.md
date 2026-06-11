---
schema_version: 1
project: Code Modularization Audit
slug: code-modularization-audit
category: tools
main_category: "Tools, Docs & Agents"
subcategory: "Scripts & Automation"
status: active
last_updated: 2026-06-10
confidence: high
evidence: "docs/projects/code-modularization-audit/GAPS.md; repo line-count scans run 2026-06-08; owner-acceptance scan iteration 6 confirmed all six stub rows present"
gap_signal: "CMA-G14..G19 stub rows now exist in all six owner GAPS files; no owner has accepted/activated their route; project stays in routing/evidence posture"
protocol: living-project-task-protocol
next_step: wait for owning projects to accept the routed candidate clusters, then create bounded split plans with preservation tests
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
  - AUDIT_OR_PROOF.md if future passes preserve detailed scan outputs
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
last_proof: ""
workflow_gaps_reviewed: 2026-06-10
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Code Modularization Audit North Star

Status: active
Last updated: 2026-06-09

## Dashboard Card Schema

| Field | Value |
|---|---|
| schema_version | 1 |
| project | Code Modularization Audit |
| slug | code-modularization-audit |
| category | tools |
| status | active |
| last_updated | 2026-06-10 |
| confidence | high |
| evidence | `docs/projects/code-modularization-audit/GAPS.md`; repo line-count scans run 2026-06-08 |
| gap_signal | next tranche of large-file candidates routed in G14-G19; owner acceptance pending |
| protocol | living-project-task-protocol |
| next_step | wait for owning projects to accept the routed candidate clusters, then create bounded split plans with preservation tests |
| required_docs | NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md |
| optional_docs | AUDIT_OR_PROOF.md if future passes preserve detailed scan outputs |
| workflow_gaps_reviewed | 2026-06-10 |
| compaction_status | not_needed |

## Why This Exists

Aralia has several very large source files. Some are intentionally generated data and should not be split by hand; others are human-maintained orchestrators, UI surfaces, or script engines where size now makes review, testing, and sub-agent iteration harder.

This project owns the discovery and routing layer for modularization candidates. It does not delete systems, flatten behavior, or perform broad cleanup. It records where modularization would preserve behavior while making future expansion safer.

## Current State

An initial line-count scan was run across `src`, `scripts`, and `devtools`, excluding common generated/build folders. The scan identified two categories:

- Generated or corpus-heavy files that should be handled through generation/sharding policy, not manual refactor.
- Human-maintained files that are likely modularization candidates after dependency and test-boundary review.

A second pass surfaced additional human-maintained clusters in `three-d-modal`, `battle-map`, `submap`, `layout`, `combat`, and `scripts-audits`. Those routes are recorded in `GAPS.md` as CMA-G14 through CMA-G19 and remain preservation-only until the owning projects accept them.

## Scope Boundaries

In scope:

- Rank large files by refactor value and risk.
- Identify existing owners before creating new work.
- Add project or global gaps for concrete split candidates.
- Preserve comments, future intent, generated-file policy, and current behavior.

Out of scope:

- Deleting old systems to reduce line count.
- Splitting generated files manually without generator/sharding evidence.
- Broad lint/type cleanup not tied to a candidate.
- Moving gameplay behavior without project-owner routing.

## Initial Evidence Snapshot

Largest files from the first scan:

| Lines | Path | Initial classification |
|---:|---|---|
| 289411 | `src/data/monsters.generated.ts` | generated/corpus; generation or sharding policy, not manual split |
| 9459 | `src/data/items/generatedGlossaryItems.ts` | generated/corpus; likely item/glossary owner |
| 3407 | `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` | human-maintained roadmap UI candidate |
| 3195 | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts` | human-maintained glossary/spell gate candidate |
| 2752 | `devtools/roadmap/scripts/roadmap-engine/generate.ts` | human-maintained roadmap engine candidate |
| 1565 | `scripts/raceReconciliationInventory.ts` | script/audit candidate |
| 1536 | `src/components/DesignPreview/steps/PreviewComponents.tsx` | UI candidate |
| 1493 | `scripts/auditSpellRuntimeTemplate.ts` | script/spell audit candidate |
| 1472 | `src/utils/character/characterUtils.ts` | character rules candidate |
| 1251 | `scripts/auditSpellStructuredAgainstCanonical.ts` | script/spell audit candidate |
| 1235 | `src/hooks/__tests__/useAbilitySystem.test.ts` | test fixture/helper split candidate |
| 1161 | `src/App.tsx` | app shell/orchestration candidate |
| 1083 | `src/components/BattleMap/vfx/VFXSystem.tsx` | battle-map VFX candidate |
| 1068 | `src/hooks/useAbilitySystem.ts` | command/spell bridge candidate |
| 1007 | `src/hooks/combat/engine/useCombatEngine.ts` | combat engine candidate |
| 817 | `src/components/Submap/painters/SubmapDoodadPainter.ts` | submap phase-out extraction candidate |

## Iteration 1 Scoring Summary (2026-06-08)

`GAPS.md` rows CMA-G1 through CMA-G7 now have explicit routing and risk:

- `CMA-G1` (`Roadmap visualizer + generate.ts`) - **routed**, high risk, owner `roadmap-maintenance` (review-gated; no forward movement until gate clear).
- `CMA-G2` (`spellGateBucketDetails.ts`) - **narrowed**, medium risk, owner `glossary-ui`/structured spell validation boundary.
- `CMA-G3` (`PreviewComponents.tsx`) - **narrowed**, medium risk, owner `design-preview`.
- `CMA-G4` (`App.tsx`, `useAbilitySystem.ts`, `useCombatEngine.ts`) - **narrowed**, high risk, owners `providers`, `layout`, `combat`, `battle-map`.
- `CMA-G5` (`VFXSystem.tsx`) - **narrowed**, medium risk, owner `battle-map`.
- `CMA-G6` (`SubmapDoodadPainter.ts`) - **narrowed**, medium risk, owner `submap`.
- `CMA-G7` (generated corpus files) - **done**, routed to data pipelines (`creatures` + `item_categorization` + glossary-data rebuild ownership).
- `CMA-G8` through `CMA-G13` - **routed**, second-tranche candidates now have owner-local gap rows before any implementation work.
- `CMA-G14` through `CMA-G19` - **routed**, next-tranche candidates now cover `three-d-modal`, `battle-map`, `submap`, `layout`, `combat`, and `scripts-audits`.

No generated-file modularization candidates are left in this scoring set.

## Must Preserve

- Generated files remain generated unless their generator or sharding policy changes.
- Gameplay logic embedded in large files must be routed to the owning project before movement.
- Existing TODO references that mention modularization must keep their durable path references current when code moves.

## Resume Path

1. Read this file, then `TRACKER.md` and `GAPS.md`.
2. Pick one candidate row.
3. Pick an owner-routed candidate only after that owning project is active and not review-gated.
4. Only write a narrow split plan when the route is accepted and the preservation/test boundary is clear.
