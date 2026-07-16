# Absorbed: Crafting System (docs/projects/crafting)

Absorbed into planmap topic `crafting` on 2026-07-16 (wave 10R).
Folder deleted; git history is the archive.

## System state

Two intentionally separate craft cores (decision: keep them separate; any
future migration starts from a new evidence-backed gap):

- `src/systems/crafting/craftingSystem.ts` — legacy callback-based core,
  quality vocabulary `poor/standard/superior/masterwork`, materials checked
  by `itemId`, optional `qualityOutcomes`.
- `src/systems/crafting/craftingEngine.ts` — enhanced core, quality vocabulary
  `ruined/flawed/standard/masterwork/legendary` (from `crafterProgression.ts`),
  ingredient/gold/tool/known-recipe craftability checks, location-aware roll
  modifiers, roll metadata + XP + time + gold in results.

Supporting modules: `batchCrafting.ts`, `crafterProgression.ts`,
`craftingAchievements.ts`, `craftingLocations.ts`, `ingredientGlossary.ts`,
domain systems (`gatheringSystem`, `creatureHarvestSystem`,
`experimentalAlchemy`, `CookingSystem`, `EnchantingSystem`, `RefiningSystem`,
`salvageSystem`), recipe data (`alchemyRecipes.ts`, `data/recipes.ts`,
`data/enchantingRecipes.ts`).

## Compatibility contract (proven 2026-06-09, G1 closed)

`src/systems/crafting/craftingCompatibility.ts` is the explicit bridge.
It normalizes legacy results into an enhanced-facing payload; the reverse
quality map is lossy only where the older vocabulary has no equivalent tier.
Regression coverage exercises success/failure normalization, the full quality
matrix both directions, and intentionally-absent enhanced fields.

| Legacy -> Enhanced | Enhanced -> Legacy |
|---|---|
| poor -> ruined | ruined -> poor |
| standard -> standard | flawed -> standard |
| superior -> masterwork | standard -> standard |
| masterwork -> legendary | masterwork -> superior |
|  | legendary -> masterwork |

Side-effect translation: `consumedMaterials[]` -> boolean `materialsConsumed`;
`experienceGained` -> `xpGained`; `recipe.timeMinutes` -> `timeSpentMinutes`;
`goldSpent` stays `0` (legacy path emits no gold cost); `roll`, `rawRoll`,
`dc`, `qualityResult`, `modifiersApplied` are not emitted by the legacy path —
the adapter records provenance for those unmapped fields.

## Open follow-ups (now planmap features on the topic)

- G5 (decision required): Refining/Enchanting have TODO notes for UI and
  selection/feedback flows but no assigned panel/tab owner in the crafting UI
  export surface. Blocked until placement is decided.
- G6: save/load has no dedicated crafting-state migration/backfill path for
  older/new shapes (`saveLoadService.ts`, `types/crafting.ts`,
  `initialState.ts`).
