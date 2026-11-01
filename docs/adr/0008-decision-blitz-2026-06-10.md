# ADR 0008 - Decision Blitz 2026-06-10

**Status:** Decisions recorded, propagation in progress
**Date:** 2026-06-10
**Decider:** Remy (project owner), in a batched review session with Claude (Fable 5)
**Scope:** Every pending Required Review Brief / `blocked_human_decision` found across `docs/projects/*` and `docs/tasks/*` on 2026-06-10

This file is the master record. Each decision below must also be recorded in the owning project's `DECISIONS.md` and reflected in its `GAPS.md` / `NORTH_STAR.md` (Required Review Brief marked resolved with date + outcome - append the resolution, do not delete the brief). `PROJECT_TRACKER.md` rows are refreshed separately to reopen the unblocked lanes.

## Context: the June 2026 campaign

Several decisions were made in light of the owner's flagship campaign for 2026-06-10 -> 2026-06-22: a unified procedural world pipeline - Azgaar-based generation extended below Azgaar's deepest zoom to **replace the Submap**, that zoom continuing into a **3D ground-level mode**, **owned town generation** (replacing the closed-source Watabou web dependency), **3D enterable towns** with correct building-vs-entity scale, and an **entity generation pipeline** feeding all layers.

## Campaign-critical decisions

| # | Project / ID | Decision |
|---|---|---|
| D1 | WorldSim Service / WSS-005 | **Azgaar is canonical.** Azgaar feature hints flow into `WorldData`; 3D and gameplay features follow the atlas. The proc-gen pipeline derives deterministically from Azgaar output. |
| D2 | World System / G3 (tile-grid phase-out) | **New canonical world-geography contract + adapters.** Define a new contract aligned with the Azgaar-based pipeline; build explicit adapters for every tile-grid dependency (movement, passability, discovery, save/load/migration, 3D markers) before retiring old fields. |
| D3 | Submap / G5 (replacement surface) | **The new proc-gen submap system is the named replacement.** The in-flight extraction contracts (G7/G8, `submapActionContracts`, DEPENDENCY_CONTRACT.md) are the inventory the new system must honor. |
| D4 | World3D / T7 + W3D-G10 | **Extend the chunk-loader contract with requested LOD tier; use skirt geometry to hide mixed-resolution seams.** T7 lane reopens. |
| D5 | ThreeD Modal (whole project) | **Merge into World 3D UI.** World 3D UI becomes single owner of all 3D entrypoints (modal launch, phase transition, close/focus policy). ThreeD Modal docs become merged-reference. |

## Architecture & runtime ownership

| # | Project / ID | Decision |
|---|---|---|
| D6 | Combat / G30 | **Code Modularization Audit owns the split plan** for `useAbilitySystem.ts` / `useCombatEngine.ts`; Combat contributes required invariants and tests before code movement. Owner rationale: modularization is not Combat's directive. |
| D7 | Layout / G3+G4 and Providers / G5 | **Split the app shell with preservation tests.** Move provider composition out of `App.tsx` into a dedicated app-shell module with explicit tests preserving provider order, `DataLoaderGate`, and `GameProvider` boundaries. `isUIInteractive` stays as a documented compatibility pass-through (wire or retire later - separate decision). |
| D8 | Events / G3+G4 | **Keep the split lanes; document the bridge.** Write an explicit compatibility envelope with `combat_turn` / `world_day` marker documentation. No shared scheduler this cycle. |
| D9 | Command Effects Runtime / G1 | **Command context owns the delegated payload.** Expose a safe delegated-payload source-of-truth in the command context so reactive effects execute through the normal command pipeline. |

## Gameplay semantics

| # | Project / ID | Decision |
|---|---|---|
| D10 | Companions / G6 | **Hysteresis romance exit.** Romance survives temporary approval dips but exits after sustained low approval (threshold + duration to be specified in the implementation slice). |
| D11 | Creatures / G4 | **Keep binary include/exclude targeting; defer hybrid semantics** to a later product/schema decision (docs-only closure this cycle). The campaign's entity pipeline may inform the eventual model. |
| D12 | Religion / G4 | **Rituals owns the backlash contract.** Rituals defines backlash schema and effect math; Religion consumes the normalized result. Rituals consequence tests first, then Religion integration assertions. |
| D13 | Puzzles / PZ-007 | **Approve a dedicated puzzle-facing runtime surface** and wire the first gameplay `getPuzzleHint` caller there with a focused test. |
| D14 | Quest Log / G3 | **Wire the quest-giver bridge now.** Add the NPC quest handoff to `handleNpcInteraction.ts` with focused test coverage. (Owner chose this over deferring for a broader dialogue/quest contract; the bridge implementation should define a minimal quest-offer payload as it goes.) |
| D15 | Party UI / G5 | **Party roster may include non-companion NPCs under an explicit acceptance rule.** The acceptance rule must be defined as the first step of the implementation slice (membership model, sheet context, save/load semantics). Unblocks G7 after the rule is written. |
| D16 | Character Sheet / G7 | **Add durable `acquiredAt` acquisition-timestamp semantics** to the item model, backfill/migrate inventory data, then implement food expiration from that source. |

## Housekeeping & policy

| # | Project / ID | Decision |
|---|---|---|
| D17 | Battle Map / G3 | **Keep the `useBattleMapGeneration.ts` filename**; document the stateless utility contract; revisit rename only when caller churn is planned. |
| D18 | Glossary UI / G3 | **Item metadata stays glossary-local** (display-only schema). Shared ingest/registry schema deferred. |
| D19 | Demo Area / G1 | **Retain `CombatMessagingDemo.tsx` as a reference artifact** (expansion-first; no re-home, no removal). |
| D20 | Scripts: audits / S4 | **Audits stay optional/manual; no CI gates this cycle.** Revisit when audit suite stabilizes. Unblocks CMA-G19 under the manual policy. |
| D21 | Script tests (project) | **Merge into Scripts: quality.** `script-tests` becomes support surface of `docs/projects/scripts-quality`; tracker row becomes merged-reference. |
| D22 | Scripts: spell-runtime-template-audit / SRTA-001 | **Register `Recurring Mechanics` and `Recurring Mechanic Timing` in the strict template vocabulary** with migration notes. |
| D23 | Documentation Cleanup / G3 | **Close as complete-enough.** Duplicate-cleanup scope is not widened; project closes with current evidence preserved. |
| D24 | PHB 2024 Glossary Audit | **Archive as reference-only**; remaining gaps stay routed to Item Categorization and Glossary maintenance. |

## Items converted to work (not decisions)

| Item | Owner | Action |
|---|---|---|
| Crime NORTH_STAR.md corruption | Crime System | Repair the doc surface (remove the embedded build-log/AGENTS.bak corpus material, restore a clean North Star). Queued for the current session window. |
| 3D Combat Map G7 (combat fixture unreachable) | 3d-combat-map | Build a reachable combat fixture (2D-exploration save + dev hook to a battle-map encounter) so G3/NC2 proofs can run. Queued. |
| Character Creator G2 | character-creator | Already resolved 2026-06-08 (permissive navigation). No action; tracker row should drop the review hold. |
| Memory G1 | memory | Sequencing work, not a decision (define canonical NpcMemory shape). Stays an open implementation lane. |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/projects/DECISION_BLITZ_2026-06-10.md","sha256WithoutMarker":"44b96e43dce7f4ebcaf53a5086dfe59ea02b9733ab0b1d65188cfe94455cbeb9","markedAtUtc":"2026-06-25T23:41:49.189Z"} -->
