# Puzzles System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists
This project owns the existing puzzle-family runtime in `src/systems/puzzles` and the lockpicking UI bridge. It was previously represented in the registry but had only a scaffold-level project doc. This pass preserves the actual working boundaries so future work does not erase partial systems.

## Intended Outcome
Create a documentation-first cold-start pack for Puzzles System that preserves what is already implemented, what is currently wired into state/UI, and what remains unresolved before full puzzle progression work resumes.

## Current State

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

### Test Coverage

- `src/systems/puzzles/__tests__/lockSystem.test.ts`
- `src/systems/puzzles/__tests__/pressurePlateSystem.test.ts`
- `src/systems/puzzles/__tests__/secretDoorSystem.test.ts`
- `src/systems/puzzles/__tests__/puzzleSystem.test.ts`
- `src/systems/puzzles/__tests__/skillChallengeSystem.test.ts`

## Active Task

| Field | Value |
|---|---|
| Task | Replace scaffold docs with evidence-backed Puzzles System cold-start context. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` contain file-level scope, integration map, and concrete unresolved gaps tied to evidence. |
| Allowed boundaries | `docs/projects/puzzles/*` only |
| Stop condition | Documentation complete and bounded to evidence, with no gameplay edits. |
| Verification | Source and state scans under `src/systems/puzzles`, `src/components/puzzles`, `src/state`, `src/types`, and `docs/architecture/domains/puzzles-quests-rituals.md`. |
| Owner | Worker A |
| Next action | Keep implementation-safe gaps active and map which gaps are in-scope vs cross-project. |

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
| `puzzleSystem` hint path is effectively non-functional (`getPuzzleHint` returns `null`). | support_needed_now | Worker A | `src/systems/puzzles/puzzleSystem.ts` | Define check payload contract and decide the caller for live hint checks. |
| Lockpicking modal has only dev entry (`test_lockpicking`) for state dispatch. | in_scope_now | Worker A | `src/App.tsx`, `src/state/actionTypes.ts`, `src/components/layout/GameModals.tsx` | Find the first production dispatch source for `OPEN_LOCKPICKING_MODAL` and add payload expectations. |
| `Lock.keyId` exists in type model but is not consumed by lock resolution logic. | in_scope_now | Worker A | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Clarify key resolution ownership and lock unlock path before any lock-key progression work. |
| Legacy character fallback flow spans many puzzle modules and tests. | support_needed_now | Worker A | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Preserve shim behavior and define migration steps before adding new puzzle features. |
| No runtime puzzle-to-map integration is proven from entity/encounter data yet. | support_needed_now | Worker A | `src/systems/puzzles/*.ts` tests only, TODO markers in runtime files | Add at least one evidence-backed production path from dungeon object to puzzle invocation. |
| Multiple TODOs point to BattleMap/Submap integration (mechanism, secret doors, pressure plates, arcane glyph spells). | adjacent_follow_up | Worker A | `src/systems/puzzles/mechanism.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/arcaneGlyphSystem.ts` | Route these to a separate integration slice unless lock progression requires immediate action. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `src/systems/puzzles/*` | Runtime modules are implemented and cover lock, trap, puzzle, and mechanism behavior. | `src/systems/puzzles/` |
| `src/systems/puzzles/__tests__/*` | Each implemented puzzle module has targeted unit tests. | `src/systems/puzzles/__tests__/` |
| `src/components/puzzles/LockpickingModal.tsx` | Lockpicking modal UI exists and is functionalized with callbacks. | `src/components/puzzles/LockpickingModal.tsx` |
| `src/state/actionTypes.ts` and `src/state/reducers/uiReducer.ts` | Lock modal actions and reducer transitions are wired into state. | `src/state/` |
| `src/components/layout/GameModals.tsx` | Active lockpicking modal is rendered from game state. | `src/components/layout/GameModals.tsx` |
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
