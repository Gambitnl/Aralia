---
schema_version: 1
project: Spells
slug: spells
status: active
last_updated: 2026-09-23
active_agent: ""
agent_pass_status: not_started
agent_pass_started_at: ""
agent_pass_ended_at: ""
---
# Spells Parent Routing Tracker

Status: active
Last updated: 2026-09-23

This tracker covers parent routing and document health, not an executable
spell-work iteration. `GAPS.md` is the canonical parent gap registry; its
2026-08-12 frontmatter records 53 resolved and 0 open parent rows. Child or
runtime readiness cannot be inferred from that count.

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| SP-R1 | not_started | Reconcile the parent child-lane inventory and restore a current routing registry. | Spells project owner (unconfirmed) | 2026-09-23 | The 2026-06 North Star and Tracker at `2033cc4ce^` describe eight lanes, but their `SUBPROJECTS.md` target is absent both now and at that revision. Only a spell-completeness snapshot remains under `subprojects/`. | Establish which former lanes still have live packets and owners; then publish `SUBPROJECTS.md` with dated evidence, or revise the parent model by an explicit project decision. | Every active lane has an existing packet, an owner, and a verifiable next proof; the parent dashboard no longer relies on a historical count. |
| SP-R2 | not_started | Complete the missing canonical living-project documents without inventing project decisions or proof. | Spells project owner (unconfirmed) | 2026-09-23 | `COLD_START_AGENT_PROMPT.md`, `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` are absent; `scripts/audit-living-project-docs.cjs` requires them. | Reconstruct each from current source-backed records and mark any unresolved ownership or acceptance explicitly. | The Spells row in `npm run projects:audit` reports no missing required docs or tracker-contract sections. |

The former T4-T7 rows in the deleted 2026-06 Tracker are historical, not
carried forward as active tasks. In particular, its deferred reaction/timing
priority must be rechecked before anyone dispatches work from it.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

This table adds no parent gaps. Consult `GAPS.md` for the 53 historical
parent rows and their recorded status. The missing document and routing work
above is not a new claim that the spell runtime has an open product gap.

## Update Rules

- Keep parent tasks about routing, ownership, imported gaps, and dashboard
  document health. Put executable spell work and focused proof with its real
  child packet or task.
- Treat 2026-06 deleted docs as provenance, not current pass telemetry.
- Recheck `GAPS.md` counts and path targets when parent routing changes.
- Do not mark documentation, CI, or runtime work complete from a local link
  check alone. WF-G201 needs a passing pull-request CI log.
