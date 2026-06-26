# Crime System Audit / Proof

Status: complete_for_current_gap_set
Last updated: 2026-06-25

Use this file for durable proof summaries, scoped verification notes, and acceptance evidence. Do not paste raw logs unless a short excerpt is required for later agents to understand the result.

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-25 | G6 suspect/report aggregate decision | pass | Source scan found no Crime-owned suspect/report aggregate or caller: `Crime` carries `witnessed`, `NotorietyState.knownCrimes` stores committed crimes, and `crimeReducer.ts` emits the current witnessed/unwitnessed player messages. Report terms found in business/economy are unrelated, and memory witness/source fields are not Crime report callers. Decision: do not add canonical suspect/report outcome types until a guard, memory, faction, or UI lane needs structured reports. |
| 2026-06-25 | G5 TODO/type-debt classification | pass | `HeistManager.startPlanning` now accepts `Pick<Location, 'id'>`, `HeistManager.addIntel` accepts `HeistIntel`, and `crimeReducer.ts` no longer casts the heist planning location or active heist through `any`. Remaining Crime TODOs are classified in `GAPS.md`: `CrimeSystem`, `SmugglingSystem`, and orphaned `FenceSystem` markers are preserved future scaffolds, while `appState.ts` root-reducer markers are out of Crime scope. `npm run test -- src/systems/crime/__tests__/HeistManager.test.ts src/state/reducers/__tests__/crimeReducer.heist.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed 19/19 tests. |
| 2026-06-25 | G4 heat/severity unit boundary | pass | Added `CrimeSystem.normalizeSeverity` and `CrimeSystem.calculateCrimeHeat`, then routed `COMMIT_CRIME` through those helpers. Accepted scale: legacy severity 1-10 maps to canonical 10-100, canonical severity clamps at 0-100, max witnessed crimes add +20 local heat, and max unwitnessed crimes add +10. TDD proof: tests first failed for missing helpers/old +25 witnessed heat, then `npm exec vitest run src/systems/crime/__tests__/CrimeSystem.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed 15/15 tests. Dependency sync was rerun for `src/systems/crime/CrimeSystem.ts` and `src/state/reducers/crimeReducer.ts`. |
| 2026-06-25 | G3 criminal market utility ownership | pass | `BlackMarketSystem.ts` and `fencing/FenceSystem.ts` dependency headers were refreshed and still report no product dependents. `rg` found only tests, generated architecture docs, and Crime project docs as direct references. Decision: preserve both utilities as tested future scaffolds, not active caller behavior. `npm exec vitest run src/systems/crime/__tests__/BlackMarketSystem.test.ts src/systems/crime/fencing/__tests__/FenceSystem.test.ts` passed 10/10 tests. |
| 2026-06-25 | G2 fence outcome contract | pass | `FenceInterface.tsx` now dispatches `SELL_FENCED_ITEM` instead of generic `SELL_ITEM`; `characterReducer.ts` removes the item and pays gold; `crimeReducer.ts` raises local/global heat without adding a formal witnessed-crime entry. `npm exec vitest run src/state/reducers/__tests__/characterReducer.test.ts src/state/reducers/__tests__/crimeReducer.test.ts src/systems/crime/__tests__/CrimeSystem.test.ts` passed 28/28 tests. Dependency sync was rerun for `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts`, and `src/state/reducers/crimeReducer.ts`. |
| 2026-06-25 | G1 expired-bounty cleanup | pass | `CrimeSystem.generateBounty` now sets expiration from the in-game crime timestamp, `CrimeSystem.pruneExpiredBounties` removes expired timed bounties, and `crimeReducer` runs the cleanup during `ADVANCE_TIME` after world time advances. `npm exec vitest run src/systems/crime/__tests__/CrimeSystem.test.ts src/state/reducers/__tests__/crimeReducer.test.ts` passed 11/11 tests. Dependency sync was rerun for `src/systems/crime/CrimeSystem.ts`. |
| 2026-06-10 | Required-doc surface initialized | pass | `docs/projects/crime/NORTH_STAR.md` declares this file in `required_docs`; schema migration created the file for audit-clean doc coverage. |

## Standing Verification Notes

- Project folder: `docs/projects/crime`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- North Star last updated date during initialization: `not recorded`
- G1 implementation complete: timed bounties use game-time expiration and prune during `ADVANCE_TIME`.
- G2 implementation complete: fence sales use `SELL_FENCED_ITEM` and create crime heat.
- G3 ownership complete: orphaned market utilities are preserved as tested future scaffolds.
- G4 implementation complete: heat/severity units are centralized in `CrimeSystem`.
- G5 implementation/classification complete: heist typing tightened; remaining scaffold markers have explicit owner/action notes.
- G6 decision complete: suspect/report aggregate types are intentionally deferred until an active caller needs them.
- Next proof required: fresh Crime source scan before assigning more Crime work.
