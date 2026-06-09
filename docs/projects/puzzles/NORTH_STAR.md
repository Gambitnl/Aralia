# Puzzles System North Star

Status: active
Last updated: 2026-06-09

## Why This Project Exists
This project owns the existing puzzle-family runtime in `src/systems/puzzles` and the lockpicking UI bridge. It was previously represented in the registry but had only a scaffold-level project doc. This pass preserves the actual working boundaries so future work does not erase partial systems.

## Intended Outcome
Create a documentation-first cold-start pack for Puzzles System that preserves what is already implemented, what is currently wired into state/UI, and what remains unresolved before full puzzle progression work resumes.

## Current State

This project has a living-project doc set in place and a first production lockpicking
entry path is now active.

### Implemented Runtime

- `src/systems/puzzles/lockSystem.ts`
  - lockpick, break, detect trap, and disarm trap flows.
- `src/systems/puzzles/pressurePlateSystem.ts`
  - plate trigger, hidden detection, jam, and reset behavior.
- `src/systems/puzzles/secretDoorSystem.ts`
  - search, investigate, operate, XP award on detection.
- `src/systems/puzzles/arcaneGlyphSystem.ts`
  - magical trap detect/disarm/identify logic.
- `src/systems/puzzles/mechanism.ts`
  - physical mechanism operation and linked-event emission.
- `src/systems/puzzles/puzzleSystem.ts`
  - sequence/item/riddle puzzle attempt and hint checks.
- `src/systems/puzzles/skillChallengeSystem.ts`
  - structured challenge creation and success/failure accounting.
- `src/systems/puzzles/types.ts` and `src/systems/puzzles/types.d.ts`
  - shared types for `Lock`, `Trap`, `Puzzle`, `SecretDoor`, `PressurePlate`, `Mechanism`, and skill challenges.

### Implemented UI and State Wiring

- `src/components/puzzles/LockpickingModal.tsx`
  - interactive lock picking and disarming modal with dice hooks and trap callbacks.
- `src/state/actionTypes.ts`, `src/state/actionTypes.d.ts`, `src/state/initialState.ts`, `src/state/appState.ts`, `src/state/reducers/uiReducer.ts`
  - lockpicking modal visibility and active lock state are persisted in app state.
- `src/types/state.ts`, `src/types/state.d.ts`
  - `isLockpickingModalVisible` and `activeLock` are part of persisted state shape.
- `src/components/layout/GameModals.tsx`
  - renders lockpicking modal when `gameState.isLockpickingModalVisible` is true.
- `src/App.tsx`
  - dev action `test_lockpicking` dispatches `OPEN_LOCKPICKING_MODAL` with a sample locked object.
- `src/data/world/locations.ts`
  - added `cave_entrance.interactableFeatures` with a lock contract that routes into action generation.
- `src/components/ActionPane/useActionGeneration.ts`
  - real location feature scan now emits `OPEN_LOCKPICKING_MODAL` action items.
- `src/hooks/actions/actionHandlers.ts`
  - added lock action handling that dispatches `OPEN_LOCKPICKING_MODAL` into UI state.

### Test Coverage

- `src/systems/puzzles/__tests__/lockSystem.test.ts`
- `src/systems/puzzles/__tests__/pressurePlateSystem.test.ts`
- `src/systems/puzzles/__tests__/secretDoorSystem.test.ts`
- `src/systems/puzzles/__tests__/puzzleSystem.test.ts`
- `src/systems/puzzles/__tests__/skillChallengeSystem.test.ts`
- `src/components/ActionPane/__tests__/ActionPane.test.tsx`
  - validates the production lock route from `cave_entrance` interaction to an action payload.

## Dashboard Card Schema

Project: Puzzles System
Slug: puzzles
Category: Gameplay Systems
Status: active
Confidence: medium
Evidence: docs/projects/puzzles
Gap signal: 5 open project gaps
Protocol: living project doc set
Next step: Implement lock/puzzle follow-up in G2/PZ-002 or route to an owning owner.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Active Task

| Field | Value |
|---|---|
| Task | Implemented the first production lockpicking dispatch path from a real world encounter (`cave_entrance` lock feature -> `OPEN_LOCKPICKING_MODAL`). |
| Acceptance criteria | A non-dev callsite can reach `OPEN_LOCKPICKING_MODAL`, or the blocker is documented with evidence in `GAPS.md`. |
| Allowed boundaries | `docs/projects/puzzles/*` for docs, plus the smallest lock-entry runtime slice needed to prove the path. |
| Stop condition | Production entry path is proven with source-backed dispatch test coverage. |
| Verification | Source scan plus `src/components/ActionPane/__tests__/ActionPane.test.tsx` lock-route assertion. |
| Owner | Worker A |
| Next action | Address PZ-002 key/hint/map follow-ups in order, with `PZ-002` highest priority. |

## Scope and Boundaries

In scope:
- Concrete file map for implemented puzzle subsystems.
- State/renderer handoff for lockpicking modal visibility and active lock object.
- Inventory of immediate in-scope gaps blocking gameplay integration.

Adjacent but not in this slice:
- Puzzle content authoring data feed (world tile, item, and NPC generation).
- Quest/ritual system sequencing and overall progression math.
- Full key registry or item economy rules.

Out of scope:
- Runtime behavior refactors in any file not owned by this project docs update.
- Broad architectural simplification of character/stat systems.

## What Must Not Be Lost

- The puzzle domain is broader than one lock mechanic: lock, glyph, pressure plate, mechanism, secret door, and challenge systems are all active in code.
- Modal behavior is state-driven and relies on persisted fields in app state.
- Several systems intentionally use compatibility paths (`character.stats`) with explicit TODOs in source and type files.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `puzzleSystem` hint path is effectively non-functional (`getPuzzleHint` returns `null`). | support_needed_now | Worker A | `src/systems/puzzles/puzzleSystem.ts` | Define the hint check payload and the caller that owns live hint checks. |
| Lockpicking modal has only dev entry (`test_lockpicking`) for state dispatch. | done | Worker A | `src/data/world/locations.ts`, `src/components/ActionPane/useActionGeneration.ts`, `src/hooks/actions/actionHandlers.ts` | Production path now routes a cave location lock interaction through `OPEN_LOCKPICKING_MODAL`. |
| `Lock.keyId` exists in the type model but is not consumed by lock resolution logic. | in_scope_now | Worker A | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Clarify key ownership and the unlock path before any lock-key progression work. |
| Legacy character fallback flow spans many puzzle modules and tests. | support_needed_now | Worker A | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Preserve shim behavior and define the migration target before expanding puzzle checks. |
| No runtime puzzle-to-map integration is proven from entity/encounter data yet. | support_needed_now | Worker A | `src/systems/puzzles/*.ts` tests only, TODO markers in runtime files | Add one evidence-backed production path from a dungeon object to puzzle invocation. |
| Multiple TODOs point to BattleMap/Submap integration (mechanism, secret doors, pressure plates, arcane glyph spells). | adjacent_follow_up | Worker A | `src/systems/puzzles/mechanism.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/arcaneGlyphSystem.ts` | Route this to a separate integration slice unless lock progression needs it immediately. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `src/systems/puzzles/*` | Runtime modules are implemented and cover lock, trap, puzzle, and mechanism behavior. | `src/systems/puzzles/` |
| `src/systems/puzzles/__tests__/*` | Each implemented puzzle module has targeted unit tests. | `src/systems/puzzles/__tests__/` |
| `src/components/puzzles/LockpickingModal.tsx` | Lockpicking modal UI exists and is functionalized with callbacks. | `src/components/puzzles/LockpickingModal.tsx` |
| `src/state/actionTypes.ts` and `src/state/reducers/uiReducer.ts` | Lock modal actions and reducer transitions are wired into state. | `src/state/` |
| `src/components/layout/GameModals.tsx` | Active lockpicking modal is rendered from game state. | `src/components/layout/GameModals.tsx` |
| `src/data/world/locations.ts` | Real-world encounter feature data now seeds a lock interaction payload. | `src/data/world/locations.ts` |
| `src/components/ActionPane/useActionGeneration.ts` | World features now emit gameplay lock actions with lock payload. | `src/components/ActionPane/useActionGeneration.ts` |
| `src/hooks/actions/actionHandlers.ts` | Lock action now dispatches `OPEN_LOCKPICKING_MODAL` into UI state. | `src/hooks/actions/actionHandlers.ts` |
| `docs/architecture/domains/puzzles-quests-rituals.md` | Architecture view confirms puzzle lane breadth. | `docs/architecture/domains/puzzles-quests-rituals.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/PROJECT_TRACKER.md | Repo-level project registry | active |
| docs/projects/GLOBAL_GAPS.md | Global gap routing surface | active |
| docs/projects/puzzles/TRACKER.md | Active queue and gap routing decisions | active |
| docs/projects/puzzles/GAPS.md | Durable gap registry | active |

## Concrete File Map

| File | Role | Status |
|---|---|---|
| `src/systems/puzzles/types.ts` / `src/systems/puzzles/types.d.ts` | Shared model for locks, traps, puzzles, pressure plates, mechanisms, secret doors | active |
| `src/systems/puzzles/lockSystem.ts` | Lock and trap resolution primitives | active |
| `src/systems/puzzles/arcaneGlyphSystem.ts` | Magical trap detection and disarming | active |
| `src/systems/puzzles/pressurePlateSystem.ts` | Pressure plate interaction primitives | active |
| `src/systems/puzzles/secretDoorSystem.ts` | Secret door operations | active |
| `src/systems/puzzles/mechanism.ts` | Mechanism operation | active |
| `src/systems/puzzles/puzzleSystem.ts` | Riddle/sequence/item puzzle resolution | active |
| `src/systems/puzzles/skillChallengeSystem.ts` | Social/combat skill challenge flow | active |
| `src/systems/puzzles/__tests__/` | Test coverage for runtime behavior | active |
| `src/components/puzzles/LockpickingModal.tsx` | Puzzle UI entry surface | active |
| `src/state/actionTypes.ts` / `src/state/initialState.ts` / `src/state/appState.ts` / `src/state/reducers/uiReducer.ts` / `src/types/state.ts` | Lockpicking modal state lifecycle | active |
| `src/components/layout/GameModals.tsx` | Modal mount and display path | active |


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle the next highest-value evidence-backed project gap in the same pass
- keep the key, hint, and map-integration follow-ups separated unless the chosen slice needs them
- if no valid in-scope project gaps exist, identify real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy a count
