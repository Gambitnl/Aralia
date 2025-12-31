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

vi.mock('../EquipmentMannequin', () => ({
  default: () => <div data-testid="equipment-mannequin">EquipmentMannequin</div>,
}));

vi.mock('../InventoryList', () => ({
  default: () => <div data-testid="inventory-list">InventoryList</div>,
}));

vi.mock('../SkillDetailDisplay', () => ({
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

vi.mock('../CharacterOverview', () => ({
  default: ({ onOpenSkillDetails }: { onOpenSkillDetails: () => void }) => (
    <div data-testid="character-overview">
      <button onClick={onOpenSkillDetails}>Skills</button>
    </div>
  ),
}));

vi.mock('../../Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../Glossary/SingleGlossaryEntryModal', () => ({
  default: () => null,
}));

vi.mock('../../../data/feats/featsData', () => ({
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
    expect(screen.getByTestId('equipment-mannequin')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
  });

  // The below test has been removed because the text content is now rendered inside
  // CharacterOverview (which is mocked in this test suite).
  // CharacterOverview has its own dedicated test file (CharacterOverview.test.tsx).
  // Removing duplicate integration assertion here to focus on modal structure.

  // it('displays key character stats and ability scores', () => { ... });

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

  it('closes the spellbook overlay with Escape while keeping the modal open', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Spellbook' }));
    expect(screen.getByTestId('spellbook-overlay')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('spellbook-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('returns null when closed or without a character', () => {
    const { rerender } = render(<CharacterSheetModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<CharacterSheetModal {...defaultProps} character={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles the skill detail overlay and closes it with Escape', () => {
    render(<CharacterSheetModal {...defaultProps} />);

    expect(screen.queryByTestId('skill-detail-display')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Skills'));
    expect(screen.getByTestId('skill-detail-display')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('skill-detail-display')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
