/**
 * This test file pins the 2014 level 2 subclass step (agora-f821.58 druid,
 * agora-f821.59 wizard). Remy ruled (Agora 8335, answer to question 8009) that
 * these classes pick their subclass in a creator "level 2 step" instead of at
 * the first level-up. One answer covers both classes.
 *
 * Gated here:
 * 1. Auto-Fill (Random) picks the level 2 subclass under 2014 and leaves it
 *    unset under 2024, and the pick reaches `character.subclassId`.
 * 2. LevelUpModal uses the edition's subclass level: a 2014 druid or wizard
 *    that has no subclass is asked at level 2, one that picked in the creator
 *    is not asked, and a 2024 one is not asked before level 3.
 *
 * Like levelOneSubclass.test.tsx, the tests drive the real engine:
 * randomizeCreation, the reducer, assemblePlayerCharacter and LevelUpModal.
 *
 * Called by: Vitest during Character Creator verification.
 * Depends on: randomizeCreation.ts, characterCreatorState.ts,
 * useCharacterAssembly.ts, LevelUpModal.tsx, rulesEdition.ts, class data.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerCharacter, Spell } from '../../../types';
import { CLASSES_DATA } from '../../../data/classes';
import { subclassesForClass } from '../../../data/classes/subclasses';
import { choosesSubclassInCreator, type RulesEdition } from '../../../config/rulesEdition';
import { GameProvider } from '../../../state/GameContext';
import type { AppAction } from '../../../state/actionTypes';
import LevelUpModal from '../../CharacterSheet/LevelUpModal';
import { assemblePlayerCharacter } from '../hooks/useCharacterAssembly';
import {
  characterCreatorReducer,
  initialCharacterCreatorState,
  type CharacterCreationState,
} from '../state/characterCreatorState';
import { randomizeCreation, seededRng } from '../randomizeCreation';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

// A compact spell bundle from the class spell lists; the engine reads only
// spell identity and level while it chooses class features.
const CANTRIP_IDS = new Set(['druidcraft', 'produce-flame', 'shillelagh', 'thorn-whip', 'guidance', 'resistance', 'poison-spray', 'elementalism',
  'acid-splash', 'chill-touch', 'fire-bolt', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion', 'prestidigitation',
  'ray-of-frost', 'shocking-grasp', 'true-strike', 'blade-ward', 'booming-blade', 'dancing-lights', 'friends', 'eldritch-blast',
  'sacred-flame', 'spare-the-dying', 'thaumaturgy', 'vicious-mockery']);
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const TEST_SPELLS: Record<string, Spell> = {};
let spellIndex = 0;
for (const charClass of Object.values(CLASSES_DATA)) {
  for (const spellId of charClass.spellcasting?.spellList ?? []) {
    if (TEST_SPELLS[spellId]) continue;
    TEST_SPELLS[spellId] = {
      id: spellId, name: spellId, level: CANTRIP_IDS.has(spellId) ? 0 : 1, school: SCHOOLS[spellIndex++ % SCHOOLS.length],
      classes: [], subClasses: [], description: '', castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: false, somatic: false, material: false }, duration: { type: 'instantaneous', concentration: false },
      targeting: { type: 'self' }, effects: [],
    } as unknown as Spell;
  }
}

const LEVEL_TWO_SUBCLASS_CLASSES = ['druid', 'wizard'] as const;

function replay(seed: number, rulesEdition: RulesEdition): CharacterCreationState {
  const plan = randomizeCreation({ allSpells: TEST_SPELLS, rulesEdition, rng: seededRng(seed) });
  return plan.actions.reduce(characterCreatorReducer, initialCharacterCreatorState);
}

/** The first replayed plan that lands on `classId`; deterministic because every seed is. */
function replayForClass(classId: string, rulesEdition: RulesEdition): CharacterCreationState {
  for (let seed = 1; seed <= 4000; seed += 1) {
    const state = replay(seed, rulesEdition);
    if (state.selectedClass?.id === classId) return state;
  }
  throw new Error(`No seed in 1..4000 produced a ${classId} under the ${rulesEdition} rules.`);
}

/** Renders the level-up for a level 1 character, inside a game that plays `rulesEdition`. */
function renderLevelUp(character: PlayerCharacter, rulesEdition: RulesEdition) {
  const state = { rulesEdition } as unknown as GameState;
  const dispatch = (() => undefined) as React.Dispatch<AppAction>;
  return render(
    <GameProvider state={state} dispatch={dispatch}>
      <LevelUpModal isOpen character={{ ...character, level: 1, xp: 300 }} onClose={vi.fn()} onConfirm={vi.fn()} />
    </GameProvider>,
  );
}

describe('the creator level 2 step (2014 druid and wizard)', () => {
  it('only druid and wizard use the level 2 step, and only under 2014', () => {
    expect(choosesSubclassInCreator('druid', '2014')).toBe(true);
    expect(choosesSubclassInCreator('wizard', '2014')).toBe(true);
    expect(choosesSubclassInCreator('druid', '2024')).toBe(false);
    expect(choosesSubclassInCreator('wizard', '2024')).toBe(false);
    expect(choosesSubclassInCreator('fighter', '2014')).toBe(false);
  });

  for (const classId of LEVEL_TWO_SUBCLASS_CLASSES) {
    it(`a 2014 ${classId} picks a legal subclass that reaches character.subclassId`, () => {
      const state = replayForClass(classId, '2014');
      expect(subclassesForClass(classId).map((subclass) => subclass.id)).toContain(state.selectedSubclassId);
      const character = assemblePlayerCharacter(state, state.characterName);
      expect(character?.subclassId).toBe(state.selectedSubclassId);
      // The character is still built at level 1; the features start at level 2.
      expect(character?.level).toBe(1);
    });

    it(`a 2024 ${classId} leaves subclassId unset`, () => {
      const state = replayForClass(classId, '2024');
      expect(state.selectedSubclassId).toBeNull();
      expect(assemblePlayerCharacter(state, state.characterName)?.subclassId).toBeUndefined();
    });
  }
});

describe('LevelUpModal subclass milestone follows the rules edition', () => {
  for (const classId of LEVEL_TWO_SUBCLASS_CLASSES) {
    it(`asks a 2014 ${classId} without a subclass at level 2`, () => {
      const character = assemblePlayerCharacter(replayForClass(classId, '2024'), 'Older Save');
      renderLevelUp(character!, '2014');
      expect(screen.getByText('Choose your subclass')).toBeInTheDocument();
      expect(screen.getByText(/At level 2 you commit to a specialization/)).toBeInTheDocument();
      expect(screen.getByText(subclassesForClass(classId)[0].name)).toBeInTheDocument();
    });

    it(`does not ask a 2014 ${classId} that picked in the creator`, () => {
      const character = assemblePlayerCharacter(replayForClass(classId, '2014'), 'New Hero');
      renderLevelUp(character!, '2014');
      expect(screen.queryByText('Choose your subclass')).not.toBeInTheDocument();
    });

    it(`does not ask a 2024 ${classId} at level 2`, () => {
      const character = assemblePlayerCharacter(replayForClass(classId, '2024'), 'New Hero');
      renderLevelUp(character!, '2024');
      expect(screen.queryByText('Choose your subclass')).not.toBeInTheDocument();
    });
  }
});
