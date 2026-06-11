# Party UI Decisions

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
- Project folder: `docs/projects/party-ui`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Roster acceptance rule for non-companion NPCs (G5)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Can party roster membership include non-companion NPC party entities, and if so, under what acceptance rule? (GAPS.md G5; NORTH_STAR "Next checks".)

Decision made:
Yes — the party roster MAY include non-companion NPCs, but only under an explicit acceptance rule. The acceptance rule must be defined as the first step of the implementation slice, covering the membership model, character-sheet context behavior for non-companion entries, and save/load semantics. Writing the rule unblocks G7 (companion data threading into `PartyOverlay`).

Rationale and evidence:
- The canonical companion/party boundary (separate identity spaces, best-effort id bridge) already tolerates non-companion party members; the missing piece is an explicit acceptance rule, not a structural change.
- Sequencing the rule first keeps G7 work verifiable against a written contract instead of an inferred one.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D15).

Follow-up:
Write the acceptance rule into NORTH_STAR as step one of the G5/G7 implementation slice, then proceed with G7.
