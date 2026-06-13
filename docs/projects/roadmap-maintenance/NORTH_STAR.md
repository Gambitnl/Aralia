---
schema_version: 1
project: Roadmap Maintenance
slug: roadmap-maintenance
category: Projectized Planning Areas
main_category: "Content & Rules"
subcategory: "Items & Content Pipelines"
status: active
last_updated: 2026-06-12
iteration: 2
confidence: medium
evidence: docs/projects/roadmap-maintenance
gap_signal: "3 open gaps; G2, G3, and G5 remain open after G1 and G4 closure"
protocol: living project doc set
next_step: Keep the remaining roadmap-local open items routed here until a fresh audit run changes the evidence set.
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
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Roadmap Maintenance North Star

Status: active
Last updated: 2026-06-12

## Why this project exists

This folder is the surviving `roadmap-maintenance` registration in `docs/projects` and preserves the durable, cross-cycle facts for a project whose source evidence remains in an ignored roadmap tool tree.

The canonical evidence pointer is `docs/projects/PROJECT_TRACKER.md` (row: Roadmap Maintenance, line 148), which still points to `docs/tasks/roadmap` and expects this project to keep the living docs set maintained.

## Project intent and evidence basis

- `docs/projects/PROJECT_TRACKER.md` marks Roadmap Maintenance as **planned** and already linked to `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`.
- `docs/tasks/roadmap` is the historical planning corpus for roadmap tooling and remains referenced as evidence, but it is gitignored in this repo (`.gitignore:193`).
- `devtools/roadmap` is the live tooling folder for implementation and includes: `scripts/roadmap-*.ts`, audit references, and generated cross-check outputs.
- `package.json` exposes roadmap orchestration scripts (`roadmap:*`) and `dev:roadmap` for the local visualizer (`vite --mode roadmap --host 0.0.0.0 --port 3010`).
- `.agent/roadmap-local` is the local workspace and stores orchestration state snapshots (`processing_manifest.json`, `doc_library.json`, `path_provenance.json`).
- `devtools/roadmap/scripts/roadmap-storage.ts` treats `tooling_state.sqlite` as the local source of truth and writes compatibility snapshots for legacy JSON artifacts.
- `devtools/roadmap/scripts/roadmap-session-close.ts`, `roadmap-process-game-docs.ts`, and `roadmap-derive-structured-doc.ts` are the current orchestration boundaries for document processing and structured extraction.

## Dashboard Card Schema

Project: Roadmap Maintenance
Slug: roadmap-maintenance
Category: Projectized Planning Areas
Status: active
Confidence: medium
Evidence: `docs/projects/roadmap-maintenance`
Gap signal: 3 open gaps; G2, G3, and G5 remain open after G1 and G4 closure
Protocol: living project doc set
Next step: Keep the remaining roadmap-local open items routed here until a fresh audit run changes the evidence set.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Current State (as of 2026-06-05)

- Registered row exists in `docs/projects/PROJECT_TRACKER.md` and still acts as the stable cross-cycle owner.
- The durable project docs in this folder are present and now carry the dashboard card schema directly (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`).
- The open roadmap-local items from the visualizer evidence are now routed as project-owned gaps instead of being left implicit in local notes.
- The shared workflow path mismatch remains a workflow-level concern and is tracked centrally, not duplicated here.
- The dated roadmap audit artifacts remain useful as historical evidence, but this project docs set should not imply they are fresh proof unless a new run updates them.

## What must not be lost

1. The project must remain in this folder only as the durable handoff and not in the ignored `docs/tasks/roadmap` area.
2. The boundary between:
   - current operational tooling (`devtools/roadmap`, package scripts, `.agent/roadmap-local`), and
   - durable roadmap evidence (`docs/tasks/roadmap`)
   must remain explicit in project docs.
3. The partial/open status of roadmap maintenance items should be documented as `open`/`uncertain` when directly evidenced, rather than implied complete.

## Active Task

| Field | Value |
|---|---|
| Task | Keep Roadmap Maintenance docs aligned with the living-project workflow while routing the remaining roadmap-local open items into the project gap set. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay evidence-backed on project ownership, storage/operational facts, dashboard schema, and open roadmap-maintenance gaps with next-step owners. |
| Allowed boundaries | `docs/projects/roadmap-maintenance` plus the directly referenced shared workflow/schema docs. No source edits. |
| Stop condition | The dashboard card fields are present, the gap rows are compact and actionable, and the next agent can resume without re-deriving the path mismatch. |
| Verification | Manual doc inspection of this project folder, `docs/projects/PROJECT_CARD_SCHEMA.md`, `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, and `git diff --check` on changed files. |
| Owner | future agent |
| Next action | Revisit the routing only when `.agent/roadmap-local` or the roadmap audit artifacts change. |

## Scope boundaries

In scope:
- Roadmap maintenance ownership/schema notes for this project.
- Evidence-backed tracker maintenance and cold-start guidance.
- Classification of unresolved roadmap maintenance items that affect continuation.

Adjacent but out of scope:
- Changing roadmap engine code or running script command output updates.
- Expanding or rewiring `.agent/roadmap-local` feature notes.

Out of scope:
- Source code edits and live runtime behavior changes.

## Resume Path for a cold agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Confirm `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` references.
5. Continue with next in-scope action from `TRACKER.md` and `GAPS.md`.

## Evidence Index (high signal)

- `docs/projects/PROJECT_TRACKER.md` (project registration row)
- `docs/tasks/roadmap/NORTH_STAR.md` (historical scaffold)
- `package.json` (`roadmap:*`, `dev:roadmap` scripts)
- `devtools/roadmap/scripts/roadmap-storage.ts` (SQLite + compatibility snapshots)
- `.agent/roadmap-local/README.md` (local workspace notes)
- `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md` (current open items)
- `docs/projects/PROJECT_CARD_SCHEMA.md` (dashboard card field schema)
- `docs/projects/GLOBAL_GAPS.md` (cross-project gap routing baseline)
- `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` (workflow-level path ambiguity)

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
