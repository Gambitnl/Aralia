---
schema_version: 1
gap_schema: project_gap_registry
project: Roadmap Maintenance
slug: roadmap-maintenance
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 1
visual_proof_required_count: 1
highest_severity: high
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/roadmap-maintenance/NORTH_STAR.md
tracker: docs/projects/roadmap-maintenance/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Roadmap Maintenance Gap Registry

Status: active
Last updated: 2026-06-25

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

Current open gaps are G2, G3, G5, G6, G7, and G8. G7 and G8 were imported
from retired `docs/plans` backlog files on 2026-06-25 so the roadmap extraction
contract and standalone server boundary work now have living owners.

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | medium | support_needed_now | future agent | confirmed | project |  | none | none | current | `docs/projects/roadmap-maintenance` + `roadmap-local` bridge | Local open-task pass; `1C-ROADMAP-IMPLEMENTATION-PLAN.md` retirement 2026-06-25 | The remaining roadmap-local open items still need durable routing: task-number collision validation, full documentation categorization, queue-driven document processing, vision freshness workflow, and hybrid insights pipeline. | Retired `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`; `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md`; `devtools/roadmap/scripts/roadmap-storage.ts`; `package.json` roadmap scripts | These items are real, remain open in local evidence, and need one glance of project ownership before a fresh roadmap-local run changes anything. | Keep each item here unless a new audit proves it belongs in `docs/projects/GLOBAL_GAPS.md` or in local-only runtime state. | Re-run the open-task snapshot or audit output and confirm the same routing decision; `npx vitest run devtools/roadmap/scripts/roadmap-server-logic.test.ts --reporter=dot` passed 3 tests during the retirement pass. |  |
| G3 | not_started | low | adjacent_follow_up | future agent | confirmed | project |  | none | none | not_recorded | `docs/projects/roadmap-maintenance` | Evidence capture | The cross-check output files may be historical rather than fresh proof, and this docs pass should not imply otherwise. | `devtools/roadmap/ROADMAP_FEATURE_CROSSCHECK.md`; `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`; `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` | Stale cross-check artifacts can cause false confidence in roadmap alignment and downstream decisions. | Treat them as historical until a new roadmap-local run refreshes the timestamps or proof summary. | Refresh the proof date or add an explicit historical note before using them as current evidence. |  |
| G5 | blocked | high | blocked_human_decision | human/product owner + roadmap maintainer | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | decision_required | none | not_recorded | `docs/projects/code-modularization-audit/GAPS.md` CMA-G1 | Code modularization audit routing | Roadmap visualizer/generator files are large modularization candidates, but roadmap-local evidence and review gates must be settled before code movement. | `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx`; `devtools/roadmap/scripts/roadmap-engine/generate.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G1 | Roadmap is the project discoverability surface; an unsafe split can corrupt status/routing visibility. | Keep this routing-only until roadmap-local ownership and review gate are clear. | Owner-approved split plan names proof commands and preserves node health/routing behavior. |  |
| G6 | not_started | medium | workflow | Codex | confirmed | spells |  | none | none | not_recorded | roadmap capability IDs | Spell migration roadmap backlog routing | Roadmap capability rows need deterministic node-ID conventions so related spell docs do not collide when visualized or indexed. | Routed from `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md` on 2026-06-25; roadmap visualizer/generator node ID logic; Spells roadmap capability rows | Colliding IDs make unrelated capability rows merge visually, which hides real spell work and confuses agent routing. | Define a node-ID convention that includes project/lane/source identity, then test it against related spell roadmap docs. | Roadmap generation proof showing stable unique IDs for the spell roadmap capability rows and no duplicate-node warnings. |  |
| G7 | not_started | medium | workflow | future agent | confirmed | retired plan |  | none | none | source_checked | roadmap capability extraction contract | Backlog retirement of `docs/plans/2026-03-15-capability-decision-plan.md` on 2026-06-25 | The capability-extraction doctrine is not yet fully canonicalized in the roadmap tooling contract: roadmap-relevant docs should emit capability name, parent branch, primary status, optional blocked note, evidence basis, and node type; node names should be stable noun phrases, atomized, semantically placed, and separated from backlog/task wording. | Retired `docs/plans/2026-03-15-capability-decision-plan.md`; `devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts`; `devtools/roadmap/scripts/roadmap-engine/generate.ts`; `devtools/roadmap/scripts/roadmap-engine/types.ts`; `devtools/roadmap/src/spell-branch/` | The current orchestrator already pushes feature-oriented naming and extraction, but the plan's full status vocabulary and extraction payload rules are not all represented as a durable contract. Without that, future roadmap batches can drift back into vague process labels or duplicate broad nodes. | Create a compact roadmap extraction contract in the roadmap maintenance/runbook surface, then align worker prompts, schema/types, and generator naming guards where needed. | Focused source check showing the contract exists and the orchestrator/generator either enforce it or explicitly defer each rule; roadmap audit command proves no new process-label or duplicate broad-node regression. | This migrates the plan's living work without copying the whole essay. Spell-specific tree work remains a prerequisite/context item, not a second copy of the plan. |
| G8 | not_started | high | architecture | future agent | confirmed | retired plan | docs/projects/code-modularization-audit/GAPS.md CMA-G1 | decision_required | visual_proof_required | source_checked | roadmap standalone server boundary | Backlog retirement of `docs/plans/2026-03-18-roadmap-server-separation-plan.md` on 2026-06-25 | Roadmap still runs as a root Vite mode instead of a standalone roadmap-owned server/config boundary. `npm run dev:roadmap` still points to `vite --mode roadmap --host 0.0.0.0 --port 3010`, and root `vite.config.ts` still owns roadmap runtime behavior. | Retired `docs/plans/2026-03-18-roadmap-server-separation-plan.md`; `package.json`; `vite.config.ts`; `devtools/roadmap/scripts/roadmap-server-logic.ts`; `.agent/roadmap-local/`; Roadmap Maintenance G5 | The roadmap tool has grown into its own local app with storage, audits, opportunity scanning, and visual state. Keeping its runtime boundary hidden inside root Vite makes ownership confusing and increases the chance that main-app dev-server changes break roadmap behavior. | Build a parallel roadmap-owned Vite/server config under `devtools/roadmap/`, keep the old mode only for parity review, then cut over `npm run dev:roadmap` and Dev Hub launcher assumptions after route/API/storage/rendered parity is proven. | Route checks, API checks, storage checks, rendered roadmap visual proof, and a code-ownership check proving root `vite.config.ts` no longer owns roadmap server behavior. | Temporary duplication is acceptable during migration if it is visible and preserves roadmap behavior. Do not remove the old mode before parity is proven. |
| G9 | not_started | medium | integration | future agent | confirmed | spells | docs/projects/spells/GAPS.md G21-G23 | none | rendered proof required when implemented | source_checked | spell AI arbitration capability cross-links | Backlog retirement of `docs/tasks/roadmap/1E-SPELL-ROADMAP-ONTOLOGY-QUESTIONS.md` on 2026-06-25 | Spell branch profiles currently collapse `arbitrationType` into a boolean `arbitrationRequired` axis, but the roadmap still lacks capability links that explain why `ai_assisted` and `ai_dm` spells depend on AI input, context-feeding, terrain/material context, or deterministic exclusion rules. | Retired 1E ontology questions; `devtools/roadmap/src/spell-branch/types.ts`; `devtools/roadmap/scripts/generate-spell-profiles.ts`; `devtools/roadmap/src/spell-branch/axis-engine.ts`; `docs/tasks/spells/PACKAGE_5_AI_ARBITRATION_PILOT.md`; `docs/projects/spells/GAPS.md` G21-G23 | Without explicit capability links, the Spell Branch Navigator can show that AI arbitration is required but not what supporting systems make a spell complete or incomplete. | After the roadmap capability-extraction contract lands, add spell AI arbitration capability links for curated `ai_dm` and `ai_assisted` examples, preserving the boolean axis while surfacing the deeper implementation dependencies in capability nodes. | Roadmap generation/source proof showing the AI arbitration spell examples link to stable capability nodes, plus rendered or simulator proof for any newly implemented cast-time context behavior. | The cast-time semantics remain owned by Spells G21-G23; this row owns the roadmap/capability-link representation only. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Task cannot complete without it in this project slice. |
| `support_needed_now` | Needed for this slice to continue meaningfully, but not final ownership here. |
| `adjacent_follow_up` | Useful and related; not required to mark this pass complete. |
| `out_of_scope` | Not part of this project surface. |
| `blocked_human_decision` | Requires explicit human/owner routing choice. |
| `blocked_external_state` | Requires external tool run/state snapshot refresh not available in docs-only pass. |
| `uncertainty` | The gap is real, but exact ownership or scope boundary is still under evidence collection. |

## What to read next for continuity

1. `docs/projects/roadmap-maintenance/NORTH_STAR.md`
2. `docs/projects/roadmap-maintenance/TRACKER.md`
3. `devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md` and this gap registry
4. `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md`
5. `devtools/roadmap/ROADMAP_AUDIT_RUNBOOK.local.md` and `devtools/roadmap/ROADMAP_BRANCH_COMPLETENESS_AUDIT.md`

## Notes

Open items here are evidence-driven and intentionally scoped. This is documentation maintenance; no source edits are required or expected in this pass.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
