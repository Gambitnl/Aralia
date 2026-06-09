# Puzzles System Decisions

Status: active
Last updated: 2026-06-09

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
