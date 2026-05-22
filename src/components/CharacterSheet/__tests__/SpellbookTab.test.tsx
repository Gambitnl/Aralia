import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellbookTab from '../Spellbook/SpellbookTab';
import SpellContext from '../../../context/SpellContext';
import { PlayerCharacter, Spell } from '../../../types';

describe('SpellbookTab', () => {
  const mockAction = vi.fn();

  const mockSpells: Record<string, Spell> = {
    'cantrip-1': {
      id: 'cantrip-1', name: 'Test Cantrip', level: 0, school: 'Evocation',
      classes: ['wizard'], subClasses: [], description: 'Test',
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 30, distanceUnit: 'ft' },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false },
      targeting: { type: 'single' } as any,
      effects: []
    },
    'spell-1': {
      id: 'spell-1', name: 'Test Spell 1', level: 1, school: 'Evocation',
      classes: ['wizard'], subClasses: [], description: 'Test',
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 30, distanceUnit: 'ft' },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false },
      targeting: { type: 'single' } as any,
      effects: []
    },
    'spell-2': {
        id: 'spell-2', name: 'Test Spell 2', level: 1, school: 'Abjuration',
        classes: ['wizard'], subClasses: [], description: 'Test',
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'self', distance: 0 },
        components: { verbal: true, somatic: true, material: false },
        duration: { type: 'instantaneous', concentration: false },
        targeting: { type: 'self' } as any,
        effects: []
      }
  };

  const mockContext = {
    ...mockSpells,
    all: Object.values(mockSpells),
    get: (id: string) => mockSpells[id],
    getByLevel: vi.fn(),
    getByIds: vi.fn(),
    getBySchool: vi.fn(),
  } as any;

  const baseCharacter: PlayerCharacter = {
    level: 1,
    id: 'hero-1',
    name: 'Test Hero',
    race: { id: 'human', name: 'Human', description: '', traits: [] },
    class: {
      id: 'wizard',
      name: 'Wizard',
      description: '',
      hitDie: 6,
      primaryAbility: ['Intelligence'],
      savingThrowProficiencies: ['Intelligence'],
      skillProficienciesAvailable: ['Arcana'],
      numberOfSkillProficiencies: 2,
      armorProficiencies: [],
      weaponProficiencies: ['Simple'],
      features: [],
      spellcasting: {
          ability: 'Intelligence',
          knownCantrips: 3,
          knownSpellsL1: 6,
          spellList: ['cantrip-1', 'spell-1', 'spell-2']
      }
    },
    abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 10, Charisma: 10 },
    finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 10, Charisma: 10 },
    skills: [],
    feats: [],
    statusEffects: [],
    hp: 6,
    maxHp: 6,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    spellcastingAbility: 'intelligence',
    proficiencyBonus: 2,
    spellbook: {
      cantrips: ['cantrip-1'],
      preparedSpells: ['spell-1'],
      knownSpells: ['cantrip-1', 'spell-1', 'spell-2'],
    },
    spellSlots: { level_1: { current: 2, max: 2 } },
    equippedItems: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cantrips correctly without prep buttons', () => {
    render(
      <SpellContext.Provider value={mockContext}>
        <SpellbookTab character={baseCharacter} onAction={mockAction} />
      </SpellContext.Provider>
    );

    expect(screen.queryAllByText('Test Cantrip').length).toBeGreaterThan(0);
    // Cantrips don't get Prep/Unprep
    expect(screen.queryByText('Prep')).not.toBeInTheDocument();
    expect(screen.queryByText('Unprep')).not.toBeInTheDocument();
  });

  it('renders prepared and unprepared spells with correct labels', () => {
    render(
      <SpellContext.Provider value={mockContext}>
        <SpellbookTab character={baseCharacter} onAction={mockAction} />
      </SpellContext.Provider>
    );

    // Switch to Level 1 tab
    fireEvent.click(screen.getByRole('button', { name: 'Lvl 1' }));

    expect(screen.queryAllByText('Test Spell 1').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Test Spell 2').length).toBeGreaterThan(0);

    // Since spell-1 is prepared, it should have an Unprep button available on hover
    // Because visibility is hover based, it still exists in the dom
    const unprepButton = screen.getByRole('button', { name: 'Unprep' });
    expect(unprepButton).toBeInTheDocument();

    // Spell-2 is unprepared
    const prepButton = screen.getByRole('button', { name: 'Prep' });
    expect(prepButton).toBeInTheDocument();
    expect(screen.getByText('Unprepared')).toBeInTheDocument();
  });

  it('hides prep buttons for known casters', () => {
    // Override type as any to mock classLevels easily. Real data comes with classLevels.
    const knownCasterChar = { ...baseCharacter, classLevels: { bard: 1 }, class: { ...baseCharacter.class, id: 'bard' }, spellbook: { cantrips: ['cantrip-1'], preparedSpells: ['spell-1', 'spell-2'], knownSpells: ['spell-1', 'spell-2'] } } as any;

    render(
      <SpellContext.Provider value={mockContext}>
        <SpellbookTab character={knownCasterChar} onAction={mockAction} />
      </SpellContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lvl 1' }));

    // Bards are known casters, so their maxPrepared is null and no Prep/Unprep buttons show
    expect(screen.queryAllByRole('button', { name: 'Prep' }).length).toBe(0);
    expect(screen.queryAllByRole('button', { name: 'Unprep' }).length).toBe(0);
  });
});
