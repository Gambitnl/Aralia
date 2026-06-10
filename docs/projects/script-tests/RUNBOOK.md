# Script Tests Runbook

Status: active
Last updated: 2026-06-10

Use this file for repeatable project checks, safe handoff operations, and recovery steps.

## Prerequisites

- Project directory: `docs/projects/script-tests`
- Shared workflow: `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
- Dashboard schema: `docs/projects/PROJECT_CARD_SCHEMA.md`

## Standard Checks

1. Read the full living-project doc set before changing scope:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
   - `DECISIONS.md`
   - `AUDIT_OR_PROOF.md`
   - `RUNBOOK.md`
2. Keep `NORTH_STAR.md` YAML frontmatter aligned with `docs/projects/PROJECT_CARD_SCHEMA.md`.
3. Keep durable decisions in `DECISIONS.md` and proof summaries in `AUDIT_OR_PROOF.md`.
4. Register reusable workflow ambiguity in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, not as a project-specific blocker.

## Failure Handling

| Symptom | Likely cause | Recovery |
|---|---|---|---|
| Project audit reports missing required docs | Declared doc absent from project folder | Add the missing doc or update `required_docs` only if the canonical schema changes. |
| Dashboard shows stale schema status | Frontmatter or declared dates are out of sync | Refresh `NORTH_STAR.md` frontmatter and rerun the project audit. |
| Agent finds process ambiguity | Workflow gap, not project gap | Add or +1 an entry in `WORKFLOW_GAPS.md` with testimony. |
