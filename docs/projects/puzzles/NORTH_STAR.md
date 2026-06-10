---
schema_version: 1
project: Puzzles System
slug: puzzles
category: Gameplay Systems
main_category: "Game & Simulation"
subcategory: Core Sim Systems
status: review-required
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/puzzles
gap_signal: "5 open project gaps; hint caller is review-required"
protocol: living project doc set
next_step: Await the hint-caller ownership decision, then continue with PZ-003.
agent_comments: getPuzzleHint is live, but no runtime Puzzle owner exists yet.
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
  - git_diff_check
completed_verification:
  - scoped_tests
  - docs_consistency
  - git_diff_check
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Puzzles System North Star

Status: review-required
Last updated: 2026-06-09

## Why This Project Exists
This project owns the existing puzzle-family runtime in `src/systems/puzzles` and the lockpicking UI bridge. It was previously represented in the registry but had only a scaffold-level project doc. This pass preserves the actual working boundaries so future work does not erase partial systems.

## Intended Outcome
Create a documentation-first cold-start pack for Puzzles System that preserves what is already implemented, what is currently wired into state/UI, and what remains unresolved before full puzzle progression work resumes.

## Current State

This project has a living-project doc set in place and a live puzzle hint helper
is now active, but no runtime caller owns a `Puzzle` object yet.

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
  - sequence/item/riddle puzzle attempt logic plus live hint resolution via `getPuzzleHint`.
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

## Required Review Brief

Title: Puzzles hint caller ownership
Question: Which runtime surface should own the first gameplay call to `getPuzzleHint`?
Issue: `src/systems/puzzles/puzzleSystem.ts` now exposes a live hint helper, but the runtime currently only mounts lockpicking UI for `Lock` state. No gameplay surface in `src/components/puzzles`, `src/components/layout/GameModals.tsx`, or `src/hooks/actions` passes a real `Puzzle` object into a caller yet.
Current behavior: `getPuzzleHint` is proven by unit test, but there is no source-backed gameplay callsite that can supply the required `Puzzle` model from live play.
Why blocked: The helper is ready, but the project has not yet picked a runtime owner for `Puzzle` instances or a UI contract that would surface hints to players without inventing an adapter.
Option A: Approve a dedicated puzzle-facing runtime surface and wire the first gameplay caller there, then add the focused test for that path.
Option B: Keep the hint helper parked for now and route hint ownership to a different project or future slice before any new UI is added.
Evidence: `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts`, `src/components/puzzles/LockpickingModal.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/actionHandlers.ts`, and the targeted source scan showing no other runtime caller.
Decision owner: Human/product owner for puzzle hint UX and runtime ownership.
Proof after decision: A focused runtime caller test plus the chosen caller wiring, or a documented handoff to the owning project with the gap removed from this queue.

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
Status: review-required
Confidence: medium
Evidence: docs/projects/puzzles
Gap signal: 5 open project gaps; hint caller is review-required
Protocol: living project doc set
Next step: Await the hint-caller ownership decision, then continue with PZ-003.
Required verification: scoped_tests, docs_consistency, git_diff_check
Completed verification: scoped_tests, docs_consistency, git_diff_check
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Active Task

| Field | Value |
|---|---|
| Task | Resolve `getPuzzleHint` runtime caller ownership. |
| Acceptance criteria | The hint helper remains source-backed, the caller ownership question is recorded in a Required Review Brief, and the next safe resume action is explicit. |
| Allowed boundaries | `docs/projects/puzzles/` plus the smallest source-scan evidence needed to prove no runtime caller exists yet. |
| Stop condition | Do not wire a fake caller without a gameplay owner decision. |
| Verification | `docs/projects/puzzles/NORTH_STAR.md`, `docs/projects/puzzles/TRACKER.md`, `docs/projects/puzzles/GAPS.md`, `docs/projects/puzzles/AUDIT_OR_PROOF.md`, and `docs/projects/puzzles/RUNBOOK.md` stay aligned with the blocker state. |
| Owner | human/product owner |
| Next action | Await the hint-caller ownership decision, then continue with `PZ-003` if a runtime surface is approved. |

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
| `getPuzzleHint` is live, but no runtime `Puzzle` owner exists yet. | review-required | human/product owner | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts`, `src/components/puzzles/LockpickingModal.tsx` | Resolve the Required Review Brief before wiring a gameplay caller. |
| Lockpicking modal has only dev entry (`test_lockpicking`) for state dispatch. | done | Worker A | `src/data/world/locations.ts`, `src/components/ActionPane/useActionGeneration.ts`, `src/hooks/actions/actionHandlers.ts` | Production path now routes a cave location lock interaction through `OPEN_LOCKPICKING_MODAL`. |
| `Lock.keyId` exists in the type model but is not consumed by lock resolution logic. | in_scope_now | Worker A | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Clarify key ownership and the unlock path before any lock-key progression work. |
| Legacy character fallback flow spans many puzzle modules and tests. | support_needed_now | Worker A | `src/systems/puzzles/*.ts`, `src/types/character.ts` | Preserve shim behavior and define the migration target before expanding puzzle checks. |
| No runtime puzzle-to-map integration is proven from entity/encounter data yet. | support_needed_now | Worker A | `src/systems/puzzles/*.ts` tests only, TODO markers in runtime files | Add one evidence-backed production path from a dungeon object to puzzle invocation. |
| Multiple TODOs point to BattleMap/Submap integration (mechanism, secret doors, pressure plates, arcane glyph spells). | adjacent_follow_up | Worker A | `src/systems/puzzles/mechanism.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/arcaneGlyphSystem.ts` | Route this to a separate integration slice unless lock progression needs it immediately. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `src/systems/puzzles/*` | Runtime modules are implemented and cover lock, trap, puzzle, and mechanism behavior. | `src/systems/puzzles/` |
| `src/systems/puzzles/puzzleSystem.ts` and `src/systems/puzzles/__tests__/puzzleSystem.test.ts` | `getPuzzleHint` now resolves a live Intelligence check and a deterministic test proves a hint can be returned. | `src/systems/puzzles/` |
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
| `src/systems/puzzles/puzzleSystem.ts` | Riddle/sequence/item puzzle resolution and live hint lookup | active |
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
- do not treat the live hint helper as gameplay-complete until a caller is wired
- if no valid in-scope project gaps exist, identify real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy a count
