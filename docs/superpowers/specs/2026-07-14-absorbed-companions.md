# Absorbed: Companions System

Absorbed from `docs/projects/companions/` on 2026-07-16 (planning-surface freshness wave).
Planmap topic: `companions` (campaign ui). Git history of the deleted folder is the archive.

## What the system is

The companion social stack: relationship state, reaction dispatch, banter and
conversation UX, and their reducers. It is live in the game and mostly built;
three open lanes remain (see the planmap topic features).

## File ownership map

- `src/systems/companions/RelationshipManager.ts` — approval math on a
  `-500..500` scale with 11 levels, thresholds, unlock checks, event history,
  loyalty retention floor. IDs go through the shared `generateId()` helper
  (`src/utils/core/idGenerator.ts`).
- `src/systems/companions/CompanionReactionSystem.ts` — reaction approvals and
  text from rule matches; rules outside their relationship bounds are filtered
  before aggregation.
- `src/systems/companions/BanterManager.ts` — banter candidate selection by
  cooldown, location, participants, relationship, and chance.
- Hooks: `src/hooks/useCompanionBanter.ts` (ambient banter plus player-directed
  interjection with an explicit response-window contract),
  `src/hooks/useCompanionCommentary.ts`, `src/hooks/useConversation.ts`.
- State: `src/state/reducers/companionReducer.ts`,
  `src/state/reducers/conversationReducer.ts`. `UPDATE_COMPANION_APPROVAL.source`
  is provenance-only routing — do not branch behavior on it.
- UI: `CollapsibleBanterPanel`, `BanterAttentionBanner`, `BanterInterruptUI`,
  `CompanionReaction` (FIFO bubble queue with duplicate suppression),
  `ConversationPanel`, `CompanionCard`, `RelationshipsPane`.
- Data: `src/data/companions.ts`, `src/data/banter.ts`, typed by
  `src/types/companions.ts`.
- Historical risk notes: `src/systems/companions/Companions_Ralph.md` (in src,
  not deleted).

## Live design decisions

- **G6 romance exit = hysteresis** (Remy, 2026-06-10, DECISION_BLITZ D10):
  romance survives temporary approval dips but exits after sustained low
  approval. Threshold and sustained-duration values are specified as the first
  step of the implementation slice, encoded in `RelationshipManager`, proven by
  a romance-to-hostile regression that fires only after the sustained-low
  condition.
- **Banter split contract (G8, docs pass)**: `useCompanionBanter` stays the
  companion-owned orchestration shell (trigger/session gating, line pacing,
  response windows, archive/summarize). Later extraction may pull out session
  policy, line flow, response-window, and archive helpers, but dialogue and
  conversation-panel ownership stay separate.

## Recruitment runtime (open lanes G7/G8)

The recruitment runtime already exists with tests: `RECRUIT_COMPANION` in
`src/state/actionTypes.ts` (~line 243), plus `src/systems/party/npcToPartyMember.ts`,
`recruitConsent.ts`, `recruitTypes.ts` and their test files. What is missing:

- G7: gameplay-owned recruit/leave reducer semantics formally specified
  (payloads, duplicate prevention, approval side effects) — the existing party
  runtime substantially covers the runtime ask; the reducer contract needs proof.
- G8: producer-side wiring — nothing in live dialogue/gameplay surfaces recruit
  offers, so the shipped runtime is unreachable in normal play. Proof is a live
  in-game end-to-end recruitment playtest.

## What must not be lost

- The `-500..500` scale is reconciled across types, runtime clamp, threshold
  tests, and the `CompanionCard` marker — keep future UI math aligned.
- Ambient banter and directed conversation are product-visible and stateful;
  the codebase intentionally mixes finished mechanics with documented
  placeholders, so preserve that distinction when editing.
