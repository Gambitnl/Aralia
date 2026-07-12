/**
 * This file proves that the race picker restores the character draft when a
 * player returns from a later creation step. It protects the manual creator
 * from displaying and confirming a different default race after Back.
 *
 * Called by: the focused Vitest character-creation verification.
 * Depends on: RaceSelection and Testing Library's rendered interaction helpers.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Race } from '../../../../types';
import RaceSelection from '../RaceSelection';

// These two small records reproduce the important ordering boundary: Aasimar
// sorts first, while Human is the race preserved in the character draft.
const races: Race[] = [
  {
    id: 'fallen_aasimar',
    name: 'Fallen Aasimar',
    description: 'A celestial descendant touched by shadow.',
    traits: ['Creature Type: Humanoid', 'Speed: 30 feet'],
  },
  {
    id: 'human',
    name: 'Human',
    description: 'A versatile and resourceful adventurer.',
    traits: ['Creature Type: Humanoid', 'Speed: 30 feet'],
  },
];

describe('RaceSelection draft restoration', () => {
  it('shows and confirms the saved race instead of the first race', () => {
    const onRaceSelect = vi.fn();

    // Rendering this component mirrors returning to Race with Human already
    // recorded in the parent character-creation state.
    render(
      <RaceSelection
        races={races}
        selectedRaceId="human"
        onRaceSelect={onRaceSelect}
      />,
    );

    const confirmHuman = screen.getByRole('button', { name: 'Confirm Human' });
    expect(confirmHuman).toBeEnabled();

    // Confirming without making a new selection must preserve the draft race.
    fireEvent.click(confirmHuman);
    expect(onRaceSelect).toHaveBeenCalledWith('human', {});
  });

  it('restores required Changeling skills and size when returning to Race', () => {
    const onRaceSelect = vi.fn();
    const changeling: Race = {
      id: 'changeling',
      name: 'Changeling',
      description: 'A fey shapechanger with adaptable instincts.',
      traits: [
        'Creature Type: Fey',
        'Size: Medium or Small. You choose the size when you select this race.',
        'Changeling Instincts: Choose two social skills.',
      ],
    };

    // These are the choices the parent reducer stored before the player moved
    // to Age and then returned with Back.
    render(
      <RaceSelection
        races={[...races, changeling]}
        selectedRaceId="changeling"
        racialSelections={{
          changeling: {
            skillIds: ['deception', 'insight'],
            size: 'Small',
          },
        }}
        onRaceSelect={onRaceSelect}
      />,
    );

    const confirmChangeling = screen.getByRole('button', { name: 'Confirm Changeling' });
    expect(confirmChangeling).toBeEnabled();
    fireEvent.click(confirmChangeling);

    expect(onRaceSelect).toHaveBeenCalledWith('changeling', {
      changelingInstinctSkillIds: ['deception', 'insight'],
      changelingSize: 'Small',
    });
  });
});
