# Absorbed: Town runtime (docs/projects/town)

Status: active reference — absorbed into planmap topic `shipped-styled-town` on
2026-07-15. The living-project folder was deleted (git history is the archive). This
covers the LEGACY 2D town runtime surface (`GamePhase.VILLAGE_VIEW`), not the canonical
Worldforge town generator.

## Surface map

- `src/components/Town/TownCanvas.tsx` — the active render surface; `src/App.tsx`
  lazy-loads it. `src/components/Town/VillageScene.tsx` remains exported and tested but
  is not routed to (ownership decision open, gap G4).
- Entry path: the action contract has `ENTER_TOWN`, but the live overworld path uses
  `ENTER_VILLAGE` plus direct phase switching in `src/hooks/actions/handleMovement.ts`
  (gap G2 — pick one canonical entry action before expanding transitions).
- `determineSettlementInfo(...)` is computed in `App.tsx` but never consumed by the
  TownCanvas flow (gap G3); settlement personality data
  (`src/data/villagePersonalityProfiles.ts`, `src/utils/world/settlementGeneration.ts`)
  exists but does not adjust render rules.
- City-state/cultural metadata ownership between Town runtime state and
  town-description-system / world contracts is undecided (gap G1).

## Boundaries

Town-description persistence belongs to the town-description-system lane; world-level
contracts belong to the world lane. The six absorbed gaps (G1-G6) live as step
features on the `shipped-styled-town` planmap topic.
