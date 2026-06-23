# Spells Parent Runbook

Status: active
Last updated: 2026-06-22

Use this file for repeatable parent routing checks, safe child-lane onboarding, and recovery steps for the Spells scoped dashboard.

## Prerequisites

- Project directory: `docs/projects/spells`
- Shared workflow: `docs/agent-workflows/living-project-task-protocol/PARENT_PROJECT_WITH_SUBPROJECTS.md`
- Dashboard schema: `docs/projects/PROJECT_CARD_SCHEMA.md`

## Standard Checks

1. Read the parent routing doc set before changing scope or choosing a child lane:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
   - `DECISIONS.md`
   - `AUDIT_OR_PROOF.md`
   - `RUNBOOK.md`
2. Keep `NORTH_STAR.md` YAML frontmatter aligned with `docs/projects/PROJECT_CARD_SCHEMA.md`.
3. Keep durable parent routing decisions in `DECISIONS.md` and concise parent proof/import summaries in `AUDIT_OR_PROOF.md`.
4. Register reusable workflow ambiguity in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, not as a project-specific blocker.

## Failure Handling

| Symptom | Likely cause | Recovery |
|---|---|---|---|
| Project audit reports missing required docs | Declared doc absent from project folder | Add the missing doc or update `required_docs` only if the canonical schema changes. |
| Dashboard shows stale schema status | Frontmatter or declared dates are out of sync | Refresh `NORTH_STAR.md` frontmatter and rerun the project audit. |
| Agent finds process ambiguity | Workflow gap, not project gap | Add or +1 an entry in `WORKFLOW_GAPS.md` with testimony. |

## Child Lane Onboarding

1. Start in `SUBPROJECTS.md` and identify the owning lane.
2. Open that child packet before editing code, data, validators, UI, or detailed audit material.
3. Keep child-local pass status, proof, and local gap rows in the child packet.
4. Return to the parent only when routing, ownership, dashboard state, or parent-visible gap import changes.

## Parent Maintenance Check

| Check | Expected result |
|---|---|
| Parent mode | `NORTH_STAR.md` declares `project_mode: parent_with_subprojects`. |
| Registry | `SUBPROJECTS.md` lists owned lanes and linked support without making support projects look owned. |
| Gap intake | `GAPS.md` distinguishes parent-visible imported gaps from child-local TODOs. |
| Cold start | `COLD_START_AGENT_PROMPT.md` routes agents to child packets before execution. |
