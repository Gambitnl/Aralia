---
schema_version: 1
gap_schema: project_gap_registry
project: Idea Board
slug: idea-board
status: active
status_note: "Fourteen records after IB-0014 (Hi3D v1.0 mesh refinement, 2026-10-27, assessed from its GitHub repository because the cloud session cannot open x.com). Three gaps opened the same day: IB-G5 holds six supplied X posts the cloud session could not read, IB-G6 records ten corrupted record lexicons, IB-G7 records that the project's runbook and north star are gitignored. IB-G1 to IB-G3 stay resolved from 2026-09-20."
registry_mode: canonical
last_updated: 2026-10-27
gap_count: 7
open_gap_count: 4
resolved_gap_count: 3
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 1
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
Last updated: 2026-10-27

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IB-G1 | resolved | low | adjacent_follow_up | research tooling owner | confirmed | Idea Board | none | none | none | current | Idea Board | IB-T1 | URL validation proves syntax and uniqueness but not remote reachability. | `scripts/idea-board/validate.mjs`; `scripts/idea-board/validate.test.mjs`; `docs/projects/idea-board/RUNBOOK.md` section 7 | Link rot could make a source shelf look healthier than it is. | Done 2026-09-20. `validate.mjs` has an opt-in `--reach` mode with `--reach-timeout=<ms>` (default 5000 ms). It sends one HEAD request for each source URL, archive URL, and excluded URL, and it reports available, redirected, unreachable, or not checked. Only status 404 and 410 count as unreachable. An offline host, a blocked host, and a rate-limited host report as not checked. The receipt is printed, never returned as a validation error, and it does not change the exit code. `validateIdeaBoard` is unchanged and stays free of the network. | Proof 2026-09-20. Five mocked fixtures (available, redirected, 404, offline throw, 429) give the expected states, and a real run over 46 recorded addresses gave 40 available, 3 redirected, 0 unreachable, 3 not checked, with exit code 0. The three redirects are real: `github.com/ahujasid/blender-mcp` now answers as `github.com/ahujasid/mcp-for-blender`. | Do not add a network dependency to the deterministic validator. The check stays opt-in, and no record conclusion changed.; Resolved 2026-09-20 by w0-ib-gaps: opt-in --reach receipt in scripts/idea-board/validate.mjs (HEAD, 5000 ms default, --reach-timeout override); only 404/410 count as unreachable; offline, blocked and rate-limited hosts report not_checked; advisory only, exit code unchanged. Five mocked-state tests plus a real 46-address run: 40 available, 3 redirected, 0 unreachable, 3 not checked, exit 0. (w0-ib-gaps, 2026-09-20) |
| IB-G2 | resolved | medium | blocked_human_decision | research and licensing owners | confirmed | Idea Board | none | decided | none | current | Idea Board | IB-T1 | Archive fields exist but archive capture, storage, licence review, and retention are not governed. | `docs/projects/idea-board/RUNBOOK.md` section 8; `scripts/idea-board/validate.mjs`; `public/idea-board/records.json` | Automatic retention can copy material the project may not be entitled to redistribute and can bloat the repository. | Done 2026-09-20. RUNBOOK section 8 governs archive links: 8.1 capture trigger, 8.2 permitted archive services, 8.3 storage location, 8.4 license review step and its owner, 8.5 retention rule. The policy keeps the earlier boundary: the board links a snapshot that a third party made and never makes or commits one. The validator enforces only the mechanical parts. When `archiveUrl` has text, it must be an HTTP(S) address on a host in `APPROVED_ARCHIVE_HOSTS`, and `archivedAt` must hold an honest date. An `archivedAt` without an `archiveUrl` is rejected. | Proof 2026-09-20. Four tests cover an unapproved host, a missing `archivedAt`, an approved and dated link, and a date without a link. No source in `records.json` holds an `archiveUrl` today, so the new rule changed no record. The only remaining human step is the case-by-case license judgement in 8.4, which stays with the owners by design. | The dashboard can link an archive now; it must not create one.; Resolved 2026-09-20 by w0-ib-gaps: RUNBOOK section 8 governs archive links (8.1 capture trigger, 8.2 permitted services, 8.3 storage location, 8.4 license review step and owner, 8.5 retention rule). The board links a third-party snapshot and never makes or commits one. validate.mjs enforces only the mechanical parts: archiveUrl must be HTTP(S) on an APPROVED_ARCHIVE_HOSTS host, archivedAt must be an honest date, and archivedAt without archiveUrl is rejected. Four new tests. No existing source holds an archiveUrl, so no record changed. (w0-ib-gaps, 2026-09-20) |
| IB-G3 | resolved | low | out_of_scope | orchestration/wave-dispatch owner | confirmed | Idea Board | none | none | none | current | Idea Board | agora-5103 | A dispatched board task (`agora-5103`, refs `["idea:gatefall-procedural-scene-stack"]`) refers to an Idea Board record that does not exist; `public/idea-board/records.json` holds only IB-0001..IB-0006 and none covers Gatefall or a procedural scene stack. Four sibling tasks in the same wave (`agora-63e3`, `agora-a34b`, `agora-fdbb`, `agora-d32a`) share the same pattern, all also naming a "canid-v2" candidate absent from `src/`. | `public/idea-board/records.json`; `.agent/scratch/wf-sweep/prompts/agora-5103.txt`; `docs/projects/idea-board/GATEFALL_MATERIAL_COMPARISON.md`; the `task show` result of all five task IDs | A worker cannot "follow the record's acceptance shape" for a record that was never written; later agents hitting the same five task IDs will repeat this search unless the gap is visible here. | Closed 2026-09-20 with no new record. All five tasks are `done`. Each worker reported the same premise failure independently and substituted a real deterministic quadruped, so the wave produced real evidence under a false ref. No Gatefall source was ever supplied, and the board has no Gatefall source URL, so a record would have to invent its evidence. The refs cannot resolve by design: the record schema has no `slug` field, and `IB-####` is the only record identity. The one ref with a real topic, `idea:cozyclay-pose-review-workspace`, already has record IB-0006 under a different name. | Proof 2026-09-20. `node tools/agora/client.mjs task show` on all five IDs returns state `done`, and the result text of each names the missing record and the missing `canid-v2`. `records.json` now holds IB-0001..IB-0009, and a search for gatefall, cascadeur, surface-directed, skintokens, and cozyclay finds only the CozyClay sources of IB-0006. | This is not IB-G1/IB-G2 territory (both are about the board's own archive/link tooling); flagged here only because the ref syntax (`idea:<slug>`) looks like it should resolve into this project. The durable defect belongs to the dispatch process, not to the board: a dispatcher must not write a ref in a namespace that no data file can answer. See the Resolved Gap Log for the routed follow-up.; Resolved 2026-09-20 by w0-ib-gaps with no new record. task show on agora-5103, agora-63e3, agora-a34b, agora-fdbb and agora-d32a returns done for all five; each result independently reports the missing record and the missing canid-v2 and names the real quadruped it substituted. No Gatefall source was ever supplied, so a record would have to invent its evidence. The refs cannot resolve by design: the record schema has no slug field and IB-#### is the only identity. The one real topic, idea:cozyclay-pose-review-workspace, is already record IB-0006. The durable defect is in the dispatch process and is routed out of this registry. (w0-ib-gaps, 2026-09-20) |
| IB-G4 | open | medium | adjacent_follow_up | Idea Board research owner | confirmed | Idea Board | none | no decision required | none | current | Idea Board | Constellation grouping | Separate-project relevance lacks project-specific assessments. | organization.mjs marks every D&D Character Generator connection suggested; records.json still compares sources chiefly to Aralia. | Similar subject matter is not proof that a technique fits a separate project's rig, export, or runtime needs. | Inspect a selected separate project's current scope and append evidence-backed mappings when requested. | A connection names current project evidence and a bounded reason before becoming recorded relevance. | The UI exposes suggestions honestly; this does not block navigation. |
| IB-G5 | open | medium | blocked_external_state | Idea Board research owner | confirmed | Idea Board | none | no decision required | none | current | Idea Board | 2026-10-27 cloud intake (session ccr-2da4fbce-xouf23) | Six supplied X posts could not be inspected from the cloud session: the environment's network policy answers 403 at the proxy CONNECT for x.com and for the fxtwitter, publish.twitter.com and cdn.syndication.twimg.com mirrors, and web search holds no indexed text for these ids. Unread: x.com/rehan_shei/status/2115003471015588021, x.com/redcamel15/status/2114606572165046472, x.com/tvytlx/status/2113991149044019598, x.com/liambraus/status/2113234988573524034, x.com/customuse/status/2113322603717050811, x.com/patloeber/status/2113564629591032109. | Supplied by the project owner in chat on 2026-10-27; the proxy status receipt showed connect_rejected 403 for x.com; seven web searches returned profile pages but no post text for these ids. | The board's intake norm is that every supplied source is inspected and either assessed or excluded with a reason, so an unread link that lives only in chat history is lost evidence. | Open each post in the signed-in browser on the Windows host (the route SRC-0037 used for IB-0008), then write a record or move the address to excludedSources with a reason. | Each of the six addresses appears as a SRC id in records.json or as an EXC row, and this row moves to resolved. | The seventh supplied link, the Hi3D article, resolved through its GitHub repository and became IB-0014; SRC-0071 records the unread article honestly. A search hit from the same account on the same day as the rehan_shei link describes blocking out a village in Blender with Claude and texturing it with image models over 128 views; that is a neighbouring post, not the supplied one, and must not be written into a record as the supplied post's content. |
| IB-G6 | open | medium | data-model | Idea Board research owner | confirmed | Idea Board | none | no decision required | none | current | Idea Board | 2026-10-27 cloud intake (IB-0014 authoring) | The lexicon arrays of IB-0001 through IB-0010 hold one-character term and meaning pairs (IB-0001's first entry is term "T", meaning "h"), which look like a string destructured into its first two characters; IB-0011 through IB-0013 hold real glossary entries. app.mjs renders every record's lexicon on the Lexicon page, so ten records show meaningless single letters. | public/idea-board/records.json lexicon arrays counted 2026-10-27 at commit b35ea0ff: 10 of 13 pre-existing records affected; public/idea-board/app.mjs lines 350 to 352 render them. | The glossary is part of the reader-facing interpretability layer, and the original text is not recoverable from the file. | Find the writer that produced the pairs, fix it, and re-author the ten glossaries from each record's own facts; do not invent entries. | validate.mjs rejects a lexicon entry whose term or meaning is shorter than two characters, and all fourteen records pass. | The validator does not check lexicon contents today, which is why this passed every run. IB-0014 was written with full entries. |
| IB-G7 | open | low | workflow | Idea Board owner with the repo hygiene owner | confirmed | Idea Board | none | decision required | none | current | Idea Board | 2026-10-27 cloud intake (cold start in a fresh clone) | The .gitignore rule docs/projects/*/* keeps this project's NORTH_STAR.md, RUNBOOK.md and TRACKER.md out of Git while this registry's frontmatter, PROJECT_TRACKER.md and the validate.mjs error text (RUNBOOK section 8 for archive hosts) all cite them, so a clone or cloud session follows dangling pointers. | git check-ignore -v on the three paths on 2026-10-27 matched .gitignore line 282; git log shows the files were never tracked; the Spells project negates the rule for its own NORTH_STAR.md and TRACKER.md (WF-G202). | A cold-start agent either guesses the archive policy or re-derives it, and the project card in PROJECT_TRACKER.md links a file no clone can open. | The owner decides whether to negate the ignore for idea-board's NORTH_STAR.md and RUNBOOK.md as WF-G202 did for Spells, then commits them from the Windows checkout; otherwise rewrite the citations to a tracked home. | The three paths resolve in a fresh clone, or no tracked file cites them. | The ignore is deliberate (its comment explains the GAPS.md exception), so this is a scoping choice, not a bug. |

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

The three rows of 2026-10-27 came from the first intake run in a cloud clone
rather than the Windows checkout. IB-G5 is `blocked_external_state` because the
only missing input is a network route or a person with a browser; the links are
preserved here so they survive chat history. IB-G6 is a `data-model` defect in
the stored records themselves. IB-G7 is a `workflow` scoping choice that needs
the owner's call, not a repair an agent should make alone.

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
