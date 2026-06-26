# Crime UI Decisions

Status: complete_for_current_gap_set
Last updated: 2026-06-25

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

### D3: Current Crime UI Gap Set Closed

Date: 2026-06-25

Owner: Codex

Decision point:
Crime UI docs still showed G1, G2, and G5 as active after Crime core and UI
source had moved on.

Decision made:
Close G1-G5 for the current Crime UI gap set. G1 suspect/report aggregation is
deferred in Crime core until a real caller needs structured reports. G2 uses the
dedicated `SELL_FENCED_ITEM` transaction path. G3/G4 remain implemented in
source. G5 is a documented modal lifecycle contract, not a code change.

Rationale and evidence:
- `docs/projects/crime/GAPS.md` G6
- `FenceInterface.tsx`
- `HeistPlanningModal.tsx`
- `ThievesGuildSafehouse.tsx`
- `uiReducer.ts`
- `GameModals.tsx`
- `crimeReducer.ts`

Follow-up:
Run a fresh source-backed Crime UI scan before assigning more work.
