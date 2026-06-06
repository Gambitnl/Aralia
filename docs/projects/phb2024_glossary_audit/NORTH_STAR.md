# NORTH STAR: PHB 2024 Glossary Audit

Status: partial
Last updated: 2026-06-05

## Dashboard Card Schema

Project: PHB 2024 Glossary Audit
Slug: phb2024_glossary_audit
Category: Documentation / Living Project Rollout
Status: partial
Confidence: high
Evidence: docs/projects/phb2024_glossary_audit/NORTH_STAR.md, docs/projects/phb2024_glossary_audit/TRACKER.md, docs/projects/phb2024_glossary_audit/GAPS.md
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Resolve itemMetadata contract parity with the owning project.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Why This Project Exists

Capture the remaining 2024 Player's Handbook glossary work needed for Aralia without expanding this project into spell, class, or race migration.

## Intended Outcome

Keep the PHB 2024 glossary family surface complete, documented, and safely resumable without widening scope into unrelated systems.

## Current State

The in-scope PHB 2024 glossary families are ingested and wired into the glossary UI. The implementation slice is complete, but the project still carries three open follow-ups: item metadata contract parity, a non-dev rebuild contract, and a glossary-scope boundary note.

## Active Task

| Field | Value |
|---|---|
| Task | Refresh the living-project docs and dashboard schema for the current project state |
| Acceptance criteria | NORTH_STAR.md includes a current Dashboard Card Schema; TRACKER.md, GAPS.md, and COLD_START_AGENT_PROMPT.md agree on scope, open gaps, and next action; no implementation work is claimed beyond the existing evidence |
| Allowed boundaries | docs/projects/phb2024_glossary_audit/ plus docs/projects/PROJECT_CARD_SCHEMA.md and docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md for schema/workflow reference |
| Stop condition | Do not touch glossary runtime, ingest scripts, or adjacent item/categorization code |
| Verification | git diff --check on the edited markdown files |
| Owner | Codex docs pass |
| Next action | Choose the highest-value open gap from GAPS.md and route it to the owning project before widening scope |

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
5. Continue from: resolve the highest-value open gap, starting with itemMetadata contract parity if the owning project is available.
