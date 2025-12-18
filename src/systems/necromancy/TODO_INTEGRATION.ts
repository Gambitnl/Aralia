// TODO(Steward): Integrate Corpse System into CombatState
// Context: "Analyst" persona created the Corpse framework in `src/systems/necromancy/`.
// We need to:
// 1. Add `corpses: Corpse[]` to `CombatState` in `src/types/combat.ts`.
// 2. Update `useTurnManager` to call `createCorpse` when a character dies (HP <= 0).
// 3. Update `TargetResolver.ts` to support targeting `corpses` (requires updating `isValidTarget`).
// 4. Update `CombatView.tsx` (or a new layer) to render `Corpse` objects on the map (e.g., as pile of bones).
// 5. Update `Animate Dead` spell JSON to use this new target type.
