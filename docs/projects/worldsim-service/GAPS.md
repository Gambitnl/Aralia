# GAPS: WorldSim Service

Status: active
Last updated: 2026-05-31

## Durable Gaps

| Gap ID | Gap | Evidence | Why it is in-scope here | Next check |
|---|---|---|---|---|
| WSS-001 | Synchronous world simulation can block UI for large maps. | `src/services/worldSim/index.ts` | `runWorldSim(...)` is currently fully synchronous and called during map generation flow. | Measure generation and migration time on large seed sizes and decide if background scheduling is required. |
| WSS-002 | Migration contract for future `WorldData` schema versions is implicit. | `src/types/world.ts`, `src/state/migrations/worldDataMigration.ts`, `src/services/saveLoadService.ts` | Loader currently enforces idempotence only around `version === 2`; no published policy for staged v3+ upgrades. | Define migration policy and add explicit acceptance tests for next schema bump. |
| WSS-003 | Feature-to-render contract is not fully specified between generation and 3D visual systems. | `src/systems/world3d/chunkSampler.ts`, `src/systems/world3d/chunkWorkerCore.ts`, `src/services/worldSim/index.ts` | `chunkSampler` clips `rivers`/`roads`/`sites`, but mesh builders and renderer consumers are still partially placeholder-centric. | Confirm schema expectations for `Road`, `River`, and `Site` consumers and finalize a durable render contract. |

## Open Questions

- Should `worldSim` expose a secondary fast path for legacy-only or low-end devices to avoid synchronous regeneration at load?
- Should `worldDataMigration` include checksum or generation metadata (`seed`,`templateId`,`inputHash`) to support trust-safe rehydration?
- What is the acceptable fallback behavior when a load-time regenerated world snapshot diverges from a display cache that assumes older feature density?

## Notes

- Keep ownership boundaries explicit: gameplay simulation questions belong in `docs/projects/world`, not here.
