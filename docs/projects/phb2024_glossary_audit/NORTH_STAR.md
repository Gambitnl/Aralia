---
schema_version: 1
project: PHB 2024 Glossary Audit
slug: phb2024_glossary_audit
category: Documentation / Living Project Rollout
main_category: Review / Archive
subcategory: Deprecation Review
status: reference-only
last_updated: 2026-06-12
iteration: 3
confidence: high
evidence: docs/projects/phb2024_glossary_audit/NORTH_STAR.md, docs/projects/phb2024_glossary_audit/TRACKER.md, docs/projects/phb2024_glossary_audit/GAPS.md, docs/projects/DECISION_BLITZ_2026-06-10.md (D24)
gap_signal: "3 open gaps; Archived as reference-only 2026-06-10; 3 open gaps remain routed to adjacent owners (Item Categorization and Glossary maintenance)"
protocol: living project doc set
next_step: "Archived as reference-only (decision recorded 2026-06-10, DECISION_BLITZ D24). Do not assign iteration agents here; remaining gap work runs through docs/projects/item_categorization and docs/tasks/glossary."
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
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: reference-only
deprecation_confidence: strong
deprecation_reason: archived_reference_only_2026-06-10_gaps_routed_to_adjacent_owners
canonical_owner: "docs/projects/item_categorization for itemMetadata parity; docs/tasks/glossary for rebuild workflow"
human_decision_required: "no"
---
# NORTH STAR: PHB 2024 Glossary Audit

Status: reference-only â€” decision recorded 2026-06-10 (archived; gaps routed to adjacent owners)
Last updated: 2026-06-12

## Dashboard Card Schema

Project: PHB 2024 Glossary Audit
Slug: phb2024_glossary_audit
Category: Documentation / Living Project Rollout
Status: reference-only (archived 2026-06-10)
Confidence: high
Evidence: docs/projects/phb2024_glossary_audit/NORTH_STAR.md, docs/projects/phb2024_glossary_audit/TRACKER.md, docs/projects/phb2024_glossary_audit/GAPS.md, docs/projects/DECISION_BLITZ_2026-06-10.md (D24)
Gap signal: archived as reference-only 2026-06-10; remaining gaps stay routed to Item Categorization and Glossary maintenance
Protocol: living project doc set
Next step: Archived; do not assign iteration agents here. Remaining gap work runs through docs/projects/item_categorization and docs/tasks/glossary.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Lifecycle status: reference-only
Deprecation confidence: strong
Deprecation reason: archived_reference_only_2026-06-10_gaps_routed_to_adjacent_owners
Canonical owner: docs/projects/item_categorization for itemMetadata parity; docs/tasks/glossary for rebuild workflow
Human decision required: no

## Why This Project Exists

Capture the remaining 2024 Player's Handbook glossary work needed for Aralia without expanding this project into spell, class, or race migration.

## Intended Outcome

Keep the PHB 2024 glossary family surface complete, documented, and safely resumable without widening scope into unrelated systems.

## Current State

The in-scope PHB 2024 glossary families are ingested and wired into the glossary UI. The implementation slice is complete, but the project still carries three open follow-ups: item metadata contract parity, a non-dev rebuild contract, and a glossary-scope boundary note. All remaining gaps are routed to adjacent owners rather than this audit surface.

## Required Review Brief

Title: Merge-candidate review for PHB 2024 Glossary Audit
Question: Should this audit project become reference-only after routing remaining gaps to adjacent owners?
Issue: The implementation slice is complete, but three open gaps remain that cross into adjacent project boundaries (itemMetadata parity, glossary rebuild workflow, and glossary scope overlap).
Current behavior: The project is marked as review-required with lifecycle_status: merge-candidate. Forward iteration agents are blocked from assigning work until human review clears the status.
Why blocked: The remaining gaps belong to adjacent owners (docs/projects/item_categorization and docs/tasks/glossary). Continuing to treat this audit surface as the canonical owner would create ownership confusion and duplicate work tracking.
Option A: Archive this project as reference-only and route all remaining gap work to the owning projects.
Option B: Keep this project active but explicitly mark it as a coordination surface only, with all implementation work routed through owning projects.
Evidence: GAPS.md shows three open gaps with adjacent owners; NORTH_STAR.md lifecycle_status is merge-candidate; TRACKER.md shows review-gated work.
Decision owner: Human/product owner
Proof after decision: Update NORTH_STAR.md lifecycle_status and canonical_owner fields; update TRACKER.md next checks accordingly.

### Decision (2026-06-10)

Resolved â€” **Option A selected: archive this project as reference-only.** Remaining gap work stays routed to the adjacent owners: itemMetadata contract parity to Item Categorization (`docs/projects/item_categorization`) and the non-dev rebuild workflow / scope-overlap questions to Glossary maintenance (`docs/tasks/glossary`).

- Decider: Remy (project owner), batched decision session 2026-06-10.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D24); local record: `docs/projects/phb2024_glossary_audit/DECISIONS.md` (2026-06-10 entry).
- Status: decision recorded 2026-06-10; merge-candidate review cleared. This surface is now reference-only â€” no forward iteration agents; the docs remain as the durable record of the PHB 2024 family audit.

## Active Task

| Field | Value |
|---|---|
| Task | Wait for human review to clear merge-candidate status |
| Acceptance criteria | Human decides whether this audit becomes reference-only or continues as active; remaining gaps are already routed to adjacent owners |
| Allowed boundaries | docs/projects/phb2024_glossary_audit/ only for doc updates |
| Stop condition | Do not assign forward iteration work until human review is complete |
| Verification | None required for this review-gated state |
| Owner | Human review |
| Next action | Review complete 2026-06-10 (DECISION_BLITZ D24): archived as reference-only; routed gap work continues in the owning projects (Item Categorization, Glossary maintenance) |

## Scope Boundaries

In scope:
- PHB 2024 glossary families: Feats, Backgrounds, Items, Skills, Senses, Languages, and Hazards where source: "XPHB" or basicRules2024 === true
- Project-facing docs for the living-project rollout
- Evidence summaries and durable handoff text for the project

Adjacent but not in this slice:
- docs/projects/item_categorization
- docs/tasks/glossary
- runtime glossary output and rebuild mechanics

Out of scope:
- Spells
- Classes and races
- Non-2024 rule text

## What Must Not Be Lost

- The in-scope 2024 family boundary
- The item metadata extraction history (type, value, weight, dmg1, ac)
- The glossary UI category wiring for the new PHB folders
- The distinction between project-local gaps and cross-project routing

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Item metadata contract parity | support_needed_now | item-categorization follow-up work | GAPS.md | Align ownership in one owning project and verify end-to-end through generated item registry output |
| Non-dev glossary rebuild contract | adjacent_follow_up | glossary maintenance workflow | GAPS.md | Document and verify a repeatable non-interactive rebuild command chain |
| Glossary scope overlap | adjacent_follow_up | docs/tasks/glossary | GAPS.md | Keep this project scoped to PHB 2024 family completion and route mixed-priority rule-surface questions to docs/tasks/glossary |

## Global Gap Imports

Check the global gap tracker before creating this project surface:
`docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | The checked global gaps are unrelated to PHB 2024 glossary audit scope, so nothing was imported in this pass. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Current project docs | The project handoff is present and synced to the current iteration | docs/projects/phb2024_glossary_audit/ |
| PHB glossary generator and UI file map | The original implementation surface and current evidence anchors | scripts/ingestPhbGlossary.ts, scripts/generateGlossaryIndex.js, src/components/Glossary/glossaryUIUtils.tsx |
| Shared dashboard schema | The card fields are being filled from the documented schema | docs/projects/PROJECT_CARD_SCHEMA.md |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/PROJECT_TRACKER.md | Repo-level project registry | active |
| docs/projects/phb2024_glossary_audit/TRACKER.md | Active queue, blockers, and next checks | active |
| docs/projects/phb2024_glossary_audit/GAPS.md | Durable project gap log | active |
| docs/projects/GLOBAL_GAPS.md | Cross-project and out-of-scope gap surfacing | active |

## Artifact Boundary

Track durable intent, decisions, verification summaries, promoted proof, and next actions. Keep raw logs, generated files, temporary screenshots, caches, and local run state external or ignored unless a concise summary or proof excerpt is useful later.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Which project should own itemMetadata parity? | The current gap crosses into adjacent item work and needs a single owner for a clean handoff | item-categorization follow-up work | next gap-routing pass |
| What is the durable non-dev rebuild command chain? | Maintenance and CI need a repeatable glossary refresh path that is not tied to ad hoc dev flows | glossary maintenance workflow | next maintenance pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read TRACKER.md.
3. Read GAPS.md.
4. Review docs/projects/PROJECT_CARD_SCHEMA.md and docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md for dashboard and workflow context.
5. Do not assign forward iteration work until the human review clears the merge-candidate status. The remaining gaps are routed to adjacent owners (itemMetadata parity to docs/projects/item_categorization, rebuild workflow to docs/tasks/glossary). *(Review cleared 2026-06-10: archived as reference-only â€” DECISION_BLITZ D24. No forward iteration here; work only in the routed owners.)*
