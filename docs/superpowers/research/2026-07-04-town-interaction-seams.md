# Town interaction seams — why wf towns are inert (2026-07-04)

**The answer up front:** every system a town interaction needs already exists — the shop modal, the buy/sell reducer, the recruit consent gate, registered business owners with names and shops. None of them are wired to anything the player can reach at a Worldforge town. Grid retirement deleted the old village-screen triggers without rebuilding cell-native ones. Three of the four gaps are pure wiring; the fourth (real priced inventories on businesses) is a small data-model addition because businesses today simulate money but own no goods.

## 1. The shop UI exists but has no live trigger

- The shop screen is `src/components/Trade/MerchantModal.tsx`, opened by the `OPEN_MERCHANT` action (`src/state/reducers/uiReducer.ts:303-314` sets `merchantModal.isOpen`).
- The producer flow is `handleOpenDynamicMerchant` (`src/hooks/actions/handleMerchantInteraction.ts:154-291`): it generates/reuses a merchant NPC per `buildingId`, registers an NPC + business (lines 194-204), asks Gemini for an inventory (line 239, `generateMerchantInventory`), then dispatches `OPEN_MERCHANT` (line 277). Buy/sell run through `validateMerchantTransaction` (line 120) → `BUY_ITEM`/`SELL_ITEM` (lines 442/456), with haggling and economy-event price modifiers already working.
- **Nothing in live UI dispatches `OPEN_DYNAMIC_MERCHANT`.** A grep across `src/components` finds no producer except the debug menu. The old producers were the retired 2D Village screen — `src/components/ActionPane/useActionGeneration.ts:74-76` says so outright: "the legacy 2D village view is retired, so the 'Enter Town' / 'Scout Town' actions that routed into it are gone."
- It never fires at a wf town because there is no condition to fail: the code path is orphaned. Locations have no type field anymore; a wf town is identified by `playerCell.cellId` + `resolveTownForLocation` (`useActionGeneration.ts:100-106`), which today gates only the Notice Board / Broadsheet actions.

Meanwhile the town's shops DO exist in state: `World3DWrapper.tsx:247-310` walks each town plan's market/workshop plots and registers `npc_burg_<burg>_plot_<plot>` merchants (`REGISTER_GENERATED_NPC`, line 302) and `biz_burg_<burg>_plot_<plot>` businesses (`REGISTER_WORLD_BUSINESS`, line 305), with roster-derived owner names (line 271-272). They are simply never surfaced.

## 2. Talk targets: only the opening strangers, plus the player himself

The "Talk to X" list is built in two steps:

- `App.tsx:373-398` `getCurrentNPCs()`: static `location.npcIds` (authored table) plus `currentLocationActiveDynamicNpcIds` resolved through `NPCS` / `generatedNpcs`.
- `useActionGeneration.ts:48-50` emits one `Talk to ${npc.name}` action per entry, unfiltered.

`currentLocationActiveDynamicNpcIds` is only ever populated by:
- `PLACE_SITUATION_NPCS` (`src/state/reducers/gameEntryReducer.ts:77-120`) — the LLM opening strangers, and
- `MOVE_PLAYER` → `determineActiveDynamicNpcsForLocation(locationId, LOCATIONS)` (`src/state/appState.ts:714`) — static authored locations only.

`REGISTER_GENERATED_NPC` (`src/state/reducers/npcReducer.ts:186-211`) stores the NPC and seeds memory but **never adds it to the active list**. Nothing reads the town roster (`generateTownRoster`, `World3DWrapper.tsx:256`) or `worldBusinesses` when building talk targets. That is the entire gap: the registered shopkeepers and roster townsfolk sit in state, invisible to the action pane. The fix point is `getCurrentNPCs()` (or a reducer step on town entry) pulling the current cell's `npc_burg_*` merchants and a handful of roster occupants into the active list, keyed the same way `resolveTownForLocation` already keys off `playerCell.cellId`.

**"Talk to Ivor Eldridge" (the player) bug:** the opening-situation model is given the player's name in the prompt (`src/systems/gameEntry/generateOpeningSituation.ts:73`) and asked for 1-3 strangers ("not the player's allies", line 95) — but the parser (`mapRawSituation`, lines 279-336, filter at 288 checks only for a non-empty name) and the placer (`situationNpcsToRichNpcs` → `PLACE_SITUATION_NPCS`, `useOpeningSituation.ts:170-171`) never compare returned NPC names/ids against the party. When the model echoes the player back as a stranger, he becomes a normal talk target. Fix: filter `situation.npcs` against party member names/ids before placement.

## 3. Recruiting: the pipeline is complete, both doors to it are dead

Built and tested:
- Consent gate: `evaluateRecruitOffer` (`src/systems/party/recruitConsent.ts:138-200`) — relationship/disposition-gated verdict.
- Converter: `npcToPartyMember` (`src/systems/party/npcToPartyMember.ts`) → `RECRUIT_COMPANION` reducer.
- Trigger handlers: tavern hire (`offerTavernHire`, `handleMerchantInteraction.ts:50-71`, invoked at line 218-222 when `hire === true` on a tavern/inn merchant) and dialogue invite (`handleRecruitOffer`, `src/hooks/actions/handleNpcInteraction.ts:163-217`, reads an optional `recruitOffer` on a talk-action payload).

The missing "producer-side trigger wiring", concretely:
- The tavern-hire door is behind `OPEN_DYNAMIC_MERCHANT` with `hire: true` — unreachable because no UI dispatches that action (gap 1).
- The dialogue door requires something to attach `recruitOffer: { targetNpcId }` to a talk action payload — nothing ever does. No dialogue topic, opening-situation resolution, or action-pane button sets it.

Natural early-game producers: (a) a "Hire <keeper>" action alongside "Browse Goods" once a tavern shop is reachable (dispatch `OPEN_DYNAMIC_MERCHANT` with `hire: true`), and (b) an "Ask <name> to join you" action for a warm-disposition NPC after the opening conversation — a talk action carrying `recruitOffer: { targetNpcId: npc.id }`, which `handleRecruitOffer` already fully handles.

## 4. Businesses simulate money but own no goods

- `WorldBusiness` (`src/types/business.ts:82-103`) carries owner, location, `burgId`/`plotId`, metrics, `dailyCustomers`, a single scalar `priceMultiplier` (0.9-1.2, set in `generateNpcBusiness`, `src/systems/economy/NpcBusinessManager.ts:159`), supply contracts, and daily reports. **There is no stock list and no per-item price anywhere on the type.**
- `generateNpcBusiness` (`NpcBusinessManager.ts:109-173`) fills only those simulation fields.
- Shop inventories today are conjured at door-open time by Gemini (`handleMerchantInteraction.ts:239`) with a deterministic seed fallback — they are not persisted, not owned by the business, and not derived from its type or wealth.
- Pricing DOES exist item-side: `calculatePrice` (`src/utils/economy/economyUtils.ts:131`) takes an item's `costInGp`, applies economy-event multipliers, buy/sell spread, and regional id; haggle results persist as NPC memory facts (`handleMerchantInteraction.ts:381-397`).

Distance to "logical shop inventories, logical pricing": add a persisted `stock: Item[]` (or item-id + quantity list) to `WorldBusiness`, generate it deterministically from `businessType` + town wealth at registration, and price it through the existing `calculatePrice` × the business's own `priceMultiplier`. Everything downstream (modal, buy/sell, haggling, economy events) already works.

## Fix packets

### Packet A — Shopkeeper talk targets at wf towns (the keystone)
**Files:** `src/App.tsx` (`getCurrentNPCs`), or better a small selector `src/systems/worldforge/townsim/npcsForCell.ts`; `src/components/ActionPane/useActionGeneration.ts`.
**Build:** when `resolveTownForLocation` says the player stands in a tracked town, merge that burg's registered `npc_burg_<burg>_plot_*` ids (from `generatedNpcs`, filtered by matching `burgId` on the linked business) plus 2-4 roster occupants into the talk-target list.
**Reuse:** `resolveTownForLocation`, `state.generatedNpcs`, `state.worldBusinesses` (already populated by `World3DWrapper.tsx:247-310`), the existing talk→dialogue path (`handleNpcInteraction`).

### Packet B — "Browse Goods" → MerchantModal from a shopkeeper
**Files:** `src/components/ActionPane/useActionGeneration.ts`; `src/hooks/actions/actionHandlers.ts` (no new handler needed).
**Build:** for each talk-target NPC that has a `businessId`, add a second action "Browse <business name>" dispatching `OPEN_DYNAMIC_MERCHANT` with `{ merchantType: business.businessType, buildingId: npc.id, seedKey: business.id }`. That single dispatch resurrects the whole dead chain: NPC reuse, inventory generation, `OPEN_MERCHANT`, buy/sell, haggling.
**Reuse:** `handleOpenDynamicMerchant` end-to-end (`handleMerchantInteraction.ts:154-291`), `MerchantModal`, `BUY_ITEM`/`SELL_ITEM`.

### Packet C — Persisted business stock + owned pricing
**Files:** `src/types/business.ts` (add `stock`), `src/systems/economy/NpcBusinessManager.ts` (`generateNpcBusiness` fills it from `businessType` templates + rng), `src/hooks/actions/handleMerchantInteraction.ts` (prefer `business.stock` over the Gemini call when the merchant has a linked business; price via `calculatePrice` × `business.priceMultiplier`), plus a small per-type catalog in `src/data/economy/`.
**Build:** deterministic, type-appropriate stock at registration; purchases decrement stock (extend `BUY_ITEM` handling or add a `DEBIT_BUSINESS_STOCK` follow-up); daily sim can restock.
**Reuse:** `calculatePrice` and its economy-event modifiers, `BUSINESS_TEMPLATES`, the SeededRandom conventions already used in `World3DWrapper.tsx:265-266`.

### Packet D — Reachable recruit triggers
**Files:** `src/components/ActionPane/useActionGeneration.ts`; optionally `src/hooks/useOpeningSituation.ts` / conversation resolution.
**Build:** (1) tavern keepers get a "Hire <name>" action (`OPEN_DYNAMIC_MERCHANT` + `hire: true` — handler already complete at `handleMerchantInteraction.ts:218-222`); (2) any generated NPC with warm disposition gets "Ask <name> to join you" — a talk action with `recruitOffer: { targetNpcId }`, consumed unmodified by `handleRecruitOffer` (`handleNpcInteraction.ts:163-217`).
**Reuse:** the entire consent → convert → `RECRUIT_COMPANION` pipeline; zero new recruit logic.

### Packet E — Stop offering "Talk to <the player>"
**Files:** `src/hooks/useOpeningSituation.ts` (before the `PLACE_SITUATION_NPCS` dispatch at line 171) or `src/systems/gameEntry/generateOpeningSituation.ts` (`mapRawSituation`, ~line 288).
**Build:** drop any generated situation NPC whose name case-insensitively matches a party member's name (or id); also add "never include the player character themselves" to the prompt at line 95.
**Reuse:** `gameState.party` names are already available in the hook.

Order: A → B → D can land independently and each is player-visible on its own; C deepens B; E is a one-afternoon fix. A+B alone turn a wf town from scenery into a place with people and working shops.
