---
schema_version: 1
project: Scripts: Audits
slug: scripts-audits
category: Tools, Automation, and Infrastructure
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/scripts-audits; docs/projects/DECISION_BLITZ_2026-06-10.md (D20)
gap_signal: "S4 policy decided 2026-06-10 (audits stay optional/manual, no CI gates this cycle); S1/S2/S3 remain open; CMA-G19 unblocked under the manual policy"
protocol: living project doc set
next_step: "Decision recorded 2026-06-10; implementation lane open: forward automation work proceeds under the optional/manual policy (no CI gates this cycle); CMA-G19 routing may be accepted under that policy. Revisit gating when the audit suite stabilizes."
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
  - scoped_checks
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Scripts: Audits North Star

Status: active — S4 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

## Why This Project Exists

`scripts/audits` is where race image checks, race-sync validation, trait audit
scripts, and portrait QA tooling converge. This project keeps that surface stable,
documented, and recoverable for future maintainers.

## Purpose And Scope

- Keep a working cold-start reference for `scripts/audits`.
- Preserve intent, boundaries, and file map for audit workflows tied to races.
- Track integration points with portrait regeneration and glossary/race sync flow.

## Dashboard Card Schema

Project: Scripts: Audits
Slug: scripts-audits
Category: Tools, Automation, and Infrastructure
Status: active — S4 decision recorded 2026-06-10; implementation lane open
Confidence: medium
Evidence: docs/projects/scripts-audits; docs/projects/DECISION_BLITZ_2026-06-10.md (D20)
Gap signal: S4 policy decided 2026-06-10 (audits optional/manual, no CI gates this cycle); S1/S2/S3 remain open; CMA-G19 unblocked under the manual policy
Protocol: living project doc set
Next step: Proceed under the optional/manual audit policy; no CI gates this cycle. CMA-G19 routing may be accepted under the manual policy. Revisit gating when the audit suite stabilizes.
Required verification: docs_consistency, scoped_checks
Completed verification: docs_consistency
Last proof: 2026-06-08 review-gate classification
Workflow gaps reviewed: 2026-06-08

Dashboard lifecycle: active (policy review cleared 2026-06-10)
Assignment rule: Do not assign forward iteration agents until mandatory-vs-optional audit policy is decided. *(Cleared 2026-06-10: policy decided — audits stay optional/manual; forward iteration agents may be assigned under that policy.)*

## Decision (2026-06-10): Audit Policy — Optional/Manual, No CI Gates (S4)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session.

- **Audits stay optional/manual; no CI gates this cycle.** Revisit gating when
  the audit suite stabilizes.
- This unblocks CMA-G19 (large spell-script modularization routing) under the
  manual policy — modularization work on those scripts does not need to wait
  for a gating decision, but any split still needs stage-boundary proof.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D20); local
  record: `docs/projects/scripts-audits/DECISIONS.md` D2.
- Status: decision recorded 2026-06-10; implementation lane open.

## File Map

- `scripts/audits/*.ts` - audit and workflow scripts.
- `scripts/audits/*.py` - image/asset quality helpers.
- `scripts/audits/qa-batches/*` - generated QA inputs, prompts, schema, and outputs.
- `scripts/audits/*.{json,md}` - machine and human-readable state reports.

## Implemented State

- Registry evidence is present:
  - `docs/projects/PROJECT_TRACKER.md` row: `Scripts: audits` with GAPS file present.
- Core audit scripts and outputs already exist in place:
  - `scripts/audits/check-base-trait-coverage.ts`
  - `scripts/audits/check-base-trait-key-coverage.ts`
  - `scripts/audits/audit-race-image-bytes.ts`
  - `scripts/audits/verify-cc-glossary-race-sync.ts`
  - `scripts/audits/audit-race-ids-vs-glossary.ts`
  - `scripts/audits/racialSpellParserAudit.ts`
  - `scripts/audits/trait_analyzer.ts`
  - `scripts/audits/list-slice-of-life-settings.ts`
  - `scripts/audits/mark-slice-of-life-qa.ts`
  - `scripts/audits/orchestrate-race-qa.ts`
  - `scripts/audits/run-qa-batch-agent.ts`
  - `scripts/audits/list-base-race-chooser-candidates.ts`
  - `scripts/audits/inventory-glossary-link-surfaces.ts`
- Image and backlog helpers are also present:
  - `scripts/audits/detect-blank-margins.py`
  - `scripts/audits/check-image-square.py`
  - `scripts/audits/list-non-square-race-images.py`
  - `scripts/audits/race-status-tail.py`
  - `scripts/audits/list-backlog-progress.py`
- Current generated report set includes:
  - `scripts/audits/base-trait-coverage.report.json`
  - `scripts/audits/base-trait-key-coverage.report.json`
  - `scripts/audits/race-image-byte-audit.json`
  - `scripts/audits/slice-of-life-settings.json` and `slice-of-life-settings.md`
  - `scripts/audits/slice-of-life-qa.json`

## Current State

- The project docs are now dashboard-ready: the North Star has a card schema,
  the tracker is aligned to the durable gap list, and the cold-start handoff
  names the canonical protocol paths.
- Live command and report validation is still pending in T2, but forward automation/gating work is blocked by S4 policy review. *(S4 resolved 2026-06-10: audits stay optional/manual, no CI gates this cycle — see the Decision section above; forward work is unblocked under that policy.)*
- The shared workflow path mismatch is already tracked centrally in
  `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` as
  WFG-001.

## Integrations

- `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`:
  - `npm run audit:races`
  - `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`
- `docs/portraits/race_portrait_regen_handoff.md`:
  - `scripts/audits/list-slice-of-life-settings.ts`
  - `scripts/audits/mark-slice-of-life-qa.ts`
  - `scripts/audits/orchestrate-race-qa.ts`
  - `scripts/audits/run-qa-batch-agent.ts`
  - `scripts/audits/qa-batches/QA_RUBRIC.md`
- `scripts/run-portrait-regen.cmd`:
  - `npx tsx scripts/audits/list-slice-of-life-settings.ts`
- Output consumers:
  - `public/data/dev/slice-of-life-settings.json/.md`
  - `docs/portraits/race_portrait_regen_backlog.json`
  - `public/assets/images/races/race-image-status.json`

## Active Task

| Field | Value |
|---|---|
| Task | Keep the docs aligned with the current scripts/audits surface and unresolved check gaps |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS stay compact, current, and point the next agent at the live command/report paths |
| Allowed boundaries | `docs/projects/scripts-audits/*` |
| Stop condition | Next maintainer can resume immediately from this docs set |
| Verification | docs consistency review completed; live path validation remains the next check |
| Owner | scripts-audits maintainer |

## Open Questions

- Which checks should be the canonical local entrypoint versus standalone commands?
- What freshness threshold makes generated reports safe to treat as current evidence?
- Should the CI/manual policy decision stay project-local or be routed to a broader workflow note? *(Answered 2026-06-10: recorded project-locally in DECISIONS.md D2 with the master record at `docs/projects/DECISION_BLITZ_2026-06-10.md` D20 — audits stay optional/manual, no CI gates this cycle.)*

## Next Checks

1) `npx tsx scripts/audits/audit-race-image-bytes.ts`
2) `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts`
3) `npx tsx scripts/audits/list-slice-of-life-settings.ts`
4) `python scripts/audits/race-status-tail.py --n 20`
5) Compare the command and report paths named in this file against the live docs tree and the current `scripts/audits` outputs.

## Resume Path

1. Read this file.
2. Read `docs/projects/scripts-audits/TRACKER.md`.
3. Read `docs/projects/scripts-audits/GAPS.md`.
4. Re-run the "Next Checks" list and update `TRACKER.md`.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
