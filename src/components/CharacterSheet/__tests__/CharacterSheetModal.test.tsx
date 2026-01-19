import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterSheetModal from '../CharacterSheetModal';
import { Item, PlayerCharacter } from '../../../types';

vi.mock('framer-motion', () => {
  const MotionDiv = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>((props, ref) => (
    <div ref={ref} {...props} />
  ));
  MotionDiv.displayName = 'MotionDiv';
  return {
    motion: {
      div: MotionDiv,
    },
  };
});

vi.mock('../Overview', () => ({
  CharacterOverview: () => <div data-testid="character-overview">CharacterOverview</div>,
  EquipmentMannequin: () => <div data-testid="equipment-mannequin">EquipmentMannequin</div>,
  InventoryList: () => <div data-testid="inventory-list">InventoryList</div>,
}));

vi.mock('../Skills', () => ({
  SkillsTab: () => <div data-testid="skills-tab">SkillsTab</div>,
}));

vi.mock('../Details', () => ({
  CharacterDetailsTab: () => <div data-testid="details-tab">DetailsTab</div>,
}));

vi.mock('../Family', () => ({
  FamilyTreeTab: () => <div data-testid="family-tab">FamilyTab</div>,
}));

vi.mock('../Spellbook', () => ({
  SpellbookTab: () => <div data-testid="spellbook-tab">SpellbookTab</div>,
}));

vi.mock('../Crafting', () => ({
  CraftingTab: () => <div data-testid="crafting-tab">CraftingTab</div>,
}));

vi.mock('../Journal', () => ({
  JournalTab: () => <div data-testid="journal-tab">JournalTab</div>,
}));

describe('CharacterSheetModal', () => {
  const baseCharacter: PlayerCharacter = {
    id: 'hero-1',
    name: 'Test Hero',
    race: { id: 'human', name: 'Human', description: '', traits: ['Adaptive'] },
    class: {
      id: 'fighter',
      name: 'Fighter',
      description: '',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: ['Strength'],
      skillProficienciesAvailable: ['Athletics'],
      numberOfSkillProficiencies: 2,
      armorProficiencies: ['Light'],
      weaponProficiencies: ['Simple'],
      features: [{ id: 'feature-1', name: 'Second Wind', description: 'Recover hp', levelAvailable: 1 }],
    },
    abilityScores: {
      Strength: 14,
      Dexterity: 12,
      Constitution: 13,
      Intelligence: 10,
      Wisdom: 11,
      Charisma: 8,
    },
    finalAbilityScores: {
      Strength: 14,
      Dexterity: 12,
      Constitution: 13,
      Intelligence: 10,
      Wisdom: 11,
      Charisma: 8,
    },
    skills: [{ id: 'athletics', name: 'Athletics', ability: 'Strength' }],
    feats: [],
    statusEffects: [],
    hp: 10,
    maxHp: 12,
    armorClass: 15,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    spellcastingAbility: 'wisdom',
    proficiencyBonus: 2,
    spellbook: {
      cantrips: ['guidance'],
      preparedSpells: ['bless'],
      knownSpells: ['cure-wounds'],
    },
    equippedItems: {},
  };

  const inventory: Item[] = [
    { id: 'sword', name: 'Shortsword', description: '', type: 'weapon' },
  ];

  const defaultProps = {
    isOpen: true,
    character: baseCharacter,
    inventory,
    gold: 5,
    onClose: vi.fn(),
    onAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders core sections and character name when open', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    expect(screen.getByText('Test Hero')).toBeInTheDocument();
    expect(screen.getByTestId('character-overview')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-mannequin')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
  });

  // The below test has been removed because the text content is now rendered inside
  // CharacterOverview (which is mocked in this test suite).
  // CharacterOverview has its own dedicated test file (CharacterOverview.test.tsx).
  // Removing duplicate integration assertion here to focus on modal structure.

  // it('displays key character stats and ability scores', () => { ... });

  it('opens and closes the spellbook tab via the tab control', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Spellbook' }));
    expect(screen.getByTestId('spellbook-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.queryByTestId('spellbook-tab')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CharacterSheetModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches to the skills tab and back to overview', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(screen.getByTestId('skills-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.queryByTestId('skills-tab')).not.toBeInTheDocument();
    expect(screen.getByTestId('character-overview')).toBeInTheDocument();
  });

  it('returns null when closed or without a character', () => {
    const { rerender } = render(<CharacterSheetModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<CharacterSheetModal {...defaultProps} character={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches to the spellbook tab and keeps the window open', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Spellbook' }));
    expect(screen.getByTestId('spellbook-tab')).toBeInTheDocument();
    expect(screen.getByText('Test Hero')).toBeInTheDocument();
  });
});
