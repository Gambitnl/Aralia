# SaveLoad North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Save/load is now a cross-system runtime capability. This doc keeps the
implementation model and compatibility behavior available for cold-start handoffs.

## Intended Outcome

Provide a concise, implementation-based handoff that captures:

- Save payload contract and slot key rules
- Storage strategy and migration behavior
- App, hook, and UI integration points
- Current gaps that block continuation

## Current State

SaveLoad is implemented as a working feature with service-level save/load, autosave,
and menu controls.

Implementation present:

- Service: `src/services/saveLoadService.ts`
- IndexedDB adapter: `src/services/indexedDBStorageService.ts`
- Components: `src/components/SaveLoad/SaveSlotSelector.tsx`,
  `src/components/SaveLoad/LoadGameModal.tsx`,
  `src/components/LoadGameTransition.tsx`, `src/components/SaveLoad/index.ts`
- Hooks: `src/hooks/useAutoSave.ts`, `src/hooks/useGameInitialization.ts`
- App wiring: `src/App.tsx`, `src/components/layout/MainMenu.tsx`
- Tests: `src/services/__tests__/saveLoadService.test.ts`,
  `src/services/__tests__/saveLoadService_security.test.ts`
- Migration helper: `src/state/migrations/worldDataMigration.ts`

Observed behavior:

- Save format includes `saveVersion`, `slotId`, `slotName`, optional preview, and
  optional `checksum`.
- Manual, autosave, and checkpoint slot naming rules are normalized by
  `getSlotStorageKey()`.
- Slot metadata is stored in localStorage and sorted by `lastSaved`.
- Full payload write/read path is designed for IndexedDB with localStorage fallback.
- Load path resets transient gameplay flags and migrates legacy date/map state.
- `loadGame` validates checksum and fails on corrupted payloads.

## Active Task

| Field | Value |
|---|---|
| Task | Document implemented SaveLoad runtime behavior for next-session continuity |
| Acceptance criteria | NORTH_STAR, TRACKER, GAPS describe current scope, file map, integrations, gaps, and resume checks |
| Allowed boundaries | `docs/projects/saveload/*` only |
| Stop condition | A cold agent can resume without reopening unrelated code files |
| Verification | `Get-Content docs/projects/saveload/NORTH_STAR.md`, `Get-Content docs/projects/saveload/TRACKER.md`, `Get-Content docs/projects/saveload/GAPS.md` |
| Owner | Worker B |
| Next action | Resolve startup and schema-gap decisions before further persistence changes |

## Scope Boundaries

In scope:

- Documenting SaveLoad implemented state and integration boundaries.
- Capturing observed gaps and next checks that affect persistence reliability.
- Linking evidence to specific runtime files in `src/`.

Adjacent but not in scope:

- Backup file export/import feature
- Server-side persistence or cloud sync
- Broader quota or performance tuning work

Out of scope:

- Editing `src/` code in this docs-only pass
- Moving unrelated persistence subsystems

## File Map

| File | Role |
|---|---|
| `src/services/saveLoadService.ts` | Save/load API, keying, checksum, metadata, migration calls |
| `src/services/indexedDBStorageService.ts` | IndexedDB read/write/clear and availability checks |
| `src/services/__tests__/saveLoadService.test.ts` | Main behavioral tests |
| `src/services/__tests__/saveLoadService_security.test.ts` | Malformed data and index error resilience |
| `src/components/SaveLoad/SaveSlotSelector.tsx` | Save target selection, overwrite prompt, slot normalization |
| `src/components/SaveLoad/LoadGameModal.tsx` | Load and delete slot selection UI |
| `src/components/SaveLoad/LoadGameTransition.tsx` | Post-load transition view |
| `src/components/SaveLoad/index.ts` | Barrel export for SaveLoad components |
| `src/hooks/useAutoSave.ts` | Debounced autosave loop |
| `src/hooks/useGameInitialization.ts` | Optional slotId load flow |
| `src/App.tsx` | Global save checks and clear-all action |
| `src/components/layout/MainMenu.tsx` | Save and load menu entrypoints |
| `src/state/migrations/worldDataMigration.ts` | Legacy map migration to worldData v2 |
| `src/state/initialState.ts` | Save metadata defaults and startup logic |
| `src/types/state.ts` | `saveVersion` and `saveTimestamp` fields |

## What Must Not Be Lost

- Storage split between localStorage metadata and IndexedDB payload storage.
- Save slot key normalization to avoid collisions between UI names and storage keys.
- Checksum and version validation behavior.
- Legacy migration logic for map state compatibility.
- The distinction between temporary menu docs and active runtime behavior.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `initializeStorage()` is not invoked in app startup, so migration to IndexedDB can be skipped | support_needed_now | Worker B | `src/services/saveLoadService.ts` defines `initializeStorage`; no caller found in `src/App.tsx` or `src/hooks` | Add startup hook/call and verify migration path |
| Checkpoint slot tier constants are defined, but checkpoint write scheduling is not in this scanned path | adjacent_follow_up | Worker B | `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS`; runtime scan found no caller | Assign owner and add feature intent |
| Save schema mismatch currently hard-fails load | in_scope_now | Worker B | `loadGame` returns failure on `saveVersion` mismatch | Define migration policy for future versions |
| No explicit export/import file backup flow exists in current SaveLoad UI | adjacent_follow_up | Worker B | No backup commands found in SaveLoad components or service | Decide if export/import should be added as runtime feature |

## Global Gap Imports

Check for cross-project routing:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none identified | no | none | No current global gap dependency found |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `src/services/saveLoadService.ts` | Save contract, checksums, slot indexing, migration hooks | `src/services/saveLoadService.ts` |
| `src/services/indexedDBStorageService.ts` | Async persistence adapter and fallback behavior | `src/services/indexedDBStorageService.ts` |
| `src/App.tsx`, `src/components/layout/MainMenu.tsx` | Runtime entry points and user-facing save/load actions | `src/App.tsx`, `src/components/layout/MainMenu.tsx` |
| `src/services/__tests__/saveLoadService*.ts` | Existing behavioral guarantees and regression coverage | `src/services/__tests__` |
| `docs/projects/PROJECT_TRACKER.md` | Project registry context | `docs/projects/PROJECT_TRACKER.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing | active |
| `docs/projects/saveload/TRACKER.md` | Active queue and implementation slice | active |
| `docs/projects/saveload/GAPS.md` | Durable unresolved items | active |

## Artifact Boundary

Keep only this project documentation and direct evidence references. Do not promote
transient process logs unless a future doc entry requires them.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Who owns startup bootstrap for `initializeStorage()` and storage migration checks? | Without this, migration behavior changes silently by browser mode | TBD | next implementation slice |
| Should version mismatch fail fast forever or migrate across selected versions? | Direct impact on user progress retention | TBD | release planning |
| Is user-facing save export/import required now? | Affects restore and support strategy | TBD | feature scope review |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/saveload/TRACKER.md`.
3. Read `docs/projects/saveload/GAPS.md`.
4. Continue from: `save storage bootstrap and checkpoint/schema decisions`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
