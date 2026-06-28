# Spells Parent Runbook

Status: active
Last updated: 2026-06-27

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
3. When the local project tracker is available, open the rendered Spells parent dashboard before launching child work and confirm:
   - one `Recommended next lane` callout is visible
   - the callout shows registry proof freshness from `SUBPROJECTS.md`
   - `Show lane details` opens the highlighted child lane
   - the lane exposes setup-packet link, lane details, handoff preview, and copy handoff controls
4. Keep durable parent routing decisions in `DECISIONS.md` and concise parent proof/import summaries in `AUDIT_OR_PROOF.md`.
5. Register reusable workflow ambiguity in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, not as a project-specific blocker.

## Failure Handling

| Symptom | Likely cause | Recovery |
|---|---|---|---|
| Project audit reports missing required docs | Declared doc absent from project folder | Add the missing doc or update `required_docs` only if the canonical schema changes. |
| Dashboard shows stale schema status | Frontmatter or declared dates are out of sync | Refresh `NORTH_STAR.md` frontmatter and rerun the project audit. |
| Recommended lane is missing from rendered dashboard | `SUBPROJECTS.md` frontmatter lacks `highest_priority`, the registry table no longer matches the priority, or the dev server needs refresh | Check `highest_priority`, `proof_freshness`, and the lane table in `SUBPROJECTS.md`; refresh the project tracker; fall back to file-based routing until the rendered dashboard is repaired. |
| Handoff preview does not match copied handoff | Shared parent renderer drift | Repair `misc/project_ui.js` so the preview and `Copy handoff` use the same generated handoff text before launching a new child-lane agent. |
| Agent finds process ambiguity | Workflow gap, not project gap | Add or +1 an entry in `WORKFLOW_GAPS.md` with testimony. |

## Child Lane Onboarding

1. Prefer the rendered parent dashboard when available: use `Recommended next lane`, `Show lane details`, `Preview handoff packet`, and `Copy handoff`.
2. If the dashboard is unavailable, start in `SUBPROJECTS.md`, read `highest_priority`, then identify the owning lane from the table.
3. Open that child packet before editing code, data, validators, UI, or detailed audit material.
4. Keep child-local pass status, proof, and local gap rows in the child packet.
5. Return to the parent only when routing, ownership, dashboard state, or parent-visible gap import changes.

## Current Deferred Reaction/Timing Closeout Route

Use this route while the parent `reaction_or_opportunity_restriction` rows remain `implementation_unverified`:

1. For Shining Smite, Blinding Smite, Lightning Arrow, and Counterspell, open `subprojects/structured-spell-execution/TRACKER.md`.
2. For Find Familiar touch delivery and Summon Beast Flyby, open `subprojects/summons-controlled-entities/TRACKER.md`.
3. Run or repair the focused proof named in the child closeout matrix; do not close parent rows from metadata presence alone.
4. Record detailed proof in the child `AUDIT_OR_PROOF.md`, then import only concise parent-visible routing or proof status to the parent docs.
5. Keep the parent scoped-dashboard role intact: the parent chooses and summarizes lanes, while child packets own executable proof and row closure evidence.

## Parent Maintenance Check

| Check | Expected result |
|---|---|
| Parent mode | `NORTH_STAR.md` declares `project_mode: parent_with_subprojects`. |
| Registry | `SUBPROJECTS.md` lists owned lanes and linked support without making support projects look owned; `highest_priority` and `proof_freshness` are present when the dashboard should recommend a lane. |
| Gap intake | `GAPS.md` distinguishes parent-visible imported gaps from child-local TODOs. |
| Cold start | `COLD_START_AGENT_PROMPT.md` routes agents through the rendered dashboard handoff when available and child packets before execution. |
| Rendered dashboard | Project tracker overlay and UI template show the same parent-scoped controls: recommended lane, registry proof freshness, lane details, setup-packet link, handoff preview, and copy handoff. |
