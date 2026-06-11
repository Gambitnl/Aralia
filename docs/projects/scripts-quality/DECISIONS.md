# Scripts: Quality Decisions

Status: active
Last updated: 2026-06-10

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
- Project folder: `docs/projects/scripts-quality`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Script Tests merged into Scripts: Quality (receiving side)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
`docs/projects/script-tests` was a merge-candidate awaiting a standalone-vs-merge review before worker assignment.

Decision made:
**Scripts: Quality now owns the script-tests surface.** `docs/projects/script-tests` becomes a merged-reference support surface of this project; its tracker row becomes merged-reference. The inherited scope is the `scripts/__tests__` continuity contract and the open gaps ST-GAP-001 through ST-GAP-004 (tracked here as GAPS.md G4 / TRACKER.md T6).

Rationale and evidence:
- The script test suite guards the same script-layer quality posture this project owns; a separate project added tracker overhead without a distinct owner.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21).
- Merged-side record: `docs/projects/script-tests/DECISIONS.md` D2.

Follow-up:
Run ST-GAP test slices under this tracker (ST-GAP-001 first); mirror status back into the support-surface gap registry. Expansion-first: the script-tests docs are retained, not deleted.
