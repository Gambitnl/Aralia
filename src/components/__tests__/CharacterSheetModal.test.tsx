import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterSheetModal from '../CharacterSheetModal';
import { Item, PlayerCharacter } from '../../types';

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref) => <div ref={ref} {...props} />),
  },
}));

vi.mock('../EquipmentMannequin', () => ({
  default: () => <div data-testid="equipment-mannequin">EquipmentMannequin</div>,
}));

vi.mock('../InventoryList', () => ({
  default: () => <div data-testid="inventory-list">InventoryList</div>,
}));

vi.mock('../CharacterSheet/SkillDetailDisplay', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="skill-detail-display">
        Skill Details
        <button onClick={onClose}>Close Skill Details</button>
      </div>
    ) : null,
}));

vi.mock('../SpellbookOverlay', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="spellbook-overlay">
        <button onClick={onClose}>Close Spellbook</button>
      </div>
    ) : null,
}));

vi.mock('../Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../SingleGlossaryEntryModal', () => ({
  default: () => null,
}));

vi.mock('../../data/feats/featsData', () => ({
  FEATS_DATA: [],
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

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Hero')).toBeInTheDocument();
    expect(screen.getByText('Vitals')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-mannequin')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
  });

  it('displays key character stats and ability scores', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    expect(screen.getByText(/HP:/)).toHaveTextContent('HP: 10 / 12');
    expect(screen.getByText(/AC:/)).toHaveTextContent('AC: 15');
    expect(screen.getByText(/Speed:/)).toHaveTextContent('Speed: 30ft');
    expect(screen.getByText(/Str:/)).toHaveTextContent('Str: 14');
    expect(screen.getByText('Second Wind')).toBeInTheDocument();
  });

  it('opens and closes the spellbook overlay via the tab control', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Spellbook' }));
    expect(screen.getByTestId('spellbook-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Spellbook'));
    expect(screen.queryByTestId('spellbook-overlay')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<CharacterSheetModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close character sheet'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles the skill detail overlay and closes it with Escape', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    expect(screen.queryByTestId('skill-detail-display')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('View Skill Details'));
    expect(screen.getByTestId('skill-detail-display')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('skill-detail-display')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
