# Absorbed: Crafting UI (docs/projects/crafting-ui)

Absorbed into planmap topic `crafting-ui` on 2026-07-16 (wave 10R).
Folder deleted; git history is the archive.

## Surface

Crafting UI lives under `src/components/Crafting/`:
- `AlchemyBenchPanel.tsx` — tab routing, location/tool filters, research
  actions, recent-activity log. Live recipe-browser derivations and the
  quantity-aware batch preview are owned by `alchemyBenchSelectors.ts`
  (G9 modularization split).
- `ExperimentPanel.tsx` — counts reagent stack `quantity` when building the
  available ingredient pool; accepts additive drag-and-drop staging into the
  cauldron alongside the click path. Experimental damage routes through
  `MODIFY_PARTY_HEALTH` (proven in ExperimentPanel.test.tsx; G3 resolved
  2026-06-17).

## Reducer contract (G2+G5 slice, resolved by 2026-06-26)

- `UPDATE_CRAFTING_STATS` payload is typed with `CraftingQuality`
  (`ruined|standard|masterwork|legendary`) and `CraftingCategory`
  (`potion|oil|poison|bomb|utility|ink`) unions in `src/state/actionTypes.ts`
  (+ `.d.ts` twin, which also gained `TOGGLE_INVESTMENT_BOARD`).
- `src/state/reducers/__tests__/craftingReducer.test.ts` locks the reducer
  (9 cases: quality tiers, nat20, category counts, accumulation, immutability,
  no-op).

## Open follow-ups (now planmap features on the topic)

- G4: reconcile the UI windowing pattern.
- G6: alchemy bench remains a large UI surface paired with a large recipe
  corpus; continue modularization beyond the selectors split.
- G7: `UPDATE_CRAFTING_STATS` is only dispatched from `AlchemyBenchPanel.tsx`;
  other craft surfaces (cooking, enchanting, refining, salvage) do not feed
  crafter stats.
- G8 (salvage UI owner): salvage recipes have backend support
  (`salvageSystem.ts`) but no confirmed player-facing inventory entry point
  (`InventoryList.tsx`). This topic is the routed owner for salvage UI —
  `docs/tasks/ui-features` G1/T3 point here; do not reopen the retired
  standalone `docs/tasks/CRAFTING_UI_TODO.md`.

## Boundary note

Core engine contracts (quality vocabularies, compatibility adapter) are owned
by the `crafting` topic (see
`docs/superpowers/specs/2026-07-14-absorbed-crafting.md`).
