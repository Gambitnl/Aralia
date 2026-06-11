/**
 * This test file protects the developer party editor's premade roster controls.
 *
 * The editor is used to assemble test parties from real saved character JSON,
 * so these tests focus on the user-visible roster actions instead of the
 * lower-level manifest loader. The premade service is mocked here because the
 * service has its own filesystem-backed coverage and this file needs to prove
 * the modal wires roster actions into editable party rows.
 *
 * Called by: Vitest focused component checks.
 * Depends on: PartyEditorModal and mocked premadeCharacterService responses.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCharacter } from '../../../types';
import PartyEditorModal from '../PartyEditorModal';

// ============================================================================
// Test Doubles
// ============================================================================
// These mocks keep the test on the party editor behavior. The real premade
// service still has separate coverage against the public manifest files.
// ============================================================================

const serviceMocks = vi.hoisted(() => ({
  canSavePremadeCharacters: vi.fn(),
  loadPremadeCharacter: vi.fn(),
  loadPremadeManifest: vi.fn(),
  savePremadeCharacter: vi.fn(),
}));

const idMocks = vi.hoisted(() => ({
  nextId: 0,
  generateId: vi.fn(() => {
    idMocks.nextId += 1;
    return `generated-${idMocks.nextId}`;
  }),
}));

vi.mock('../../../services/premadeCharacterService', () => serviceMocks);

vi.mock('../../../utils/core/idGenerator', () => ({
  generateId: idMocks.generateId,
}));

vi.mock('../../ui/WindowFrame', () => ({
  WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

// ============================================================================
// Fixtures
// ============================================================================
// The modal only needs enough character data to create editable rows, but the
// fixture still resembles real PlayerCharacter data so the test stays honest.
// ============================================================================

const premadeSummaries = [
  {
    filename: 'thalren_deeproot.json',
    name: 'Thalren Deeproot',
    race: 'Earth Genasi',
    className: 'Monk',
    level: 1,
    description: 'A reclusive hermit who channels stone.',
  },
  {
    filename: 'kael_ironvow.json',
    name: 'Kael Ironvow',
    race: 'Half-Orc',
    className: 'Fighter',
    level: 1,
    description: 'A disciplined soldier with a shield.',
  },
];

function makeCharacter(name: string, classId: string, className: string): PlayerCharacter {
  // Keep the fixture compact while preserving the fields PartyEditorModal reads.
  return {
    id: `${classId}-fixture`,
    name,
    race: { id: 'human', name: 'Human', description: '', traits: [] },
    class: {
      id: classId,
      name: className,
      description: '',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: ['Strength'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 2,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: [],
    },
    level: 1,
    hp: 10,
    maxHp: 10,
    armorClass: 12,
    abilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    finalAbilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    proficiencyBonus: 2,
    skills: [],
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    statusEffects: [],
  } as PlayerCharacter;
}

function renderEditor() {
  // Start with one existing member so the editor does not fall back to dummy data.
  return render(
    <PartyEditorModal
      isOpen
      onClose={vi.fn()}
      initialParty={[makeCharacter('Existing Tester', 'rogue', 'Rogue')]}
      onSave={vi.fn()}
      onSaveFullParty={vi.fn()}
    />
  );
}

// ============================================================================
// Bulk Premade Loading
// ============================================================================
// A developer should be able to add the entire currently available roster with
// one action while preserving the existing per-character add buttons.
// ============================================================================

describe('PartyEditorModal premade roster', () => {
  beforeEach(() => {
    // Reset every mocked dependency so each test describes one clean editor open.
    vi.clearAllMocks();
    idMocks.nextId = 0;
    serviceMocks.canSavePremadeCharacters.mockReturnValue(false);
    serviceMocks.loadPremadeManifest.mockResolvedValue({ characters: premadeSummaries });
    serviceMocks.loadPremadeCharacter.mockImplementation(async (filename: string) => {
      if (filename === 'thalren_deeproot.json') {
        return makeCharacter('Thalren Deeproot', 'monk', 'Monk');
      }
      if (filename === 'kael_ironvow.json') {
        return makeCharacter('Kael Ironvow', 'fighter', 'Fighter');
      }
      return null;
    });
  });

  it('shows a bulk add action when the premade roster is open', async () => {
    renderEditor();

    // Open the roster after the manifest count appears.
    fireEvent.click(await screen.findByRole('button', { name: 'Browse (2)' }));

    expect(screen.getByRole('button', { name: 'Add All Premade Characters' })).toBeInTheDocument();
  });

  it('adds every available premade character through one roster action', async () => {
    renderEditor();

    // Use the new bulk action instead of clicking each premade card manually.
    fireEvent.click(await screen.findByRole('button', { name: 'Browse (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add All Premade Characters' }));

    await waitFor(() => {
      expect(serviceMocks.loadPremadeCharacter).toHaveBeenCalledTimes(2);
    });

    expect(serviceMocks.loadPremadeCharacter).toHaveBeenNthCalledWith(1, 'thalren_deeproot.json');
    expect(serviceMocks.loadPremadeCharacter).toHaveBeenNthCalledWith(2, 'kael_ironvow.json');
    expect(screen.getByDisplayValue('Thalren Deeproot')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kael Ironvow')).toBeInTheDocument();
    expect(screen.getByText(/Loaded 2 premade characters/)).toBeInTheDocument();
  });
});
