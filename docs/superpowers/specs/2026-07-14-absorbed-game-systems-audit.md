# Absorbed project: game-systems-audit (docs/projects/game-systems-audit)

Absorbed into planmap topic `whole-game-systems-audit` on 2026-07-15 (wave
10R). The folder is deleted; git history is the archive. This campaign is
ACTIVE (codex-game-systems-audit, pass started 2026-07-11): this doc is now
its runbook + coverage ledger. Continue the campaign planmap-first — the
topic's features are the wave/item rows.

## Why the campaign exists

Green tests or a project card do not prove a player can use systems together.
This campaign establishes current runtime evidence for every game system and
player-facing surface, registers every discovered gap with its real owner,
mirrors actionable work into planmap, and drives gaps to verified resolution.
Expansion-first: never reduce the game to a small "supported" subset, delete
unfinished branches, or redefine success around the easiest flows.

Completion test: every inventory row has current source/test/runtime/visual
evidence; every issue registered once with its owner; every actionable issue
has a planmap tile; every resolvable gap verified in the running game; a
final whole-game pass finds no unregistered gaps.

## Standing decisions

- D1: Existing living projects (now their planmap topics) retain product
  ownership; this campaign owns coverage, routing, and planmap sync.
- D2: Every confirmed actionable issue gets a linked planmap feature or topic
  in the same pass.
- D3: Runtime proof is required — source and tests alone cannot verify a
  reachable player surface (the opening pass found a pointer obstruction no
  test exposed).

## Runbook (per wave)

1. Pick the highest-priority incomplete wave (see wave ledger below).
2. Expand it into item-level inventory rows before review, so surfaces cannot
   silently disappear from scope.
3. Read each owning topic (and its absorbed spec) before reviewing runtime.
4. Exercise success, failure, cancel/back, invalid-data, persistence,
   keyboard, and dependency-down paths per item.
5. Inspect rendered output and browser console/network state.
6. Lock `public/planmap/topics.json`; register findings as features on the
   owner topic (or a narrow new topic) via `tools/agora/planmap-add.mjs`.
7. Mark planmap `done` only after proof; keep statuses synchronized
   (`parked` unresolved ownership/external decision, `specced` acceptance
   proof defined, `active` implementing, `done` verified).
8. Validate: `node tools/agora/validate-planmap.mjs`; focused tests; focused
   rendered browser inspection. Disposable captures go in `.agent/scratch/`.

Review dimensions each wave: behavior, integration, UX, accessibility, data
integrity, persistence, performance, error states, verification quality.

## Coverage baseline (2026-07-11 setup)

84 living-project folders (now absorbed into planmap), 24 architecture
domains (`docs/architecture/domains/*.md`), 16 top-level `GamePhase` branches
(`src/App.tsx`), 38 lazy modal/overlay surfaces
(`src/components/layout/GameModals.tsx`), 79 planmap topics at baseline.

## Wave ledger

| Wave | Scope | Status | Next proof |
|---|---|---|---|
| W01 Onboarding and persistence | Main menu; character creator; start town; load; saves; autosave; resume; abandon; game over; not-found | verified 2026-07-11 (all 12 item rows have current proof; 8 discovered owner gaps registered and resolved) | Preserve regressions while later waves reuse the verified run boundary |
| W02 World and exploration | Classic/Worldforge atlas; submaps; town plan; movement; discovery; action/compass | in_review | Finish cardinal/out-of-bounds, Submap, command, and 3D geography-return branches |
| W03 Town, social, and quests | Town; conversation; dialogue; companions; party; quests; journal | not_reviewed | NPC-to-quest-to-journal loop |
| W04 Combat and tactical play | Encounter; combat; maps; dice; commands; visibility; rewards; defeat | not_reviewed | Threat-to-aftermath battle |
| W05 Character mechanics and progression | Sheet; races/classes; spells; conditions; proficiency; equipment; leveling | not_reviewed | Creation-to-runtime mechanic traces |
| W06 Items, economy, and crafting | Inventory; merchants; trade; economy; investment; crafting | not_reviewed | Earn/buy/equip/craft/sell/persist |
| W07 Factions, crime, and faith | Intrigue; crime; guilds; organizations; religion; rituals | not_reviewed | Consequence-bearing loops |
| W08 Extended travel and realms | Naval; sea encounters; planar; Underdark; RealmSmith | not_reviewed | Departure-to-arrival loop |
| W09 Simulation, time, and environment | Time; events; history; environment; physics; simulation | not_reviewed | Deterministic before/after plus reload |
| W10 3D and rendering | World 3D; transitions; WebGPU; 3D combat; failure modes | not_reviewed | Enter/interact/exit plus GPU failure |
| W11 Information and UI | Glossary; guide; logs; modals; accessibility; previews | not_reviewed | Keyboard/accessibility modal matrix |
| W12 Services and closure | Ollama; Gemini; loaders; offline/error; performance; final sweep | not_reviewed | Failure injection and closure audit |

Waves route findings into owner topics: W03 → town/conversation-panel/
dialogue/companions/party-ui/quests/quest-log/logbook; W04 → combat/
battle-map/3d-combat-map/dice/encounter-generator/command runtimes/
visibility; W05 → character-sheet/racial-mechanics/spells/creatures/
item_categorization; W06 → trade-ui/economy-player-surface/crafting/
crafting-ui; W07 → intrigue/crime/crime-ui/organization/religion/rituals;
W08 → naval/naval-ui/planar/underdark/realmsmith-service; W09 → time/events/
history/environment/physics/worldsim-service; W10 → world3d/world-3d-ui/
three-d-modal/3d-combat-map/worldforge; W11 → glossary-ui/ui-primitives/
design-preview/design-preview-scenarios/types-ui; W12 → service projects,
testing overhaul, audit tooling.

## W02 item state (the active wave, as of 2026-07-11)

Verified: world-generation run lock (WF-G10); canonical atlas initial render;
Classic keyboard/touch travel (WF-G12); cell-native travel target/marker
(Travel G6/G9/G19/G20); discovery persistence + journal handoff (Travel G7);
World3D sparse + dense-town performance (W3D-G29 0.61→32.55 FPS, W3D-G30
8.12→33.12 FPS).

In review: atlas pan/zoom/layer/reset (drag-pan, lost-map recovery, overlay
tint matrix, Classic parity remain); cell inspection (full
culture/polity/religion/burg matrix remains); route planning readout
(owned-ship and cancel breadth remain); movement execution
(cardinal/out-of-bounds remain); town/local/ground descent
(town-plan/ground + reload remain); exploration persistence (active
route/transport + legacy migration remain).

Not reviewed: compass exploration commands; dynamic Action Pane exploration
commands; legacy Submap open/close boundary; legacy Submap
movement/inspection; Enter-3D geography handoff; atlas/Submap
dependency-down and malformed-data recovery.

W02 preserves both sides of the migration: Worldforge is the cell-native
direction; legacy grid/Submap contracts stay in coverage until their
retirement projects prove safe replacement.

## Proof ledger highlights (full ledger in git history of the folder)

All W01 rows proven 2026-07-11 (browser journeys, 42-test save/load matrix,
autosave tier fake-clock proof, three full manual-creation runs, terminal
recovery routing). W02 proofs 2026-07-11: dependency-down opening retry,
3D-HUD hit-target fix, canonical Worldforge surface (seed
`aralia-1783789990974`, 758 burgs), keyboard descent to Cell #26, World3D
performance recoveries, hostile-route encounter handoffs (Wolf at 2761,
two-Bandit at halt 2371), ferry water-rejection and honest transport.
