/**
 * This test file verifies visual and interaction behavior of the EquipmentMannequin component.
 *
 * It validates:
 * - Rendering emoji fallbacks and image URL icons.
 * - Dynamic mannequin slot icon sizing and frame constraints.
 * - Non-proficiency warning badges and red border styling for mismatched weapons.
 * - Proper display without warning indicators for proficiently equipped weapons.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import EquipmentMannequin from '../Overview/EquipmentMannequin';
import { PlayerCharacter, Item } from '../../../types';
import { createMockPlayerCharacter } from '../../../utils/core';
import { ENV } from '../../../config/env';

// Mock dependencies for testing
vi.mock('../../../utils/character/characterUtils', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCharacterMaxArmorProficiency: () => 'Heavy',
    getArmorCategoryHierarchy: () => 3,
    getAbilityModifierValue: () => 2,
  };
});

// Create a basic mock character
const mockCharacter: PlayerCharacter = createMockPlayerCharacter();

describe('EquipmentMannequin', () => {
  it('renders emoji fallback when item image fails to load', () => {
    const characterWithEmojiItem: PlayerCharacter = {
      ...mockCharacter,
      equippedItems: {
        MainHand: {
          id: 'sword-1',
          name: 'Emoji Sword',
          type: 'weapon',
          visual: {
            iconPath: '/broken/image.png',
            fallbackIcon: '⚔️',
          },
          damageDice: '1d8',
        } as Item
      }
    };

    render(<EquipmentMannequin character={characterWithEmojiItem} />);

    // Initially attempts to load image
    const img = screen.getByAltText('Emoji Sword');
    expect(img).toBeInTheDocument();

    // Trigger error event to activate emoji fallback
    fireEvent.error(img);

    // Verify fallback emoji is rendered
    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });

  it('renders image URL icons correctly', () => {
    const characterWithImgItem: PlayerCharacter = {
      ...mockCharacter,
      equippedItems: {
        MainHand: {
          id: 'sword-2',
          name: 'Image Sword',
          type: 'weapon',
          icon: '/images/sword.png',
          damageDice: '1d8',
        } as Item
      }
    };

    render(<EquipmentMannequin character={characterWithImgItem} />);

    const img = screen.getByAltText('Image Sword');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/sword.png');
  });

  it('renders data-URI icons correctly', () => {
    const dataUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';
    const characterWithDataItem: PlayerCharacter = {
      ...mockCharacter,
      equippedItems: {
        MainHand: {
          id: 'sword-3',
          name: 'Data Sword',
          type: 'weapon',
          icon: dataUri,
          damageDice: '1d8',
        } as Item
      }
    };

    render(<EquipmentMannequin character={characterWithDataItem} />);

    const img = screen.getByAltText('Data Sword');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', dataUri);
  });

  it('renders catalog armor from the same base-aware SVG URL used by inventory rows', () => {
    const characterWithLeatherCap: PlayerCharacter = {
      ...mockCharacter,
      equippedItems: {
        Head: {
          id: 'leather_cap',
          name: 'Leather Cap',
          type: 'armor',
          icon: 'legacy-cap-symbol',
          slot: 'Head',
          armorCategory: 'Light',
        } as Item,
      },
    };

    render(<EquipmentMannequin character={characterWithLeatherCap} />);

    expect(screen.getByAltText('Leather Cap')).toHaveAttribute(
      'src',
      `${ENV.BASE_URL}assets/icons/general/armor/leather_cap.svg`,
    );
  });

  it('handles slot clicks', () => {
    const onSlotClick = vi.fn();
    render(<EquipmentMannequin character={mockCharacter} onSlotClick={onSlotClick} />);

    const headSlot = screen.getByLabelText(/Empty Head Slot/i);
    fireEvent.click(headSlot);

    expect(onSlotClick).toHaveBeenCalledWith('Head', undefined);
  });

  it('sizes the paper-doll frame and slots from the available column width', () => {
    render(<EquipmentMannequin character={mockCharacter} />);

    const headSlot = screen.getByLabelText(/Empty Head Slot/i);
    const mannequinFrame = headSlot.closest('[data-testid="equipment-mannequin-frame"]');

    expect(mannequinFrame).toHaveClass('w-full');
    expect(mannequinFrame).toHaveClass('max-w-[340px]');
    expect(mannequinFrame).toHaveClass('h-[480px]');
    expect(headSlot).toHaveClass('w-full');
    expect(headSlot).toHaveClass('aspect-square');
    expect(headSlot).toHaveClass('max-w-20');
  });

  it('keeps auto-equip large enough to tap in narrow character sheets', () => {
    render(<EquipmentMannequin character={mockCharacter} onAutoEquip={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Auto-equip best gear based on proficiencies' })).toHaveClass('min-h-11');
  });

  it('displays a non-proficiency warning badge and red styling when equipping a non-proficient weapon', () => {
    // Wizard without martial weapon proficiency equipping a Greatsword
    const wizardWithGreatsword: PlayerCharacter = {
      ...mockCharacter,
      class: {
        ...mockCharacter.class,
        id: 'wizard',
        name: 'Wizard',
        weaponProficiencies: ['Simple weapons'],
      },
      equippedItems: {
        MainHand: {
          id: 'greatsword-1',
          name: 'Greatsword',
          type: 'weapon',
          category: 'Martial Weapons',
          damageDice: '2d6',
          icon: '⚔️',
        } as Item,
      },
    };

    render(<EquipmentMannequin character={wizardWithGreatsword} />);

    // Slot button should include the proficiency warning in its aria-label / title
    const mainHandSlot = screen.getByRole('button', { name: /Proficiency Mismatch! Not Proficient — No Proficiency Bonus to Attacks/i });
    expect(mainHandSlot).toBeInTheDocument();
    expect(mainHandSlot).toHaveClass('border-red-500');

    // Warning badge icon should be rendered
    const warningBadge = screen.getByLabelText('Not Proficient');
    expect(warningBadge).toBeInTheDocument();
  });

  it('does not display proficiency mismatch warnings when equipping a proficient weapon', () => {
    // Fighter with martial proficiency equipping a Greatsword
    const fighterWithGreatsword: PlayerCharacter = {
      ...mockCharacter,
      class: {
        ...mockCharacter.class,
        id: 'fighter',
        name: 'Fighter',
        weaponProficiencies: ['Simple weapons', 'Martial weapons'],
      },
      equippedItems: {
        MainHand: {
          id: 'greatsword-2',
          name: 'Greatsword',
          type: 'weapon',
          category: 'Martial Weapons',
          damageDice: '2d6',
          icon: '⚔️',
        } as Item,
      },
    };

    render(<EquipmentMannequin character={fighterWithGreatsword} />);

    // No warning badge should be present
    expect(screen.queryByLabelText('Not Proficient')).not.toBeInTheDocument();

    // Slot button should not indicate proficiency mismatch
    const mainHandSlot = screen.getByRole('button', { name: /Greatsword \(In Main Hand\)/i });
    expect(mainHandSlot).toBeInTheDocument();
    expect(mainHandSlot).not.toHaveClass('border-red-500');
  });
});
