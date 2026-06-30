---
schema_version: 1
project: "Scripts: Archive"
slug: scripts-archive
category: Docs / Continuity
main_category: Review / Archive
subcategory: Deprecation Review
status: active
last_updated: 2026-06-17
iteration: 4
confidence: medium
evidence: docs/projects/scripts-archive
gap_signal: "1 open gap; 1 review-required (archive tombstone policy pending human decision)"
protocol: living project doc set
next_step: Human operator decides archive tombstone policy per Required Review Brief in this file.
agent_comments: ""
active_agent: Qoder CLI
agent_pass_status: finished
agent_pass_started_at: "2026-06-17T18:10:00+02:00"
agent_pass_ended_at: "2026-06-17T18:14:15+02:00"
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
last_proof: 2026-06-17
workflow_gaps_reviewed: 2026-06-17
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# NORTHSTAR: Scripts: Archive

Status: active
Last updated: 2026-06-17

## Dashboard Card Schema

Project: Scripts: Archive
Slug: scripts-archive
Category: Docs / Continuity
Main category: Review / Archive
Subcategory: Deprecation Review
Status: active
Last updated: 2026-06-17
Iteration: 4
Confidence: medium
Evidence: docs/projects/scripts-archive
Gap signal: 1 open gap; 1 review-required (archive tombstone policy pending human decision)
Protocol: living project doc set
Next step: Human operator decides archive tombstone policy per Required Review Brief in this file.
Agent comments:
Active agent: Qoder CLI
Agent pass status: finished
Agent pass started at: 2026-06-17T18:10:00+02:00
Agent pass ended at: 2026-06-17T18:14:15+02:00
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-17
Workflow gaps reviewed: 2026-06-17
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs:
Compaction status: not_needed
Lifecycle status: active
Deprecation confidence: none
Deprecation reason:
Canonical owner:
Human decision required: yes

## Why this project exists

`scripts/archive` holds historical spell-data tooling from the canonical retrieval lane.
The live lane was marked complete, so these scripts are evidence-retention and reuse context rather than active pipeline inputs.

## Purpose and scope

This project exists to preserve:

- what was archived (`scripts/archive`)
- why it was retired
- what retained artifacts are still needed as evidence
- where to pick up future reuse, cleanup, or retention decisions

Scope is documentation and continuity support only.

## File map

| File | Role |
|---|---|
| `scripts/archive/spell-canonical-retrieval/captureSpellCanonicalData.ts` | Archived retrieval runner for raw D&D Beyond capture (HTTP + browser fallback) |
| `scripts/archive/spell-canonical-retrieval/generateSpellCanonicalRetrievalTracker.ts` | Archived tracker generator for one retrieval lane |
| `docs/tasks/spells/archive/spell-canonical-retrieval/SPELL_CANONICAL_RETRIEVAL_TRACKER.md` | Archived lane tracker output retained by history |

## Current state

- `scripts/archive` remains intentionally retained as historical tooling (2 TS files in `spell-canonical-retrieval/`).
- `scripts/tooling/script-registry.json` has no live `scripts/archive` registry entry.
- `.agent/roadmap-local/spell-validation/dndbeyond-auth.json` was absent again on 2026-06-17 (re-verified this iteration).
- The archive tombstone policy is now surfaced as a Required Review Brief below; forward iteration is gated on that human decision.

## Active task

T2 is review-required:
- temp-auth cleanup check: confirmed absent 2026-06-17, no action needed
- archive tombstone policy: surfaced as Required Review Brief (SARCH-001), awaiting human decision
- no further forward implementation is safe until the tombstone policy decision is recorded

## What must stay stable

- Do not remove archive scripts without a replacement decision path.
- Keep the one-time retrieval lane history in place for audit and rerun evidence.
- Keep auth/session files out of durable archive storage.
- Treat temporary auth inputs as runtime-only unless a future decision explicitly says otherwise.

## Required Review Brief

### Archive Tombstone Policy (SARCH-001)

Title: Archive tombstone registry policy
Question: Should retired `scripts/archive` scripts get an explicit tombstone entry in `scripts/tooling/script-registry.json`, or remain implicitly omitted?
Issue: Archived scripts in `scripts/archive/spell-canonical-retrieval/` are intentionally retained but invisible to the script registry. Later agents and developers cannot distinguish "intentionally retired" from "never existed" without reading project docs.
Current behavior: `scripts/tooling/script-registry.json` has no entry for `scripts/archive`. The archive folder contains 2 TypeScript files from the canonical spell-retrieval lane.
Why blocked: SARCH-001 is `blocked_human_decision`. Forward agents cannot choose this policy unilaterally without risking scope expansion or collapsing intentional omission into a default.
Option A (tombstone): Add a `scripts-archive` featureBranch entry to `script-registry.json` with bucket `devworkflow`, a `retired: true` marker or tombstone note, and a short retirement reason. This makes intentional retirement visible in the registry UI and future tooling.
Option B (explicit omission policy): Document in this project's docs that archive scripts are excluded from the registry by policy, with no tombstone entry needed. The docs themselves become the discoverability surface.
Option C (defer): No registry change; revisit only when archive reuse is actually needed.
Evidence: `scripts/tooling/script-registry.json` (no archive entry); `scripts/archive/spell-canonical-retrieval/` (2 TS files); SARCH-001 in `GAPS.md`.
Decision owner: Human/operator
Proof after decision: A policy note is added to `DECISIONS.md`, and (if Option A) a tombstone registry entry is committed.

## Resume path

1. Read this file.
2. Read `docs/projects/scripts-archive/TRACKER.md`.
3. Read `docs/projects/scripts-archive/GAPS.md`.
4. If the Required Review Brief above has a recorded decision, implement it and close SARCH-001.
5. If no decision is recorded yet, the project is review-required; do not start forward implementation.
6. Re-check the temp-auth cleanup evidence only if the artifact has been recreated.
