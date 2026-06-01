# World 3D UI Gaps

Status: active
Last updated: 2026-05-31

Use this file for unresolved findings owned by the World 3D UI surface.

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| W3DUI-1 | not_started | in_scope_now | Worker B | `docs/projects/world-3d-ui/TRACKER.md` | scan of World 3D UI files | `World3DDemo` still uses inline loader and does not use `createWorkerChunkLoader` on the default entry path | `src/components/World3D/World3DDemo.tsx`, `src/components/World3D/createWorkerChunkLoader.ts`, `src/components/World3D/chunkWorker.ts` | Streaming behavior can differ from worker-backed behavior before moving from sandbox to real UI usage | Decide entry strategy and either switch this entry to worker-backed loading or document sandbox parity exception | Add acceptance text to implementation ticket and verify by observing `load` path in a run |
| W3DUI-2 | not_started | in_scope_now | Worker B | `docs/projects/world3d/TRACKER.md` | scan of shared types and loader usage | `ChunkLoader` type definition expects `Promise<ChunkMeshBundle>` while current callers/tests currently return `ChunkGeometryArrays` | `src/systems/world3d/types.ts`, `src/components/World3D/useChunkStreaming.ts`, `src/components/World3D/createWorkerChunkLoader.ts`, `src/components/World3D/__tests__/createWorkerChunkLoader.test.ts` | Contract mismatch blocks clean migration from placeholder geometry to richer bundle output | Resolve contract in the owning system docs first, then update all UI loaders/consumers in one pass | type-level proof in build/test step before adding bundle consumers |
| W3DUI-3 | not_started | adjacent_follow_up | Worker B | `docs/projects/world3d/GAPS.md` | scan of scene lifecycle usage | No visual/component-level mount-unmount test for `World3DScene` and camera control lifecycle | `src/components/World3D/World3DScene.tsx`, `src/components/World3D/__tests__/useChunkStreaming.test.tsx` | Regressions may appear only in React mount/unmount and control binding paths | Add one focused Playwright or RTL test for scene mount and cleanup | include proof in next project audit or tracker note |
| W3DUI-4 | not_started | in_scope_now | Worker B | `docs/projects/world3d/TRACKER.md` | scan of demo UI surface | `World3DDemo` currently has no view-mode toggle or control panel state surface | `src/components/World3D/World3DDemo.tsx` | Expected UX for mode switching is currently unstated and easy to break in future handoffs | Define explicit scope for view switches (sandbox-only vs integrated mode) and document acceptance in NORTH_STAR | verify acceptance item exists before code-level expansion |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required to continue the current project slice without rework. |
| `support_needed_now` | Needed before next slice can proceed, but not direct implementation deliverable. |
| `adjacent_follow_up` | Useful, related, and should be recorded, but not required to continue this slice. |
| `out_of_scope` | Not part of this project feature boundary. |
| `blocked_human_decision` | Waiting on owner or product direction choice. |
| `blocked_external_state` | Waiting on another person, environment, vendor, or branch state. |

## Update Rules

- Keep gap rows tied to evidence and a measurable next check.
- Route clear systems-level rows into `docs/projects/world3d/GAPS.md`.
- Remove rows from this file when they become implemented or explicitly out of scope.
