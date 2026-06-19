# World Decisions

Status: active
Last updated: 2026-06-18

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/world`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-09`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Tile-grid phase-out contract — new canonical world-geography contract + adapters (G3)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The G3 Required Review Brief asked whether tile-grid `MapData` stays the canonical gameplay compatibility layer with new renderers adapting around it (Option A), or whether a new canonical world-geography contract is promoted with an explicit migration/adapter layer before old fields are retired (Option B).

Decision made:
Option B — **promote a new canonical world-geography contract and create explicit adapters for every tile-grid dependency before retiring old fields.** The new contract aligns with the Azgaar-based proc-gen pipeline (Azgaar is canonical per WorldSim Service decision D1 of the same session). Required adapter coverage: movement, passability, discovery/current-tile markers, save/load/migration compatibility, and 3D marker anchors. No tile-grid field is removed until its dependency has a verified adapter.

Rationale and evidence:
- Decided in the June 2026 proc-gen campaign context (Azgaar-based generation replacing the Submap and feeding 3D); keeping tile-grid canonical would anchor the new pipeline to the legacy renderer's data shape.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D2; campaign context in the Context section).
- Brief and gap: `docs/projects/world/NORTH_STAR.md` Required Review Brief; `docs/projects/world/GAPS.md` G3.

Follow-up:
Write the contract preservation table (every tile-grid dependency mapped to its adapter), define the new canonical world-geography contract, build the adapters, then run the focused startup/load/movement verification (passability, current/discovered markers, migration, 3D marker anchors) before retiring any old field. T2/T4 in `TRACKER.md` carry this lane.

### D3: World owns the geography contract; Travel and Submap keep their execution lanes

Date: 2026-06-18

Owner: Codex application agent (GPT-5), T2 gap pass

Decision point:
The same tile-grid retirement theme appears in World G3, Global Gap GG-29, Travel cell-native movement gaps, and Submap retirement docs. Without a seam, a World iteration could absorb Travel pathfinding/discovery or Submap UI retirement work.

Decision made:
World owns the canonical world-geography contract and adapter definitions for movement, passability, discovery/current markers, startup/load, migration, and 3D anchors. Travel owns cell-native movement/pathfinding execution. Submap owns Submap/grid UI retirement and unmounting. World may record dependencies on those projects, but it should route their implementation work rather than duplicating it.

Rationale and evidence:
- `docs/projects/world/TRACKER.md` T4 now carries the contract preservation table.
- `docs/projects/GLOBAL_GAPS.md` GG-29 names final `MapData.tiles` retirement as a cross-project seam.
- `docs/projects/travel/GAPS.md` owns cell-native travel gaps imported from GG-28.
- `docs/projects/submap/NORTH_STAR.md` owns Submap and tile-grid surface retirement.

Follow-up:
Keep G11 open until the tracker/gap surfaces agree on the owner split and the World adapter design has explicit handoff points for Travel and Submap consumers.

### D4: G6 schedule/proximity TODOs are routed owner seams, not a World implementation slice

Date: 2026-06-18

Owner: Codex application agent (GPT-5), T15 boundary audit

Decision point:
World G6 grouped several TODOs near movement and long-rest world events: forced-march exhaustion, NPC routines and faction schedules, long-rest memory/social maintenance, and settlement proximity-triggered town-description loading. The question was whether World should implement a small runtime slice or route the parts to existing owner projects.

Decision made:
Close World G6 as routed. World keeps the current long-rest residue, memory decay/pruning/drift, and gossip sequence, but does not absorb sibling owner behavior. Forced march runtime application belongs to Travel; scheduler/marker policy belongs to Events; action-to-memory coverage belongs to Memory; proximity-triggered town-description loading belongs to Town Description.

Rationale and evidence:
- `src/hooks/actions/handleResourceActions.ts` already calls `handleResidueChecks`, `handleLongRestWorldEvents`, and `handleGossipEvent` during long rest.
- `src/hooks/actions/handleWorldEvents.ts` keeps long-rest memory maintenance local and pure.
- `docs/projects/travel/GAPS.md` G1 already owns forced march application from `TravelCalculations.ts` into movement flow.
- `docs/projects/events/GAPS.md` G3-G4 already own the no-shared-scheduler decision and the `combat_turn` / `world_day` marker compatibility envelope.
- `docs/projects/memory/GAPS.md` G4 already owns the broader action-to-memory coverage matrix.
- `docs/projects/town-description-system/GAPS.md` G5 now carries the inbound proximity-loading stub.

Follow-up:
Continue World with G7 deterministic daily-world event IDs. Do not reopen G6 in World unless Travel, Events, Memory, or Town Description hands back a specific World-owned contract slice.

### D5: Deterministic daily-world IDs are normalized at the WorldEventManager boundary

Date: 2026-06-18

Owner: Codex application agent (GPT-5), T16 implementation pass

Decision point:
G7 asked whether replayable daily-world simulation needs deterministic event/log IDs. The implementation had `Date.now()` inside `WorldEventManager`, and some downstream daily subsystems returned wall-clock IDs through the same daily result envelope.

Decision made:
World-owned daily logs must be deterministic for identical saved game time and world seed. `WorldEventManager` now derives its own log IDs from saved game time and normalizes the complete returned daily log envelope at the manager boundary. Sibling subsystem internals are not rewritten in this World slice.

Rationale and evidence:
- `src/systems/world/__tests__/WorldEventManager.test.ts` first failed when two identical seeded runs used different mocked `Date.now()` values.
- `src/systems/world/WorldEventManager.ts` now creates deterministic World log IDs and rewrites returned daily log IDs in a stable order before returning.
- This preserves event selection and avoids absorbing economy, quest, intrigue, and crime ID-policy cleanup into the World project.

Follow-up:
Close G7 for World. Route deeper subsystem-specific ID policy cleanup to owning projects only if a future slice proves those IDs matter outside the World daily result envelope.
