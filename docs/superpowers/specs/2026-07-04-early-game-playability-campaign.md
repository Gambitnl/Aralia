# Early-Game Playability Campaign

**Date:** 2026-07-04
**Goal:** Make the early game genuinely playable — the stretch from "character creation finishes and a starting town is chosen" through the first several hours of play. A freshly-made character should enter a living D&D world, use the full richness of levels 1–3, find companions, be immersed and travel to real places, and shop for goods with logical inventories and pricing.

## Diagnosis (from a five-pillar live-code audit, 2026-07-04)

The engines are built; the spine connecting them to play is missing or severed. What works: the new-game handoff (spawn on land, in the chosen town, in 3D with an AI opening), the travel loop (routes, time, provisioning), the 5e rules math (attacks, saves, crits, death saves, rest), the recruit machinery, and a PHB-accurate item catalog. What's broken is listed per workstream below.

## Decisions (confirmed with Remy, 2026-07-04)

1. **Build order: top-down.** Make the D&D core hold up first (character → combat that persists → real leveling to 3), then shopping, then world richness, then companions.
2. **3D interaction: make it real.** The player should inhabit the 3D world they're standing in — click-to-talk on NPCs and character locomotion — not observe a diorama while every verb hides in a separate 2D screen. This work lands primarily in Workstream 5.

## Workstreams

Each workstream is its own spec → plan → build → verify cycle. Ordered by the decision above.

### WS1 — Your character is real & equipped  ✅ DONE 2026-07-04 (tests + typecheck green; live eyeball pending)
Built: `src/systems/character/buildStartingLoadout.ts` (pure, 11 tests), `src/data/classes/startingEquipment.ts` (2024 PHB packages), `src/data/items/adventuringGear.ts` (packs/focuses/spellbook/ammo/kits). Wired into `assemblePlayerCharacter` + `START_GAME_SUCCESS`. Also fixed a game-wide bug where the ingested glossary stripped mechanical fields off authored armor (re-assert authored weapons + armor after the glossary in `data/items/index.ts`).

The player-facing creator (`assemblePlayerCharacter` / `assembleAndSubmitCharacter`, `useCharacterAssembly.ts`) grants only mastery weapons + rations + water, `equippedItems: {}`, AC = 10 + Dex, and gold is hardcoded to 10 in `START_GAME_SUCCESS`. No armor for anyone; casters without a mastery weapon start unarmed; background equipment (including a shown-but-never-granted 15 gp) is dropped.
- Add 2024-PHB class starting-equipment packages (new bounded table keyed by class id; item ids + quantities + which are equipped + coin).
- Grant background equipment: resolve catalog item ids, convert `N_gp` tokens to gold, create lightweight items for unmapped flavor pieces (no silent drops).
- Equip armor + shield into `equippedItems`, recompute AC via the existing `calculateArmorClass`.
- Thread real starting gold (class package coin + background coin) into `START_GAME_SUCCESS` instead of the flat 10.
- Reconciled: `characterGenerator.ts` (grants kits) is the NPC/companion/encounter service, NOT the player path — leave it.

### WS2 — Fights that stick  ✅ DONE 2026-07-04 (tests + typecheck green; live eyeball pending)
Shipped: combat attrition persistence (`CombatPartySnapshotEntry` snapshot through `onBattleEnd`→`END_BATTLE`, reducer maps HP/slots/uses back by id, attrition-before-XP, downed→1, maxHp clamp; 5 reducer tests), CR-based XP (`xpForChallengeRating.ts`), initiative Dex double-count fix, finesse attack (max Str/Dex, case-insensitive) + sneak-attack case fix. Deferred: finesse *damage* (Str-only via the `value:0` weapon-damage runtime path).

Combat runs on transient copies; `END_BATTLE` applies only XP/gold/items, so HP lost, spell slots spent, and limited uses burned all silently reset after every battle. XP is a flat 50/enemy placeholder. Initiative double-counts Dex for players; finesse weapons ignored (melee always Str).
- Persist post-combat HP, spell-slot expenditure, and limited-use consumption back to the party.
- CR-driven XP award.
- Fix initiative Dex double-count and finesse weapon selection.

### WS3 — Grow to level 3
Spell slots are hardcoded at creation and never grow — a level-3 caster can never cast a 2nd-level spell despite 65 being implemented. Level-up grants no class features, no new spells, and no subclass at 3. No out-of-combat casting UI dispatches `CAST_SPELL`.
- Spell-slot progression table (by class + level, 1→3).
- Class features per level; subclass selection at level 3.
- New spells-known/prepared on level-up.
- Out-of-combat casting entry point (Cure Wounds between fights, Guidance before a check, etc.).

### WS4 — Shopping that works and makes sense  ⚙️ CORE DONE 2026-07-04 (buy/sell functional; enhancements remain)
Fixed: buy/sell payload no-op (`MerchantModal` now emits the transaction-wrapped shape the handler consumes) + stack-giveaway exploit (buy = 1 unit). 4 tests. Remaining: building-derived shop type, arrival-time merchant registration (2D reachability), double-pricing, merchantId/stock-depletion threading.

Every Buy/Sell click is a silent no-op (payload-shape mismatch, `MerchantModal` flat `{item,cost}` vs handler's `payload.transaction.buy/.sell`) since late May. Shop type is assigned semi-randomly (a blacksmith building can back a tavern business). Shops are unreachable without a 3D town entry. Latent stack-giveaway and double-pricing bugs sit behind the broken buy button.
- Fix the buy/sell payload path (and thread `merchantId`).
- Derive shop type from the building/profession, not a length-seeded RNG.
- Register town merchants on arrival (2D travel), not only on 3D entry.
- Fix stacked-quantity giveaway and double-pricing; wire or remove haggle UI.

### WS5 — A world worth traveling (+ interactive 3D)
Arrivals read as "Grassland sector (cell 1880)" / "Traveled to a new place." Towns reached by map-travel are empty shells. Travel "encounters" print a threat but never start a fight. Discovered ruins/caves are pins with nothing behind them. The 3D world has no click-to-talk and no locomotion.
- Resolve burg names on arrival; auto-narrate arrival via the existing `look_around` pipeline.
- Wire the travel-encounter roll to the real battle-map handoff.
- Populate town NPCs/merchants on arrival.
- Surface living-world output (a headline/gossip on arrival, not only on real-time idle).
- **Interactive 3D:** click-to-talk on NPCs + character walk controls (per decision 2).
- Give at least one discovered-place type real content (enter / loot / encounter).

### WS6 — Companions you can find
The two authored, richly-written companions (Kaelen, Elara) are seeded into state but placed nowhere in the world and unreachable. Recruited townsfolk are personality-blank (generated personality discarded, race hardcoded). Consent thresholds make a day-one "yes" nearly impossible with no progress feedback. "Paid hire" deducts no gold. The rescue-to-recruit trigger has no production caller. Encounter balance ignores recruits (stale `tempParty`). Static-NPC invite leaks raw ids.
- Place Kaelen & Elara in the starting town and wire the promote path.
- Preserve generated personality/race when converting a recruited NPC.
- Surface consent progress; make paid hire cost gold; wire the rescue trigger.
- Fix `tempParty` staleness and the raw-id invite leak.

## Cross-cutting correctness bugs (fold into the nearest workstream)
- `HEAL_CHARACTER` has no reducer — temple healing is inert (WS2/WS3).
- Dialogue skill checks bypass the real check engine (raw Cha mod only) (WS5/WS3).
- Opening situation hard-depends on Ollama with no actionable floor when it's down (WS5).

## Verification standard
Per Remy's visual-inspection rule: every slice that changes something observable gets rendered and eyeballed in a running app (or a deterministic in-page replay for 3D), not just unit tests.
