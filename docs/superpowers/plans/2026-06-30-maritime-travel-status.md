# Maritime Travel — Consolidated Status (2026-06-30 audit)

**Why this doc exists:** the spec (`docs/superpowers/specs/2026-06-25-maritime-travel-design.md`)
describes 6 subsystems "all in v1," later re-scoped into Plans 3–6 after a 2026-06-26
interview (see its "Iteration II"). Only **Plan 3** (naval bridge) ever got a written plan
file. Plans 1–2 were referenced as a prereq ("Plans 1–2 built") but never had their own
plan doc. Plans 4–6 are described in prose in the spec but have no plan file. This doc is
the single place that says what's actually true on disk right now, cross-checked against
both the project memory note `maritime-travel-status.md` and the source directly (an
earlier pass of this audit mis-grepped and wrongly concluded Plan 3C was missing — it
isn't; corrected below).

## What's actually built (verified against source, 2026-06-30)

| Piece | Spec subsystem | State |
|---|---|---|
| `ensureIslandHarbors.ts` — every significant landmass gets a port | 2 | **Built, committed.** Default-off (`options.ensureIslandHarbors`) — not active in real games yet; deliberate gate, not a gap. |
| `multiModalAtlasGraph.ts` — unified land+sea+port-transfer graph | 1 | **Built.** Ferry = lane-only (`isFerryWater`). |
| `routePlanning.ts` `edgeMinutes` hook | 1 | **Built**, land graphs unchanged (regression-safe). |
| `multiModalRoute.ts` + `formatMultiModalSummary` | 6 | **Built**, mojibake fixed. |
| **Plan 3A** — ship passability over ANY sea cell + danger tiers (lane/coastal/open) | re-scoped 1 | **Built** — `SEA_DANGER_COASTAL`/`SEA_DANGER_OPEN` + `opts.sea.kind === 'ship'` passability in `multiModalAtlasGraph.ts`. |
| **Plan 3B** — `knownPorts` populated from FMG burgs, docked-port bridge | naval bridge | **Built** — `useKnownPortsSync.ts`, `knownPorts.ts`, `navalReducer.ts` `NAVAL_SET_KNOWN_PORTS`. |
| **Plan 3C-1** — ShipPane voyage tab + "advance a day" | voyage UX | **Built** — `ShipPane.tsx` `voyage`/`onAdvanceDay` props, wired in `GameModals.tsx`. |
| **Plan 3C-2** — knownPorts population effect | voyage UX | **Built** — `useKnownPortsSync.ts`. |
| **Plan 3C-3** — map embark + set sail | voyage UX | **Built** — `shipEmbark.ts` (`shipTravelAvailability`, `shipVoyageFromDestination`), `MapPane.tsx` `seaPref === 'ship'` branch calls `onSetSail`. |
| **Plan 3C-4** — voyage arrival relocates the player | voyage UX | **Built** — `useVoyageArrival.ts`, `NAVAL_CLEAR_VOYAGE`. |
| `navalReducer` wired into `appReducer` | critical fix | **Built (2026-06-29)** — was previously a silent no-op in production; now runs in the pipeline (`appState.naval.test.ts` guards against re-unwiring). |
| `NAVAL_PURCHASE_STARTER_SHIP` (in-game ship acquisition) | acquisition gap | **Built (2026-06-29)** — 500gp gold-gated purchase button in GameModals' empty state. |

The full owned-ship lifecycle — embark → sail day-by-day → arrive & relocate — **closes
end to end**. This is further along than the spec/Plan 3 files' own headers suggest (they
still read "in progress").

## What's NOT built

| Piece | Spec subsystem | Plan | State |
|---|---|---|---|
| **Sea-danger encounter roll for owned-ship voyages** (Plan 3D) | 5 | Plan 3, subtask 3D | **BUILT 2026-07-05.** Per-day-at-sea seeded roll, danger-scaled by the route's aggregate sea-danger (Plan 3A lane/coastal/open tiers, threaded onto the voyage at embark). Mirrors the land road-ambush architecture: `src/systems/naval/seaEncounter.ts` (pure roll + 5-entry table: pirates, sea beast, drifting wreck/salvage, merchant vessel, squall) → `navalReducer` `NAVAL_ADVANCE_VOYAGE` (rolls once per non-arrival day, writes voyage log + adventure log, applies salvage gold via the existing store) → hostile outcomes set `naval.pendingSeaEncounter`, consumed by `useSeaEncounter` which hands the foes to the SAME `handleStartBattleMapEncounter` placeless battle-map flow land ambushes use. Deterministic per (worldSeed, ship, destination, day); save-safe (`routeDanger?`/`pendingSeaEncounter?` optional, default calm). Tests: `seaEncounter.test.ts` (8), `navalReducer.test.ts` sea block (+7), `useSeaEncounter.test.tsx` (3), `shipEmbark.test.ts` danger thread. Visual proof: `.agent/scratch/sea-encounter.png`. **Peaceful=narrative/log+salvage; hostile=combat.** |
| **Plan 4** — dock tiers + tender legs (oversized ship at a small dock anchors offshore) | 3 | none written | **Not started.** No `dockTiers.ts`, no `dockClass`/`dockSize` fields found. |
| **Plan 5** — ferry fares + later living-ferry-economy | 4 | none written | **Not started.** No `ferryFare.ts`. |
| **Plan 6** — weather/seasons surfaced on the map, piracy as playable encounters | 5 (extended) | none written | **Not started** beyond the dormant naval sim's own weather model, which isn't yet fed by 3A's sea-danger tiers. |
| Visual proof (mainland→island trip, ferry route + owned-ship open-water route, eyeballed per the visual-inspection rule) | — | Plan 3 | **Status unconfirmed by this audit** — not verified either way; check before assuming it's been done. |
| Carry-your-own-craft embarkation, ferry schedules, ship upkeep economy, naval combat | — | — | Explicitly out of scope / deferred since the original spec — still deferred, not a gap. |

## Recommended next step

Plan 3D (sea-encounter roll) **landed 2026-07-05** with a deterministic proof
(`.agent/scratch/sea-encounter.png`). The owned-ship lifecycle is now
functionally complete end to end. Remaining maritime work:

- **In-app visual eyeball** of a real mainland→island voyage that fires a live
  battle-map fight (the reducer + headless proof are done; a driven in-browser
  playthrough capture is still worth doing).
- **Plans 4–6** — dock tiers + tender legs (Plan 4), ferry fares (Plan 5),
  weather/seasons surfaced on the map + piracy depth (Plan 6). Genuinely
  unstarted backlog; keep deferred per the risk-ordered build convention.
- **Tuning pass** on `PER_DAY_AT_MAX_DANGER` (0.12) + the 5-entry table once
  playtested against real voyage lengths.

## Doc hygiene follow-up

`docs/superpowers/specs/2026-06-25-maritime-travel-design.md` and
`docs/superpowers/plans/2026-06-26-maritime-travel-plan3-naval-bridge.md` both still
carry their original "in progress" / "holding" status lines from 2026-06-25/26 — stale
relative to the 2026-06-29 work. Both now point here for current state; consider
updating their headers directly the next time either is touched for real work.
