# World 3D UI Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create initial living-project scaffold from registry evidence | Worker B | 2026-05-31 | `docs/projects/world-3d-ui/` | Keep files in `docs/projects/world-3d-ui/` and confirm all three protocol files exist | `Get-Content docs/projects/world-3d-ui/NORTH_STAR.md` and `GAPS.md` |
| T2 | done | Carry registry follow-up gap into active planning | Worker B | 2026-05-31 | `docs/projects/world3d/TRACKER.md` | Map the gap to the UI project and preserve registry intent | evidence added to `docs/projects/world-3d-ui/GAPS.md` |
| T3 | done | Refresh project docs with current world-3d UI implementation scan | Worker B | 2026-05-31 | `src/components/World3D`, `src/App.tsx`, `src/hooks/useHistorySync.ts` | Replace scaffold-only wording with concrete UI state and controls status | `Get-Content docs/projects/world-3d-ui/TRACKER.md` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker B | `docs/projects/world-3d-ui/GAPS.md` | live doc refresh | Demo still uses inline loader while worker-backed loader utilities exist in `src/components/World3D/createWorkerChunkLoader.ts` and `src/components/World3D/chunkWorker.ts` | `src/components/World3D/World3DDemo.tsx`, `src/components/World3D/createWorkerChunkLoader.ts`, `src/components/World3D/chunkWorker.ts` | Streaming parity and production behavior assumptions are ambiguous today | Decide whether to switch `World3DDemo` to worker-backed loading in the same slice or add an explicit follow-up | decision captured in project gap row with acceptance check |
| G2 | active | in_scope_now | Worker B | `docs/projects/world-3d-ui/GAPS.md` | live doc refresh | `ChunkLoader` typing advertises `Promise<ChunkMeshBundle>` while production demo code path returns `ChunkGeometryArrays` | `src/systems/world3d/types.ts`, `src/components/World3D/useChunkStreaming.ts`, `src/components/World3D/createWorkerChunkLoader.ts`, `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts` | Type drift can block later renderer expansion from bundle meshes to full content systems | Resolve contract in docs, then align type/tests before bundle migration | add a compile or targeted type-shape check |
| G3 | active | adjacent_follow_up | Worker B | `docs/projects/world3d/GAPS.md` | live doc refresh | No dedicated visual or component-level mount/unmount test for `World3DScene` camera and streaming lifecycle | `src/components/World3D/World3DScene.tsx`, `src/components/World3D/__tests__/useChunkStreaming.test.tsx` | Scene lifecycle regressions are likely only visible through render assertions | Add one reliable Playwright or RTL lifecycle check before feature hardening | include proof summary in next project audit or tracker note |
| G4 | active | in_scope_now | Worker B | `docs/projects/world-3d-ui/GAPS.md` | live doc refresh | No in-surface view toggle or mode switch is implemented in `World3DDemo` | `src/components/World3D/World3DDemo.tsx` | Product-level expectations around controls/entry UX are currently unknown | Clarify intended scope: sandbox-only or user-switchable world3d mode | add explicit scope line to NORTH_STAR and acceptance checks |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/world-3d-ui/GAPS.md`.
