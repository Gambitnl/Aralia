/**
 * @file healerFeat.test.ts
 * Proof for agora-4325.1: the Healer feat and the Healer's Kit Utilize action
 * do something. Covers the three acceptance points — stabilize without the
 * feat, Hit Die healing with it, and kit uses decrementing.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Dispatch } from 'react';
import { FEATS_DATA } from '../featsData';
import {
  resolveHealersKitUse,
  kitUsesRemaining,
  hasHealerFeat,
  HEALERS_KIT_MAX_USES,
  HEALERS_KIT_ITEM_ID,
} from '../../../systems/healing/healersKit';
import { handleUseHealersKit } from '../../../hooks/actions/handleItemInteraction';
import { GENERATED_GLOSSARY_ITEMS } from '../../items/generatedGlossaryItems';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState, PlayerCharacter, Item } from '../../../types';

const abilityScores = {
  Strength: 10,
  Dexterity: 10,
  Constitution: 14, // +2
  Intelligence: 10,
  Wisdom: 10,
  Charisma: 10,
};

const makeCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
  id: 'char-1',
  name: 'Patient',
  hp: 0,
  maxHp: 20,
  finalAbilityScores: { ...abilityScores },
  hitPointDice: [{ die: 8, current: 2, max: 3 }],
  feats: [],
  statusEffects: [],
  ...overrides,
} as unknown as PlayerCharacter);

const makeKit = (usesRemaining?: number): Item => ({
  id: HEALERS_KIT_ITEM_ID,
  name: "Healer's Kit",
  description: "A Healer's Kit has ten uses.",
  type: 'accessory',
  usesRemaining,
} as unknown as Item);

/** A rigged source that yields the given 0..1 fractions in order. */
const scriptedRng = (values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

describe('Healer feat data (agora-4325.1)', () => {
  it('grants the kit-mastery benefit instead of nothing', () => {
    const healer = FEATS_DATA.find(feat => feat.id === 'healer');
    expect(healer).toBeDefined();
    expect(healer?.benefits?.healersKitMastery).toBe(true);
  });

  it('still points at the Healer\'s Kit item that the mechanic spends', () => {
    expect(GENERATED_GLOSSARY_ITEMS[HEALERS_KIT_ITEM_ID]?.name).toBe("Healer's Kit");
  });
});

describe("Healer's Kit Utilize action", () => {
  it('stabilizes a dying ally without the feat and grants no healing', () => {
    const user = makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats: [] });
    const target = makeCharacter({ hp: 0 });

    const outcome = resolveHealersKitUse({
      user,
      target,
      kit: makeKit(),
      rng: scriptedRng([0.99]),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.stabilized).toBe(true);
    expect(outcome.healing).toBe(0);
    expect(outcome.hitPointDice).toBeUndefined();
    expect(hasHealerFeat(user)).toBe(false);
  });

  it('lets the target spend one Hit Die when the user has the Healer feat', () => {
    const user = makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats: ['healer'] });
    const target = makeCharacter({ hp: 0 });

    // rng 0.5 on a d8 rolls a 5; +2 Constitution = 7 HP.
    const outcome = resolveHealersKitUse({
      user,
      target,
      kit: makeKit(),
      rng: scriptedRng([0.5]),
    });

    expect(outcome.stabilized).toBe(true);
    expect(outcome.rolls).toEqual([5]);
    expect(outcome.healing).toBe(7);
    expect(outcome.hitPointDice).toEqual([{ die: 8, current: 1, max: 3 }]);
  });

  it('rerolls a Hit Die that shows a 1 and keeps the second result', () => {
    const user = makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats: ['healer'] });
    const target = makeCharacter({ hp: 0 });

    // First roll 1 (rng 0), reroll to 8 (rng 0.99); +2 Constitution = 10 HP.
    const outcome = resolveHealersKitUse({
      user,
      target,
      kit: makeKit(),
      rng: scriptedRng([0, 0.99]),
    });

    expect(outcome.rolls).toEqual([1, 8]);
    expect(outcome.healing).toBe(10);
  });

  it('decrements kit uses and refuses a depleted kit', () => {
    const user = makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats: [] });
    const target = makeCharacter({ hp: 0 });

    expect(kitUsesRemaining(makeKit())).toBe(HEALERS_KIT_MAX_USES);

    const first = resolveHealersKitUse({ user, target, kit: makeKit(), rng: scriptedRng([0.5]) });
    expect(first.kitUsesRemaining).toBe(HEALERS_KIT_MAX_USES - 1);

    const lastUse = resolveHealersKitUse({ user, target, kit: makeKit(1), rng: scriptedRng([0.5]) });
    expect(lastUse.ok).toBe(true);
    expect(lastUse.kitUsesRemaining).toBe(0);

    const depleted = resolveHealersKitUse({ user, target, kit: makeKit(0), rng: scriptedRng([0.5]) });
    expect(depleted.ok).toBe(false);
    expect(depleted.failure).toBe('kit_depleted');
  });

  it('refuses to burn a use on a healthy ally without the feat', () => {
    const user = makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats: [] });
    const target = makeCharacter({ hp: 20 });

    const outcome = resolveHealersKitUse({ user, target, kit: makeKit(), rng: scriptedRng([0.5]) });

    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe('target_dead_or_full');
    expect(outcome.kitUsesRemaining).toBe(HEALERS_KIT_MAX_USES);
  });
});

describe('handleUseHealersKit wiring', () => {
  const buildState = (feats: string[], kit: Item | undefined): GameState => ({
    party: [
      makeCharacter({ id: 'medic', name: 'Medic', hp: 12, feats }),
      makeCharacter({ id: 'patient', name: 'Patient', hp: 0 }),
    ],
    inventory: kit ? [kit] : [],
  } as unknown as GameState);

  it('dispatches the resolved result when the kit is in the inventory', () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();

    handleUseHealersKit({
      payload: { userCharacterId: 'medic', targetCharacterId: 'patient' },
      gameState: buildState(['healer'], makeKit()),
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const dispatched = dispatch.mock.calls[0][0];
    expect(dispatched.type).toBe('APPLY_HEALERS_KIT');
    expect(dispatched.payload.targetCharacterId).toBe('patient');
    expect(dispatched.payload.stabilized).toBe(true);
    expect(dispatched.payload.kitUsesRemaining).toBe(HEALERS_KIT_MAX_USES - 1);
    expect(addMessage).toHaveBeenCalled();
  });

  it('dispatches nothing when the party carries no kit', () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();

    handleUseHealersKit({
      payload: { userCharacterId: 'medic', targetCharacterId: 'patient' },
      gameState: buildState(['healer'], undefined),
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith("You have no Healer's Kit to use.", 'system');
  });
});
