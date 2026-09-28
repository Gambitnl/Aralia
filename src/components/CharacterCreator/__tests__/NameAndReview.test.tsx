/**
 * This file verifies that the final character-creation review exposes required
 * species choices. The review is the player's last chance to catch a wrong
 * Changeling size before the character enters the generated world.
 *
 * Called by: focused Character Creator Vitest verification.
 * Depends on: NameAndReview, the core character factory, and live race/class data.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SpellContext from '../../../context/SpellContext';
import { CLASSES_DATA, RACES_DATA } from '../../../constants';
import { createMockPlayerCharacter } from '../../../utils/core/factories';
import NameAndReview from '../NameAndReview';
import { findSubclass } from '../../../data/classes/subclasses';

// NameAndReview only needs an empty spell registry for this non-spellcasting
// character; the methods preserve the real context contract without fixtures.
const emptySpells = {
  get: vi.fn(),
  all: [],
  getByLevel: vi.fn(() => []),
  getByIds: vi.fn(() => []),
  getBySchool: vi.fn(() => []),
  // The test intentionally supplies the smallest spell context implementation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('NameAndReview racial choices', () => {
  it('shows the persisted Changeling size', () => {
    const changeling = createMockPlayerCharacter({
      race: RACES_DATA.changeling,
      class: CLASSES_DATA.rogue,
      racialSelections: {
        changeling: {
          skillIds: ['deception', 'insight'],
          size: 'Small',
        },
      },
    });

    render(
      <SpellContext.Provider value={emptySpells}>
        <NameAndReview
          characterPreview={changeling}
          onConfirm={vi.fn()}
          visualDescription=""
          onVisualDescriptionChange={vi.fn()}
          portraitsEnabled={false}
          portrait={{ status: 'idle', url: null, error: null, requestedForName: null }}
          onGeneratePortrait={vi.fn()}
          onCancelPortrait={vi.fn()}
          onClearPortrait={vi.fn()}
          onBack={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    expect(screen.getByText('Species Size:')).toBeInTheDocument();
    expect(screen.getByText('Small')).toBeInTheDocument();
  });
});

describe('NameAndReview level-1 subclass row', () => {
  /** Renders the review for a character carrying the given level-1 subclass. */
  const renderWithSubclass = (classId: keyof typeof CLASSES_DATA, subclassId?: string) => {
    const character = createMockPlayerCharacter({
      race: RACES_DATA.human,
      class: CLASSES_DATA[classId],
      subclassId,
    });

    render(
      <SpellContext.Provider value={emptySpells}>
        <NameAndReview
          characterPreview={character}
          onConfirm={vi.fn()}
          visualDescription=""
          onVisualDescriptionChange={vi.fn()}
          portraitsEnabled={false}
          portrait={{ status: 'idle', url: null, error: null, requestedForName: null }}
          onGeneratePortrait={vi.fn()}
          onCancelPortrait={vi.fn()}
          onClearPortrait={vi.fn()}
          onBack={vi.fn()}
        />
      </SpellContext.Provider>,
    );
  };

  it('names the 2014 warlock patron instead of printing its id', () => {
    renderWithSubclass('warlock', 'archfey');

    const expected = findSubclass('warlock', 'archfey')?.name;
    expect(expected).toBeTruthy();
    expect(screen.getByText('Patron:')).toBeInTheDocument();
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    expect(screen.queryByText('archfey')).not.toBeInTheDocument();
  });

  it('shows the 2014 cleric Divine Domain', () => {
    renderWithSubclass('cleric', 'life_domain');

    expect(screen.getByText('Divine Domain:')).toBeInTheDocument();
    expect(screen.getByText(findSubclass('cleric', 'life_domain')!.name)).toBeInTheDocument();
  });

  it('shows the 2014 sorcerer Sorcerous Origin', () => {
    renderWithSubclass('sorcerer', 'draconic');

    expect(screen.getByText('Sorcerous Origin:')).toBeInTheDocument();
    expect(screen.getByText(findSubclass('sorcerer', 'draconic')!.name)).toBeInTheDocument();
  });

  it('shows no subclass row under 2024 rules, where no subclass is picked at level 1', () => {
    renderWithSubclass('warlock', undefined);

    expect(screen.queryByText('Patron:')).not.toBeInTheDocument();
    expect(screen.queryByText('Divine Domain:')).not.toBeInTheDocument();
    expect(screen.queryByText('Sorcerous Origin:')).not.toBeInTheDocument();
    expect(screen.queryByText('Subclass:')).not.toBeInTheDocument();
  });
});
