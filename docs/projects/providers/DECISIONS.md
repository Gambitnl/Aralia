# Providers Decisions

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
- Project folder: `docs/projects/providers`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Provider modularization boundary (G5)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should `App.tsx` provider and phase composition be split now, and if so which owner controls the provider boundary and degraded-startup policy? (Required Review Brief in `NORTH_STAR.md`.)

Decision made:
Option B — split the app shell with preservation tests. Provider composition moves out of `App.tsx` into a dedicated app-shell/provider module, with explicit tests preserving provider order, `DataLoaderGate` behavior, and `GameProvider` boundaries. Joint decision with Layout G3/G4 (`isUIInteractive` stays a documented compatibility pass-through on the Layout side).

Rationale and evidence:
- The provider order, startup matrix, and degraded-state behavior are now documented, so the split can be verified against an explicit contract.
- The preservation tests are part of the approved scope, not optional — they are what makes the movement safe.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D7).

Follow-up:
Implement the split slice (tracker T5); run the unblocked `G4` GlossaryContext README sync.
