/**
 * This test file pins the level-1 subclass path that the 2014 Player's Handbook
 * asks for (agora-f821.60 and agora-f821.61).
 *
 * Two defects are gated here:
 * 1. The warlock patron chosen at level 1 must land on `character.subclassId`,
 *    the one field `LevelUpModal` reads, so the level-3 milestone does not ask
 *    for a subclass the player already picked.
 * 2. Auto-Fill (Random) must pick that level-1 subclass itself, for every class
 *    whose `getSubclassLevel` answers 1, and leave it unset under 2024.
 *
 * The tests drive the real engine: `randomizeCreation` builds the action plan,
 * the real reducer replays it, `assemblePlayerCharacter` turns the finished
 * state into a `PlayerCharacter`, and that character is rendered into the real
 * `LevelUpModal`. Nothing is hand-built behind the pipeline's back.
 *
 * Called by: Vitest during Character Creator verification.
 * Depends on: randomizeCreation.ts, characterCreatorState.ts,
 * useCharacterAssembly.ts, LevelUpModal.tsx, rulesEdition.ts, class data.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpellSchool, type Spell } from '../../../types';
import { CLASSES_DATA } from '../../../data/classes';
import { subclassesForClass } from '../../../data/classes/subclasses';
import type { RulesEdition } from '../../../config/rulesEdition';
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

// ============================================================================
// Spell Fixture
// ============================================================================
// The engine only reads spell identity and level while choosing class features,
// so a compact bundle built from the class spell lists exercises every caster
// without loading the large public spell JSON.
// ============================================================================

const CANTRIP_IDS = new Set([
  'acid-splash', 'blade-ward', 'booming-blade', 'chill-touch', 'dancing-lights',
  'druidcraft', 'eldritch-blast', 'elementalism', 'fire-bolt', 'friends',
  'guidance', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion',
  'poison-spray', 'prestidigitation', 'produce-flame', 'ray-of-frost',
  'resistance', 'sacred-flame', 'shillelagh', 'shocking-grasp',
  'spare-the-dying', 'thaumaturgy', 'thorn-whip', 'true-strike',
  'vicious-mockery',
]);

// Schools cycle so every school owns some level-1 spells. Feats such as
// Shadow-Touched ask for an Illusion or Necromancy spell, and a single-school
// fixture would starve the engine on unrelated seeds.
const SPELL_SCHOOL_CYCLE = Object.values(SpellSchool);

const TEST_SPELLS: Record<string, Spell> = {};
let spellIndex = 0;
for (const charClass of Object.values(CLASSES_DATA)) {
  for (const spellId of charClass.spellcasting?.spellList ?? []) {
    if (TEST_SPELLS[spellId]) continue;
    TEST_SPELLS[spellId] = {
      id: spellId,
      name: spellId,
      level: CANTRIP_IDS.has(spellId) ? 0 : 1,
      school: SPELL_SCHOOL_CYCLE[spellIndex++ % SPELL_SCHOOL_CYCLE.length],
      classes: [],
      subClasses: [],
      description: '',
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'self' },
      components: { verbal: false, somatic: false, material: false },
      duration: { type: 'instantaneous', concentration: false },
      targeting: { type: 'self' },
      effects: [],
    } as unknown as Spell;
  }
}

// ============================================================================
// Replay Helpers
// ============================================================================

/** The classes the 2014 PHB asks for a subclass at level 1. */
const LEVEL_ONE_SUBCLASS_CLASSES = ['cleric', 'sorcerer', 'warlock'] as const;

function replay(seed: number, rulesEdition: RulesEdition): CharacterCreationState {
  const plan = randomizeCreation({
    allSpells: TEST_SPELLS,
    rulesEdition,
    rng: seededRng(seed),
  });

  return plan.actions.reduce(characterCreatorReducer, initialCharacterCreatorState);
}

/**
 * The first replayed plan that lands on `classId`. The engine picks its class at
 * random, so the tests scan seeds rather than reaching past the engine to force
 * one; the scan is deterministic because every seed is.
 */
function replayForClass(classId: string, rulesEdition: RulesEdition): CharacterCreationState {
  for (let seed = 1; seed <= 4000; seed += 1) {
    const state = replay(seed, rulesEdition);
    if (state.selectedClass?.id === classId) return state;
  }

  throw new Error(`No seed in 1..4000 produced a ${classId} under the ${rulesEdition} rules.`);
}

// ============================================================================
// agora-f821.60 — the level-1 pick reaches character.subclassId
// ============================================================================

describe('level-1 subclass reaches the assembled character (2014)', () => {
  for (const classId of LEVEL_ONE_SUBCLASS_CLASSES) {
    it(`a 2014 ${classId} has subclassId set at creation`, () => {
      const state = replayForClass(classId, '2014');
      const legalIds = subclassesForClass(classId).map((subclass) => subclass.id);

      expect(state.selectedSubclassId).toBeTruthy();
      expect(legalIds).toContain(state.selectedSubclassId);

      const character = assemblePlayerCharacter(state, state.characterName);
      expect(character).not.toBeNull();
      expect(character?.subclassId).toBe(state.selectedSubclassId);
    });
  }

  it('a 2014 warlock keeps the patron on both the patron field and subclassId', () => {
    const state = replayForClass('warlock', '2014');

    // `selectedWarlockPatron` is the warlock-flavored field the sheet reads for
    // patron text. It must agree with `selectedSubclassId`, not replace it.
    expect(state.selectedWarlockPatron).toBe(state.selectedSubclassId);
  });

  for (const classId of LEVEL_ONE_SUBCLASS_CLASSES) {
    it(`a 2024 ${classId} leaves subclassId unset for the level-3 milestone`, () => {
      const state = replayForClass(classId, '2024');

      expect(state.selectedSubclassId).toBeNull();
      expect(assemblePlayerCharacter(state, state.characterName)?.subclassId).toBeUndefined();
    });
  }
});

// ============================================================================
// agora-f821.60 — LevelUpModal does not ask again at level 3
// ============================================================================

describe('LevelUpModal at level 3 under the 2014 rules', () => {
  for (const classId of LEVEL_ONE_SUBCLASS_CLASSES) {
    it(`does not re-ask a 2014 ${classId} for a subclass`, () => {
      const state = replayForClass(classId, '2014');
      const character = assemblePlayerCharacter(state, state.characterName);
      expect(character).not.toBeNull();

      render(
        <LevelUpModal
          isOpen
          character={{ ...character!, level: 2, xp: 900 }}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );

      expect(screen.queryByText('Choose your subclass')).not.toBeInTheDocument();
    });

    it(`still asks a 2024 ${classId} for a subclass at level 3`, () => {
      const state = replayForClass(classId, '2024');
      const character = assemblePlayerCharacter(state, state.characterName);
      expect(character).not.toBeNull();

      render(
        <LevelUpModal
          isOpen
          character={{ ...character!, level: 2, xp: 900 }}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );

      expect(screen.getByText('Choose your subclass')).toBeInTheDocument();
    });
  }
});

// ============================================================================
// agora-f821.61 — Auto-Fill picks the level-1 subclass
// ============================================================================

describe('Auto-Fill (Random) subclass picking', () => {
  it('picks a legal subclass for every 2014 level-1 class across many seeds', () => {
    const seeds = Array.from({ length: 120 }, (_, index) => index + 1);
    let planned = 0;
    let missing = 0;
    let illegal = 0;

    for (const seed of seeds) {
      const state = replay(seed, '2014');
      const classId = state.selectedClass?.id;
      if (!classId || !(LEVEL_ONE_SUBCLASS_CLASSES as readonly string[]).includes(classId)) continue;

      planned += 1;
      if (!state.selectedSubclassId) {
        missing += 1;
        continue;
      }
      if (!subclassesForClass(classId).some((subclass) => subclass.id === state.selectedSubclassId)) {
        illegal += 1;
      }
    }

    expect(planned).toBeGreaterThan(0);
    expect(missing).toBe(0);
    expect(illegal).toBe(0);
  });

  it('never picks a subclass under the 2024 rules', () => {
    const seeds = Array.from({ length: 120 }, (_, index) => index + 1);
    const withSubclass = seeds.filter((seed) => replay(seed, '2024').selectedSubclassId !== null);

    expect(withSubclass).toEqual([]);
  });

  it('replays the same pick from the same seed with the default SeededRandom', () => {
    const build = () => randomizeCreation({ allSpells: TEST_SPELLS, rulesEdition: '2014', seed: 20260921 });

    const first = build();
    const second = build();

    expect(first.state.selectedClass?.id).toBe(second.state.selectedClass?.id);
    expect(first.state.selectedSubclassId).toBe(second.state.selectedSubclassId);
    expect(first.state).toEqual(second.state);
  });

  it('varies the pick across seeds, so the default generator is not a constant', () => {
    const classIds = new Set(
      Array.from({ length: 20 }, (_, index) =>
        randomizeCreation({ allSpells: TEST_SPELLS, rulesEdition: '2014', seed: index + 1 }).state.selectedClass?.id),
    );

    expect(classIds.size).toBeGreaterThan(1);
  });
});
