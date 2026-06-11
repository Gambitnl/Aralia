# Layout Project Decisions

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
- Project folder: `docs/projects/layout`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: `isUIInteractive` contract + app-shell split (G3/G4)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
G3 — should `GameModals` keep `isUIInteractive` as a compatibility-only pass-through, or should it be wired into a modal interaction-lock policy (or retired)? G4 — is the `App.tsx` app-shell modularization approved, and under what preservation contract?

Decision made:
- G3: `isUIInteractive` stays as a documented compatibility pass-through (Required Review Brief Option A). Wiring it into a modal-lock policy or retiring it is a later, separate decision.
- G4: App-shell split approved. Provider composition moves out of `App.tsx` into a dedicated app-shell module, with explicit preservation tests covering provider order, `DataLoaderGate`, and `GameProvider` boundaries (joint decision with Providers / G5).

Rationale and evidence:
- The App-level interaction flag already governs `GameLayout`/`TownCanvas`/companion reactions; committing to a modal-lock policy now would expand Layout scope without need.
- The split is safe only with preservation tests, so the tests are part of the approved scope, not optional.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D7).

Follow-up:
Implement the app-shell split slice (tracker T5); document the pass-through contract wherever `GameModals` props are described.
