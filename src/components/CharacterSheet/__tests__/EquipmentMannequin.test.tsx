
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import EquipmentMannequin from '../EquipmentMannequin';
// TODO(lint-intent): 'PlayerCharacter' is unused in this test; use it in the assertion path or remove it.
import { PlayerCharacter as _PlayerCharacter, Item } from '../../../types';
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock dependencies
vi.mock('../../../utils/characterUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCharacterMaxArmorProficiency: () => 'Heavy',
    getArmorCategoryHierarchy: () => 3,
    getAbilityModifierValue: () => 2,
  };
});

// Create a basic mock character
const mockCharacter = createMockPlayerCharacter();

describe('EquipmentMannequin', () => {
  it('renders emoji icons correctly', () => {
    const characterWithEmojiItem = {
      ...mockCharacter,
      equippedItems: {
        MainHand: {
          id: 'sword-1',
          name: 'Emoji Sword',
          type: 'weapon',
          icon: '⚔️',
          damageDice: '1d8',
        } as Item
      }
    };

    render(<EquipmentMannequin character={characterWithEmojiItem} />);

    // Should verify that the emoji is rendered
    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });

  it('renders image URL icons correctly', () => {
    const characterWithImgItem = {
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
    const characterWithDataItem = {
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

  it('handles slot clicks', () => {
    const onSlotClick = vi.fn();
    render(<EquipmentMannequin character={mockCharacter} onSlotClick={onSlotClick} />);

    const headSlot = screen.getByLabelText(/Empty Head Slot/i);
    fireEvent.click(headSlot);

    expect(onSlotClick).toHaveBeenCalledWith('Head', undefined);
  });
});
