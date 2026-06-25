# Logbook Audit / Proof

Status: active
Last updated: 2026-06-25

Use this file for durable proof summaries, scoped verification notes, and acceptance evidence. Do not paste raw logs unless a short excerpt is required for later agents to understand the result.

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-25 | G4 dossier lifecycle policy | pass | `DossierPane.tsx` reads `metNpcIds` and `npcMemory` but does not own retention. `npcReducer.ts` owns NPC memory mutations, and `handleLongRestWorldEvents` ages `knownFacts` by lifespan and caps oversized fact lists with `MAX_FACTS_PER_NPC`. Decision: dossier entries remain a view over NPC relationship memory; no separate Logbook UI archive/prune code is needed. |
| 2026-06-25 | G3 discovery dedupe policy | pass | `logReducer.ts` now centralizes dedupe for stable discovery identities: `LOCATION_DISCOVERY` by `locationId`, `ITEM_ACQUISITION` by `itemId` plus source, and `ACTION_DISCOVERED` by NPC/location/content. Harvest, quest, lore, and miscellaneous entries remain append-only. `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passed 6/6 tests. Dependency sync was rerun for `src/state/reducers/logReducer.ts`. |
| 2026-06-25 | G2 Logbook list pagination | pass | `DiscoveryLogPane.tsx` and `DossierPane.tsx` now page long left-pane lists in 25-item chunks with visible pinned controls. `npm exec vitest run src/components/Logbook/DiscoveryLogPane.test.tsx src/components/Logbook/DossierPane.test.tsx` passed 2/2 tests. Playwright rendered proof passed for discovery page 1/page 2 and dossier page 2 detail selection; screenshots written to ignored `.agent/scratch/logbook-g2-proof*.png`. |
| 2026-06-25 | G6 quest update content cap | pass | `logReducer.ts` now keeps each quest discovery entry's base content and only the newest 10 appended `Update:` notes. `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passed 4/4 tests, including a 50-update regression that preserves updates 41-50 and drops update 40. Dependency sync was rerun for `src/state/reducers/logReducer.ts`. |
| 2026-06-10 | Required-doc surface initialized | pass | `docs/projects/logbook/NORTH_STAR.md` declares this file in `required_docs`; schema migration created the file for audit-clean doc coverage. |
| 2026-06-10 | Iteration 2 source scan | pass | Read `logReducer.ts` (115 lines), `DiscoveryLogPane.tsx` (339 lines), `DossierPane.tsx` (198 lines), `saveLoadService.ts` discovery lines. Confirmed: no retention cap (G1); dedupe only on `LOCATION_DISCOVERY` (G3); unread drift on quest update (G5); quest content append unbounded (G6). Contrast: `geminiInteractionLog` caps at 100, `banterDebugLog` at 50, combat log at 50. |
| 2026-06-19 | G1/G5 implementation proof | pass | Added `MAX_DISCOVERY_LOG_ENTRIES = 200`, add-time prune, load-time prune, and quest unread recount. `npm test -- --run src/state/reducers/__tests__/logReducer.test.ts src/services/__tests__/saveLoadService.test.ts` passed: 2 files, 28 tests. Dependency sync run for `src/state/reducers/logReducer.ts` and `src/services/saveLoadService.ts`. |

## Standing Verification Notes

- Project folder: `docs/projects/logbook`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- North Star last updated date: `2026-06-10`
- G1 implementation complete: `MAX_DISCOVERY_LOG_ENTRIES = 200`, newest-entry retention, retained unread recount, and saveLoadService load prune.
- G5 implementation complete: quest updates recount unread discovery entries after all matching quest entries are refreshed.
- G4 dossier lifecycle policy complete: NPC memory owns retention/aging; dossier UI remains read-only over that state.
