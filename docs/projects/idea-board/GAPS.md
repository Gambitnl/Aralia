---
schema_version: 1
gap_schema: project_gap_registry
project: Idea Board
slug: idea-board
status: active
status_note: "Foundation, thirteen real records, and the supplied source intakes are verified. The three adjacent governance and tooling gaps are resolved on 2026-09-20: IB-G1 by the opt-in --reach receipt, IB-G2 by RUNBOOK section 8 and its mechanical field checks, IB-G3 by proof that the five dispatched refs name no real supplied source."
registry_mode: canonical
last_updated: 2026-09-23
gap_count: 4
open_gap_count: 1
resolved_gap_count: 3
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: current
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/idea-board/NORTH_STAR.md
tracker: docs/projects/idea-board/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses: [open, active, pending, blocked, not_started, in_progress, waiting, needs_validation, untriaged, routed, review-required, resolved, closed, done, complete, out_of_scope]
allowed_classifications: [in_scope_now, support_needed_now, adjacent_follow_up, out_of_scope, blocked_human_decision, blocked_external_state, uncertainty, architecture, workflow, integration, data-model, test_coverage, ownership]
allowed_severities: [none, low, medium, high, critical]
supported_optional_row_fields: [owner_confidence, source_project, imported_from, global_gap_id, linked_gap_id, routed_to, decision_required, decision_reference, review_required, visual_proof_required, proof_freshness, proof_date, uncertainty, notes]
supported_optional_sections: [Current Readout, Current State, Purpose, Summary, Iteration Notes, Classification Notes, Global Routing, Global Gap Imports, Resolved Gap Log, Required Review Brief, Decision Visualizations, Open / Uncertain Notes, Appendix]
---
# Idea Board Gap Registry

Status: active
Last updated: 2026-09-23

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IB-G1 | resolved | low | adjacent_follow_up | research tooling owner | confirmed | Idea Board | none | none | none | current | Idea Board | IB-T1 | URL validation proves syntax and uniqueness but not remote reachability. | `scripts/idea-board/validate.mjs`; `scripts/idea-board/validate.test.mjs`; `docs/projects/idea-board/RUNBOOK.md` section 7 | Link rot could make a source shelf look healthier than it is. | Done 2026-09-20. `validate.mjs` has an opt-in `--reach` mode with `--reach-timeout=<ms>` (default 5000 ms). It sends one HEAD request for each source URL, archive URL, and excluded URL, and it reports available, redirected, unreachable, or not checked. Only status 404 and 410 count as unreachable. An offline host, a blocked host, and a rate-limited host report as not checked. The receipt is printed, never returned as a validation error, and it does not change the exit code. `validateIdeaBoard` is unchanged and stays free of the network. | Proof 2026-09-20. Five mocked fixtures (available, redirected, 404, offline throw, 429) give the expected states, and a real run over 46 recorded addresses gave 40 available, 3 redirected, 0 unreachable, 3 not checked, with exit code 0. The three redirects are real: `github.com/ahujasid/blender-mcp` now answers as `github.com/ahujasid/mcp-for-blender`. | Do not add a network dependency to the deterministic validator. The check stays opt-in, and no record conclusion changed.; Resolved 2026-09-20 by w0-ib-gaps: opt-in --reach receipt in scripts/idea-board/validate.mjs (HEAD, 5000 ms default, --reach-timeout override); only 404/410 count as unreachable; offline, blocked and rate-limited hosts report not_checked; advisory only, exit code unchanged. Five mocked-state tests plus a real 46-address run: 40 available, 3 redirected, 0 unreachable, 3 not checked, exit 0. (w0-ib-gaps, 2026-09-20) |
| IB-G2 | resolved | medium | blocked_human_decision | research and licensing owners | confirmed | Idea Board | none | decided | none | current | Idea Board | IB-T1 | Archive fields exist but archive capture, storage, licence review, and retention are not governed. | `docs/projects/idea-board/RUNBOOK.md` section 8; `scripts/idea-board/validate.mjs`; `public/idea-board/records.json` | Automatic retention can copy material the project may not be entitled to redistribute and can bloat the repository. | Done 2026-09-20. RUNBOOK section 8 governs archive links: 8.1 capture trigger, 8.2 permitted archive services, 8.3 storage location, 8.4 license review step and its owner, 8.5 retention rule. The policy keeps the earlier boundary: the board links a snapshot that a third party made and never makes or commits one. The validator enforces only the mechanical parts. When `archiveUrl` has text, it must be an HTTP(S) address on a host in `APPROVED_ARCHIVE_HOSTS`, and `archivedAt` must hold an honest date. An `archivedAt` without an `archiveUrl` is rejected. | Proof 2026-09-20. Four tests cover an unapproved host, a missing `archivedAt`, an approved and dated link, and a date without a link. No source in `records.json` holds an `archiveUrl` today, so the new rule changed no record. The only remaining human step is the case-by-case license judgement in 8.4, which stays with the owners by design. | The dashboard can link an archive now; it must not create one.; Resolved 2026-09-20 by w0-ib-gaps: RUNBOOK section 8 governs archive links (8.1 capture trigger, 8.2 permitted services, 8.3 storage location, 8.4 license review step and owner, 8.5 retention rule). The board links a third-party snapshot and never makes or commits one. validate.mjs enforces only the mechanical parts: archiveUrl must be HTTP(S) on an APPROVED_ARCHIVE_HOSTS host, archivedAt must be an honest date, and archivedAt without archiveUrl is rejected. Four new tests. No existing source holds an archiveUrl, so no record changed. (w0-ib-gaps, 2026-09-20) |
| IB-G3 | resolved | low | out_of_scope | orchestration/wave-dispatch owner | confirmed | Idea Board | none | none | none | current | Idea Board | agora-5103 | A dispatched board task (`agora-5103`, refs `["idea:gatefall-procedural-scene-stack"]`) refers to an Idea Board record that does not exist; `public/idea-board/records.json` holds only IB-0001..IB-0006 and none covers Gatefall or a procedural scene stack. Four sibling tasks in the same wave (`agora-63e3`, `agora-a34b`, `agora-fdbb`, `agora-d32a`) share the same pattern, all also naming a "canid-v2" candidate absent from `src/`. | `public/idea-board/records.json`; `.agent/scratch/wf-sweep/prompts/agora-5103.txt`; `docs/projects/idea-board/GATEFALL_MATERIAL_COMPARISON.md`; the `task show` result of all five task IDs | A worker cannot "follow the record's acceptance shape" for a record that was never written; later agents hitting the same five task IDs will repeat this search unless the gap is visible here. | Closed 2026-09-20 with no new record. All five tasks are `done`. Each worker reported the same premise failure independently and substituted a real deterministic quadruped, so the wave produced real evidence under a false ref. No Gatefall source was ever supplied, and the board has no Gatefall source URL, so a record would have to invent its evidence. The refs cannot resolve by design: the record schema has no `slug` field, and `IB-####` is the only record identity. The one ref with a real topic, `idea:cozyclay-pose-review-workspace`, already has record IB-0006 under a different name. | Proof 2026-09-20. `node tools/agora/client.mjs task show` on all five IDs returns state `done`, and the result text of each names the missing record and the missing `canid-v2`. `records.json` now holds IB-0001..IB-0009, and a search for gatefall, cascadeur, surface-directed, skintokens, and cozyclay finds only the CozyClay sources of IB-0006. | This is not IB-G1/IB-G2 territory (both are about the board's own archive/link tooling); flagged here only because the ref syntax (`idea:<slug>`) looks like it should resolve into this project. The durable defect belongs to the dispatch process, not to the board: a dispatcher must not write a ref in a namespace that no data file can answer. See the Resolved Gap Log for the routed follow-up.; Resolved 2026-09-20 by w0-ib-gaps with no new record. task show on agora-5103, agora-63e3, agora-a34b, agora-fdbb and agora-d32a returns done for all five; each result independently reports the missing record and the missing canid-v2 and names the real quadruped it substituted. No Gatefall source was ever supplied, so a record would have to invent its evidence. The refs cannot resolve by design: the record schema has no slug field and IB-#### is the only identity. The one real topic, idea:cozyclay-pose-review-workspace, is already record IB-0006. The durable defect is in the dispatch process and is routed out of this registry. (w0-ib-gaps, 2026-09-20) |
| IB-G4 | open | medium | adjacent_follow_up | Idea Board research owner | confirmed | Idea Board | none | no decision required | none | current | Idea Board | Constellation grouping | Separate-project relevance lacks project-specific assessments. | organization.mjs marks every D&D Character Generator connection suggested; records.json still compares sources chiefly to Aralia. | Similar subject matter is not proof that a technique fits a separate project's rig, export, or runtime needs. | Inspect a selected separate project's current scope and append evidence-backed mappings when requested. | A connection names current project evidence and a bounded reason before becoming recorded relevance. | The UI exposes suggestions honestly; this does not block navigation. |

## Resolved Gap Log

All three rows above moved to `resolved` on 2026-09-20 in one pass. The rows
stay in the Gap Log with their original evidence, because a resolved gap is
history and not waste.

| Gap ID | Resolved on | What closed it | What stays open elsewhere |
|---|---|---|---|
| IB-G1 | 2026-09-20 | Opt-in `--reach` receipt in `scripts/idea-board/validate.mjs`, five mocked-state tests, and RUNBOOK section 7. | Nothing. The default run stays deterministic and offline. |
| IB-G2 | 2026-09-20 | RUNBOOK section 8 (trigger, permitted services, storage location, license review, retention) and the mechanical `archiveUrl` and `archivedAt` checks. | The case-by-case license judgement in section 8.4 stays a human step by design. |
| IB-G3 | 2026-09-20 | Proof that all five dispatched tasks are done and that no Gatefall source was supplied. No record was added. | The dispatch process still writes `idea:<slug>` refs that no data file can answer. That defect belongs to the dispatcher, not to the board. Route it to `docs/projects/GLOBAL_GAPS.md` under the wave-dispatch owner; this registry must not grow a row for another project's data model. |

## Global Gap Imports

No matching row was imported from `docs/projects/GLOBAL_GAPS.md` during the
2026-08-31 bounded scan.

## Classification Notes

IB-G1 was intentionally adjacent: deterministic local validation is complete
without a network call. It stays complete, because the 2026-09-20 receipt is
opt-in and advisory. IB-G2 was a human decision because technical automation
cannot decide redistribution and retention policy safely. The owners recorded
that policy in RUNBOOK section 8 on 2026-09-20, and only its mechanical parts
moved into the validator. IB-G3 stayed out of scope: the board's data model was
never at fault, and the fix belongs to the process that dispatches the tasks.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The current source intake cannot honestly complete without the work. |
| `support_needed_now` | It is not the research record itself, but intake cannot proceed without it. |
| `adjacent_follow_up` | It is useful and related but does not block the current dated assessment. |
| `out_of_scope` | It belongs outside this project. |
| `blocked_human_decision` | An owner must decide policy, authority, or acceptable risk. |
| `blocked_external_state` | Progress depends on a source, service, environment, or another owner changing. |

## Update Rules

- Keep each gap tied to evidence, an owner, a next action, and a next proof.
- Do not turn deterministic validation into a network dependency. The `--reach` receipt must stay opt-in, and it must never change an exit code or a conclusion.
- Do not archive or copy third-party material. Record only a link to a snapshot that a third party made, and obey RUNBOOK section 8.
- Route cross-project or orphaned findings to `docs/projects/GLOBAL_GAPS.md` instead of widening this registry.
- Preserve resolved and routed history; do not delete an earlier gap because its current status changed.
- Record new edge-case probes in the audit or handoff when a source intake finds no durable new gap.
