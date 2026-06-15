# Crime UI Decisions

Status: active
Last updated: 2026-06-15

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/crime-ui`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: GAPS.md status reconciled with TRACKER.md

Date: 2026-06-15

Owner: T2 implementation (Qoder)

Decision point:
GAPS.md listed all 5 gaps as `not_started` while TRACKER.md gap log listed G2-G4 as `active`. The two files were inconsistent.

Decision made:
Reconciled all gaps to `active` status in both files. All 5 gaps are confirmed real with source evidence re-verified on 2026-06-15.

Rationale and evidence:
- Source code scan confirmed each gap is backed by current implementation evidence.
- TRACKER.md gap log was the more accurate source (gaps were actively tracked).
- GAPS.md `not_started` was stale from initial scaffold creation.

Follow-up:
Future gap status changes should be updated in both GAPS.md and TRACKER.md simultaneously.
