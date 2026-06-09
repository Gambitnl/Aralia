import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCharacter } from '../../../types';
import type { CrafterProgression } from '../../../systems/crafting/crafterProgression';
import { ExperimentPanel } from '../ExperimentPanel';
import { attemptExperiment } from '../../../systems/crafting/experimentalAlchemy';

/**
 * This file proves the experimental alchemy panel sends explosion damage into
 * the same party-health action used elsewhere in the game.
 *
 * It also locks in the stacked-reagent selection fix so one inventory record
 * with quantity can be selected multiple times, consumed one unit at a time,
 * and still route fallout through the shared reducer.
 */

// The panel now routes explosion damage through party health, so this test
// keeps the proof focused on the state action instead of the log text.
const useGameStateMock = vi.fn();

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => useGameStateMock(),
}));

vi.mock('../ExperimentPanel.css', () => ({}));

vi.mock('../../../systems/crafting/alchemySystem', () => ({
  REAGENT_DATABASE: {
    herb_a: ['reactive'],
    herb_b: ['toxic'],
  },
}));

vi.mock('../../../systems/crafting/experimentalAlchemy', () => ({
  attemptExperiment: vi.fn(),
  getIngredientProperties: vi.fn((itemId: string) => (itemId === 'herb_a' ? ['reactive'] : ['toxic'])),
  getPropertyHint: vi.fn(() => 'volatile'),
  combineProperties: vi.fn(() => ['reactive', 'toxic']),
}));

vi.mock('../../../systems/crafting/crafterProgression', () => ({
  learnRecipe: vi.fn((progression: CrafterProgression) => progression),
}));

const makeCharacter = (id: string, name: string): PlayerCharacter => ({
  id,
  name,
  level: 5,
  proficiencyBonus: 3,
  abilityScores: {
    Strength: 10,
    Dexterity: 12,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  finalAbilityScores: {
    Strength: 10,
    Dexterity: 12,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 8,
  },
  skills: [{ id: 'nature', name: 'Nature', ability: 'Intelligence' }],
  toolProficiencies: ['Herbalism Kit'],
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: {
    id: 'wizard',
    name: 'Wizard',
    description: '',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: [],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: [],
  },
  statusEffects: [],
  hp: 10,
  maxHp: 10,
  armorClass: 10,
  speed: 30,
  darkvisionRange: 0,
  transportMode: 'foot',
  equippedItems: {},
});

const createDataTransfer = () => {
  const data = new Map<string, string>();

  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: (format: string, value: string) => {
      data.set(format, value);
    },
    getData: (format: string) => data.get(format) ?? '',
    clearData: (format?: string) => {
      if (format) {
        data.delete(format);
      } else {
        data.clear();
      }
    },
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
};

describe('ExperimentPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    vi.mocked(attemptExperiment).mockReturnValue({
      outcome: 'minor_explosion',
      success: false,
      message: 'boom',
      damage: { amount: 6, type: 'fire' },
      xpGained: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts stacked reagent quantity and still routes explosion damage into shared party health', () => {
    const lead = makeCharacter('party-lead', 'Party Lead');
    const ally = makeCharacter('party-ally', 'Party Ally');
    const dispatch = vi.fn();

    useGameStateMock.mockReturnValue({
      state: {
        party: [lead, ally],
        inventory: [
          { id: 'herb_a', name: 'Herb A', quantity: 2 },
          { id: 'herb_b', name: 'Herb B', quantity: 1 },
        ],
      },
      dispatch,
    });

    render(
      <ExperimentPanel
        progression={{ knownRecipes: new Set(), bonusModifier: 1 } as unknown as CrafterProgression}
        onProgressionUpdate={vi.fn()}
      />
    );

    const herbAButton = screen.getByRole('button', { name: /Herb A/i });
    const herbBButton = screen.getByRole('button', { name: /Herb B/i });

    fireEvent.click(herbAButton);
    fireEvent.click(herbAButton);
    fireEvent.click(herbBButton);
    fireEvent.click(screen.getByRole('button', { name: /Experiment/i }));

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(attemptExperiment).toHaveBeenCalledWith(['herb_a', 'herb_a', 'herb_b'], expect.any(Number), expect.any(Set));
    expect(dispatch).toHaveBeenCalledTimes(4);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'REMOVE_ITEM',
      payload: { itemId: 'herb_a', count: 1 },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'REMOVE_ITEM',
      payload: { itemId: 'herb_a', count: 1 },
    });
    expect(dispatch).toHaveBeenNthCalledWith(3, {
      type: 'REMOVE_ITEM',
      payload: { itemId: 'herb_b', count: 1 },
    });
    expect(dispatch).toHaveBeenNthCalledWith(4, {
      type: 'MODIFY_PARTY_HEALTH',
      payload: {
        amount: -6,
        characterIds: ['party-lead', 'party-ally'],
      },
    });
  });

  it('supports drag-and-drop ingredient staging into the cauldron', () => {
    const lead = makeCharacter('party-lead', 'Party Lead');
    const dispatch = vi.fn();

    useGameStateMock.mockReturnValue({
      state: {
        party: [lead],
        inventory: [
          { id: 'herb_a', name: 'Herb A', quantity: 2 },
          { id: 'herb_b', name: 'Herb B', quantity: 1 },
        ],
      },
      dispatch,
    });

    render(
      <ExperimentPanel
        progression={{ knownRecipes: new Set(), bonusModifier: 1 } as unknown as CrafterProgression}
        onProgressionUpdate={vi.fn()}
      />
    );

    const herbAButton = screen.getByRole('button', { name: /Herb A/i });
    const herbBButton = screen.getByRole('button', { name: /Herb B/i });
    const cauldron = screen.getByTestId('alchemy-cauldron');
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(herbAButton, { dataTransfer });
    fireEvent.dragOver(cauldron, { dataTransfer });
    fireEvent.drop(cauldron, { dataTransfer });

    fireEvent.dragStart(herbAButton, { dataTransfer });
    fireEvent.dragOver(cauldron, { dataTransfer });
    fireEvent.drop(cauldron, { dataTransfer });

    fireEvent.dragStart(herbBButton, { dataTransfer });
    fireEvent.dragOver(cauldron, { dataTransfer });
    fireEvent.drop(cauldron, { dataTransfer });

    fireEvent.click(screen.getByRole('button', { name: /Experiment/i }));

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(attemptExperiment).toHaveBeenCalledWith(['herb_a', 'herb_a', 'herb_b'], expect.any(Number), expect.any(Set));
  });
});
