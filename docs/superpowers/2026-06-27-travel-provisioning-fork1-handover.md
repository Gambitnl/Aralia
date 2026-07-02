# Handover — Travel Provisioning (Fork 1 complete) + what's next

**Date:** 2026-06-27 · **From:** Claude (Opus 4.8), Fork 1 session · **Repo:** `F:\Repos\Aralia`

> **New agent: read this, then STOP and ask.** After you've taken this in, do **not** start
> building. End your first turn with the **AskUserQuestion tool**, offering Remy concrete
> directions (options below). Remy's standing preference is that any direction-seeking turn uses
> AskUserQuestion, not raw text.

---

## 1. What this feature is

A **travel-provisioning** mechanic for the Aralia RPG: long world-map trips consume **food
(rations)** and **water** per traveler per day; the world map shows how far current supplies
reach, and setting out underprovisioned leads to a graduated choice (turn back / half-rations /
forage / push on) with real consequences (partial-stop, starvation, companion loyalty loss +
desertion). Approved v1.1 extensions are recorded in the spec (see §5).

- **Spec:** `docs/superpowers/specs/2026-06-25-travel-provisioning-design.md` (see "Approved
  extensions (v1.1)" section).
- **Plan:** `docs/superpowers/plans/2026-06-25-travel-provisions.md` (NOTE: Task 6 still describes
  a superseded per-cell overlay — the affordance became a **ring**, see below).
- **Living status memory:** `travel-provisioning-deferred` (in Remy's auto-memory).

## 2. Fork model (work was split 3 ways)

- **Foundation + ring + Fork 2 (forage): DONE** (prior sessions/forks).
- **Fork 1 (gate + consequences): DONE this session** — details in §3.
- **Fork 3 (logistics/map extensions): OPEN** — E2 terrain-burn, E3 weight↔speed, E4 caches. A
  Fork-3 agent is/was active in the shared checkout. See §4 + §6.

## 3. What is DONE (all green, verified)

**Pure core** (`src/systems/travel/`)
- `provisioning.ts` — resource-generic + terrain-aware: `resourceDays`/`daysOfFood`/`daysOfWater`,
  `WATER_ITEM_ID`, `dailyNeed(consumers,mode,burnMultiplier)`, `foodRangeDays(...,burn)`,
  `terrainBurnFactor`, `meanBurnMultiplier`, `bindingRangeDays`, `provisionStatusMulti` (food-vs-water binding). 28 tests.
- `travelProvisionDecision.ts` — `decideTravelProvision(...)` → `{status, sustainableDays, rationsToSpend, waterToSpend}`; supports a `forageFoodDays` horizon bump. 4 tests.
- `applyProvision.ts` — `buildProvisionActions(provision, companions)` → reducer actions (spend rations+water, set conditions, drain companion loyalty OR desert past `DESERT_LOYALTY_THRESHOLD=20`). 5 tests.
- `forage.ts` (Fork 2) — biome-yield forage loop: `forage()`/`resolveForage()`/`forageProfileForBiome()`/`computeForageYield()` over all FMG biomes, Survival check + margin/party yield + time cost + tainted/wasted hazards. 15 tests.
- `travelReadout.ts` — `formatProvisionLine` labels the **binding** resource.

**Data + state**
- `src/data/items/index.ts` — canonical `rations` (🥖) + `water-day` (🧴) items.
- `characterReducer.ts` — `STABLE_STACKABLE_ITEM_IDS` (gold+rations+water) so ADD_ITEM keeps their
  id → the days-of-food math + REMOVE_ITEM find them. `SET_PARTY_CONDITION`/`CLEAR_PARTY_CONDITION`
  (idempotent, party-wide).
- `companionReducer.ts` — `ADJUST_COMPANION_LOYALTY` (clamp 0–100) + `COMPANION_DESERT` (now
  **dual-store**: drops the `state.party` entry AND sets the Companion `inParty:false`, KEEPING the
  record so loyalty/relationship persist and they stay **re-recruitable**). Reconciled with a
  concurrent agent's design; `companionDesertion.test.ts` (6 tests) passes.
- `src/types/travelMeta.ts` — shared `TravelMeta`/`TravelProvisionEffect` contract used by
  App/MapPane/GameModals `onTileClick`.
- `src/state/actionTypes.ts` — added SET/CLEAR_PARTY_CONDITION, ADJUST_COMPANION_LOYALTY, COMPANION_DESERT.

**UI / integration**
- `AtlasSvgView.tsx` — `provisionRings` (glowing food/water contour + labeled legend) +
  `provisionLineForMinutes` readout. `atlasSvg.ts` `buildProvisionRingPath` boundary-contour helper.
- `MapPane.tsx` — the **gate**: `handleWorldforgePick` computes the decision (in-range → spend + go;
  short → inline `pendingTravel` **choice panel**: Turn back / Half rations / Forage en route /
  Push on). Push-on **partial-stops** at the last sustainable route point. **Forage** wired to
  Fork 2 `forage()` (food eaten en route → extends horizon + time + `poisoned` on tainted). Per-resource
  ring memo. **One-time risk explainer** pop-up (`PROVISION_RISK_INFO_KEY` localStorage) shown before
  the choice panel on the first shortfall. New props `provisionInventory`/`partySize`/`partySurvivalModifier`.
- `GameModals.tsx` — computes best forager's Survival modifier + threads inventory/party to MapPane.
- `App.tsx` — `handleTileClick` applies provisioning effects after both move branches via
  `buildProvisionActions`; dev-gated `window.__araliaDispatch` probe (sibling to `__araliaState`).

**Verified live** (dev:preview port 5176, Continue save): rings render (Food/Water reach), the choice
panel opens with correct severity copy, Push-on commits a partial-stop (moved, time advanced, map
closed, "supplies run out… halts, starving" message), and the risk pop-up is genuinely one-shot.

## 4. What is OPEN — the likely next work

**Fork 3 (logistics/map extensions)** — the biggest remaining chunk:
- **E2 — terrain burn:** the ring **and** the gate decision currently use **base range** (no terrain
  burn). Wire the route's terrain sequence → `meanBurnMultiplier`/`terrainBurnFactor` → a `burn` arg
  into `decideTravelProvision` and the MapPane ring memo. The pure primitives already exist.
- **E3 — weight↔speed:** rations/water have `weight`; feed provision weight into encumbrance →
  travel speed → trip-days (a self-tightening loop). `provisionWeight(inventory)` is the seam.
- **E4 — caches/depots:** drop/recover food caches on the map; owned towns stock provisions; the
  ring re-seeds from depots. Adds action types + a `provisionCaches` GameState field
  (+ factories/initialState) + MapPane UI. **Heads-up:** this overlaps `actionTypes.ts` and
  `MapPane.tsx` — re-read both before editing.

**Companions recruitment** (separate track, prompt already written):
- `docs/tasks/companions/RECRUITMENT_PLAYTEST_PROMPT.md` — a self-contained brief for an agent to
  investigate + play-test how companions are found/hired/convinced to join, and design "recruit any
  NPC" with procedural traits/skills for class-less NPCs. The new `inParty` flag + dual-store
  desertion is the first bit of a join/leave model.

**Smaller follow-ons:** the deferred provisioning pieces (mounts as consumers, vendor-rapport
resupply, non-party-NPC travel consent) remain blocked on prerequisite systems (see the
`travel-provisioning-deferred` memory). Plan Task 6 doc still describes the old per-cell overlay —
update it to the ring.

## 5. Conventions & gotchas (Remy-specific — important)

- **No estimates / full vision.** Never time-estimate or shrink scope for feasibility; build the
  full vision in priority order.
- **Plain language** in decision-facing summaries; no code identifiers/jargon when explaining to Remy.
- **Work only in master/main.** NEVER create a branch or git worktree (Remy dislikes them).
- **Don't commit.** The repo auto-commits to GitHub at 2am daily — leave work in the tree.
- **Visual-inspection rule.** Render and eyeball every visual/generation slice — numeric goldens
  aren't enough.
- **AskUserQuestion for direction.** End any direction-seeking turn with the tool, not raw text.
- **No fallbacks.** Build one real path; fail honestly (overrides SPEC graceful-degradation).
- **Shared checkout, concurrent forks.** Last-write-wins clobber risk. Re-read a file immediately
  before editing it; there's an `agora-coordination` skill for presence/file-locks/messaging.
- **Preview/verification harness:**
  - Dev server: `.claude/launch.json` — use the **`dev:preview`** config (port **5176**) when another
    fork holds the default `dev` (5174). Navigate the page to `http://localhost:5176/Aralia/`.
  - Load a game via **"Continue Journey"**; first bundle load is heavy (poll `#root` child count).
  - `window.__araliaState` (read-only summary) + `window.__araliaDispatch` (live dispatch, dev-gated)
    for scenario setup, e.g. `__araliaDispatch({type:'ADD_ITEM',payload:{itemId:'rations',count:9}})`.
  - **`preview_screenshot` hangs** on the ~1900-node filtered atlas SVG — verify via DOM
    `preview_eval` (querySelector/textContent), not JPEGs.
  - **To trigger the travel gate:** switch the map to **Travel** mode, click **Find Me** to zoom,
    then dispatch synthetic `mousedown`/`mouseup`/`click` ~110px off the player marker (map **corners
    are ocean** → no route → no gate). With 0 supplies, any reachable land trip is short.

## 6. Chronicle + memory state

- Chronicle entry logged: `misc/chronicle_data.json` id `2026-06-27-travel-provisions-gate-fork1`
  (the prior 06-27 19:30 entry covered only the foundation/ring/forage and listed Fork 1 under `next_steps`).
- Session-4 UX findings appended to `.agent/scratch/ux-pass/ISSUES.md` (WM8/WM9/WM10/P1/A1).

## 7. Your first move (do this, then ask)

Verify the tree is green for the provisioning surface, then ask Remy for direction:
```
npx vitest run src/systems/travel src/state/reducers/__tests__/partyCondition.test.ts \
  src/state/reducers/__tests__/companionDesertion.test.ts \
  src/state/reducers/__tests__/provisioningItems.test.ts \
  src/components/__tests__/MapPane.test.tsx
```
Then **call AskUserQuestion** with options such as:
- **Fork 3 — E2 terrain burn** (ring + gate reflect harsh ground) — highest-leverage next slice.
- **Fork 3 — E4 caches/depots** (most self-contained; least MapPane overlap).
- **Fork 3 — E3 weight↔speed.**
- **Companions recruitment** — launch/act on the play-test prompt.
- **Live playthrough eyeball** of the full gate + a UX-issues pass from `ISSUES.md`.

Do not pick for Remy — surface the options and let them steer.
