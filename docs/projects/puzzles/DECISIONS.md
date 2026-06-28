# Puzzles System Decisions

Status: active
Last updated: 2026-06-27

## Decision Log

### D-001: First Production Lockpicking Dispatch

Date: 2026-06-09

Decision: Route first gameplay lockpicking entry from world encounter data via
`Location.interactableFeatures[].type === 'lock'` to an `OPEN_LOCKPICKING_MODAL` action with `Lock` payload.

Rationale:

- A direct, data-driven interaction from world location definitions avoids adding
  an isolated UI-only test path.
- The same action shape already exists in state and modal state flow.
- Keeping the route in location feature data preserves future expansion toward other
  interactable feature types.

Alternatives considered:

- Keep `test_lockpicking` as the only entry point.
  - Rejected because lockpicking remained non-gameplay and blocked feature progression.
- Introduce a new one-off encounter action API.
  - Rejected because a broader encounter feature contract was already available in `Location`.

### D-002: Payload Contract

Date: 2026-06-09

Decision: `OPEN_LOCKPICKING_MODAL` carries the full `Lock` object and is passed unchanged through
`useActionGeneration -> useGameActions -> actionHandlers -> reducer/ui state`.

Rationale:

- Avoid early serialization shape drift between location data and modal state.
- Keeps lock metadata (`dc`, `breakDC`, `trap`, etc.) immediately available where
  needed by `LockpickingModal` without hidden lookup adapters.

### D-003: Puzzle Hint Caller Ownership (PZ-007)

Date: 2026-06-10

Decision: Approve a **dedicated puzzle-facing runtime surface** owned by the Puzzles
project, and wire the first gameplay `getPuzzleHint` caller there with a focused test
(Option A from the Required Review Brief).

Decider: Remy (project owner), batched decision session. Master record:
`docs/projects/DECISION_BLITZ_2026-06-10.md` (D13).

Rationale:

- The hint helper is live and unit-proven, but had no runtime owner for `Puzzle`
  instances; parking it (Option B) would leave a half-finished flow.
- A puzzle-owned surface avoids inventing an adapter through lockpicking-only UI and
  keeps the `Puzzle` model in its owning domain.

Alternatives considered:

- Route hint ownership to a different project or future slice (Option B).
  - Rejected because no other project owns runtime `Puzzle` objects, and the deferral
    had no concrete landing site.

Follow-up status:

- Completed 2026-06-27: the surface, first gameplay `getPuzzleHint` callsite,
  and focused runtime caller test landed. PZ-003 later closed the key runtime
  contract separately.

### D-004: Key Matching Ownership (PZ-003)

Date: 2026-06-27

Decision: The puzzle lock runtime owns deterministic key matching, but it does
not own inventory, economy, or item-registry lookup. Callers provide a set or
list of available key ids, and `attemptKeyUnlock` compares those ids with
`Lock.keyId`.

Rationale:

- `Lock.keyId` already belongs to the puzzle lock model, so the matching rule
  should live beside lockpick, break, trap-detect, and trap-disarm logic.
- Inventory and economy systems may later decide which item ids are available,
  but the lock runtime does not need those broader registries to answer whether
  a specific lock accepts a specific key id.
- This preserves a narrow, testable contract that future modal or inventory
  callers can consume without widening PZ-003 into a full key item system.

Alternatives considered:

- Add inventory lookup directly to the puzzle runtime.
  - Rejected for this slice because it would make the puzzle package own item
    sourcing and registry behavior outside the active lock-runtime gap.
- Leave key matching fully to future inventory callers.
  - Rejected because lock progression would still have no deterministic runtime
    acceptance rule for `Lock.keyId`.

Follow-up:

- Wire visible key use or inventory key sourcing as a future bounded caller
  slice if gameplay needs it. That future slice should consume `attemptKeyUnlock`
  instead of redefining the key-match rule.

### D-005: Puzzle Runtime Character Ability Source (PZ-004)

Date: 2026-06-27

Decision: Puzzle runtime checks should prefer modern character ability data in
this order: `finalAbilityScores`, then `abilityScores`, then legacy
`character.stats` only as a compatibility fallback.

Rationale:

- `finalAbilityScores` represents the active character sheet after character
  creation modifiers and should drive puzzle DC checks when available.
- Keeping `abilityScores` as the second source lets modern fixtures without
  final-score materialization still work.
- Legacy `character.stats` remains necessary for older tests, saves, and
  partial puzzle callers, but copying legacy-first helpers across puzzle modules
  created drift risk.

Alternatives considered:

- Keep each puzzle module's local legacy-first helper.
  - Rejected because lock, plate, door, and glyph checks could silently diverge
    as the character model migrates.
- Remove `character.stats` fallback immediately.
  - Rejected because existing compatibility fixtures and older callers still
    depend on that shape.

Follow-up:

- Future puzzle runtime checks should use `getPuzzleCharacterStats` or modern
  ability data directly. Caller-side adapters, including UI bridges, should be
  aligned with this rule when those surfaces are next touched.
