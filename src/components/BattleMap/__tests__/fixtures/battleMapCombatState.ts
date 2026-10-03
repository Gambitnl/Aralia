/**
 * @file __tests__/fixtures/battleMapCombatState.ts
 * Shared, TYPED test fixtures for the `combatState` prop of <BattleMap>.
 *
 * WHY THIS EXISTS (agora-a180): every BattleMap test had to hand-build a
 * turnManager, a turnState, and an abilitySystem, and every one of them ended
 * in `as any` because the real hook return types carry thirty-odd members a
 * test does not care about. Three consequences followed: a field BattleMap
 * started reading broke each test separately, the mocks silently drifted apart
 * (one file's turnManager had `reactiveTriggers`, another's did not), and the
 * casts hid the drift from tsc.
 *
 * WHAT THIS GIVES BACK: the builders below are exhaustive over the real hook
 * return types, so they need NO cast. `vi.fn()` satisfies any function member,
 * and the data members carry their real types. A member added to
 * `useTurnManager` or `useAbilitySystem` surfaces here as ONE compile error
 * instead of an unnoticed `undefined` at render time.
 *
 * HOW TO USE IT: call `createBattleMapCombatState()` for the default shape, and
 * pass overrides per slice for what a test actually exercises:
 *
 *   createBattleMapCombatState({
 *     turnState: { currentCharacterId: hero.id, turnOrder: [hero.id] },
 *     turnManager: { activeLightSources: [torch] },
 *     abilitySystem: { targetingMode: true },
 *   })
 *
 * Overrides are shallow-merged per slice, which is what a test wants: a test
 * that names `currentCharacterId` keeps every other turn-state default.
 *
 * SCOPE NOTE: agora-db71.1 migrated the five remaining 2D suites, so every
 * suite that renders the 2D <BattleMap> now builds its combatState here and
 * none of them carries an inline `as any` / `as never` combatState mock. The
 * five BattleMap3D suites still hand-roll theirs: they render a different
 * component whose prop shape these builders do not describe, and they belong
 * to the BattleMap3D shell packet, not this one.
 * The first conversion pass paid for itself immediately: the parity suite's
 * hand-rolled spell zone had drifted to `areaOfEffect: { type, radius }` and a
 * string `direction`, where ActiveSpellZone declares `{ shape, size }` and a
 * Position, and its teleport preview was missing the required `origin`. The
 * casts had hidden all three from tsc.
 *
 * Called by: __tests__/BattleMap.objectInteraction.test.tsx,
 * __tests__/BattleMap.interactions.test.tsx, __tests__/BattleMap.parity.test.tsx,
 * __tests__/BattleMap.visibility.test.tsx, __tests__/BattleMap.summonPresence.test.tsx,
 * __tests__/BattleMap.commandToolbar.test.tsx
 */

import { vi } from "vitest";
import type { CombatCharacter, TurnState } from "../../../../types/combat";
import type { useTurnManager } from "../../../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../../../hooks/useAbilitySystem";
import type { BattleMapProps } from "../../BattleMap";

type TurnManager = ReturnType<typeof useTurnManager>;
type AbilitySystem = ReturnType<typeof useAbilitySystem>;
type BattleMapCombatState = BattleMapProps["combatState"];

/**
 * A turn state with one actor mid-action.
 *
 * `turnGroups` and `activeGroup` are deliberately left unset: they are optional
 * on TurnState precisely so old saves and fixtures may omit them, and no
 * BattleMap render path reads them.
 */
export const createTurnState = (
  overrides: Partial<TurnState> = {},
): TurnState => ({
  currentTurn: 0,
  turnOrder: [],
  currentCharacterId: null,
  phase: "action",
  actionsThisTurn: [],
  ...overrides,
});

/**
 * A turn manager with every live channel empty and every command a spy.
 *
 * The empty arrays matter: BattleMap's marker layer reads eleven of them, and
 * an absent channel renders as "no overlays" rather than as a crash, which is
 * exactly the failure mode that makes a missing-field bug invisible in a test.
 */
export const createTurnManager = (
  overrides: Partial<TurnManager> = {},
): TurnManager => ({
  turnState: createTurnState(),
  initializeCombat: vi.fn(),
  joinCombat: vi.fn(),
  removeCharacterFromCombat: vi.fn(),
  canEscapeFromCombat: vi.fn(),
  escapeFromCombat: vi.fn(),
  executeAction: vi.fn(),
  endTurn: vi.fn(),
  skipToCharacter: vi.fn(),
  getCurrentCharacter: vi.fn(),
  isCharacterTurn: vi.fn(() => false),
  canAffordAction: vi.fn(() => false),
  addDamageNumber: vi.fn(),
  damageNumbers: [],
  animations: [],
  addSpellZone: vi.fn(),
  addMovementDebuff: vi.fn(),
  removeSpellZone: vi.fn(),
  setSpellZones: vi.fn(),
  addReactiveTrigger: vi.fn(),
  setReactiveTriggers: vi.fn(),
  spellZones: [],
  scheduledSpellEffects: [],
  movementDebuffs: [],
  reactiveTriggers: [],
  addScheduledSpellEffect: vi.fn(),
  removeScheduledSpellEffect: vi.fn(),
  activeLightSources: [],
  setActiveLightSources: vi.fn(),
  spellMovementVisuals: [],
  addSpellMovementVisual: vi.fn(),
  spellDeliveryVisuals: [],
  addSpellDeliveryVisual: vi.fn(),
  ...overrides,
});

/**
 * An ability system that is NOT targeting: no selected ability, no previews.
 *
 * This is the resting state of the map. A targeting test flips
 * `targetingMode` and supplies the one preview it is about.
 */
export const createAbilitySystem = (
  overrides: Partial<AbilitySystem> = {},
): AbilitySystem => ({
  selectedAbility: null,
  targetingMode: false,
  aoePreview: null,
  teleportDestinationPreview: null,
  pendingTeleportAssignment: null,
  targetValidationReason: null,
  getValidTargets: vi.fn(() => []),
  startTargeting: vi.fn(),
  selectTarget: vi.fn(),
  cancelTargeting: vi.fn(),
  previewAoE: vi.fn(),
  isValidTarget: vi.fn(() => false),
  getTargetValidation: vi.fn(),
  executeSpell: vi.fn(),
  executeAbility: vi.fn(),
  resetProcessedAbilityExecutionEvents: vi.fn(),
  dropConcentration: vi.fn(),
  pendingReaction: null,
  requestReaction: vi.fn(),
  replayPostDamageReactionEvents: vi.fn(),
  ...overrides,
});

/** Per-slice overrides for {@link createBattleMapCombatState}. */
export interface BattleMapCombatStateOverrides {
  turnState?: Partial<TurnState>;
  turnManager?: Partial<TurnManager>;
  abilitySystem?: Partial<AbilitySystem>;
  isCharacterTurn?: (id: string) => boolean;
  onCharacterUpdate?: (character: CombatCharacter) => void;
}

/**
 * The whole `combatState` prop, with the turn state shared between the
 * manager and the top-level field.
 *
 * BattleMap reads `combatState.turnState` for the active token and
 * `combatState.turnManager.turnState` through the hooks it forwards to. Those
 * two must be the SAME object or a test can pass with a board that disagrees
 * with itself about whose turn it is; every test that hand-rolled the pair had
 * to remember that, and the two tests that wrote the literal twice were one
 * edit away from disagreeing.
 */
export const createBattleMapCombatState = (
  overrides: BattleMapCombatStateOverrides = {},
): BattleMapCombatState => {
  const turnState = createTurnState(overrides.turnState);
  return {
    turnManager: createTurnManager({ turnState, ...overrides.turnManager }),
    turnState,
    abilitySystem: createAbilitySystem(overrides.abilitySystem),
    isCharacterTurn: overrides.isCharacterTurn ?? vi.fn(() => false),
    onCharacterUpdate: overrides.onCharacterUpdate ?? vi.fn(),
  };
};
