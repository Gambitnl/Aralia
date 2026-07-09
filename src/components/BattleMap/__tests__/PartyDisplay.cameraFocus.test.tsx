import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PartyDisplay from '../PartyDisplay';
import type { CombatCharacter } from '../../../types/combat';

/**
 * These tests protect the roster-to-map camera shortcut.
 *
 * The Party panel is visually separate from the BattleMap canvas, but players
 * expect each roster row to be a reliable way to find the matching creature on
 * a large scrollable board. These tests keep the small focus button from
 * accidentally behaving like the whole-card selection button.
 */

const makeCharacter = (id: string, name: string, team: 'player' | 'enemy'): CombatCharacter => ({
  id,
  name,
  team,
  position: { x: 6, y: 4 },
  currentHP: 10,
  maxHP: 10,
  class: {
    id: team === 'player' ? 'fighter' : 'creature',
    name: team === 'player' ? 'Fighter' : 'Creature'
  },
  abilities: [],
  statusEffects: [],
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    speed: 30,
    baseInitiative: 0
  },
  actionEconomy: {
    action: { used: false },
    bonusAction: { used: false },
    reaction: { used: false },
    movement: { used: 0, total: 30 }
  }
} as unknown as CombatCharacter);

describe('PartyDisplay camera focus controls', () => {
  it('asks the map camera to center on the matching party character without selecting the card', () => {
    const onCharacterSelect = vi.fn();
    const onCenterCharacter = vi.fn();
    const hero = makeCharacter('hero', 'Elara Hawthorne', 'player');

    render(
      <PartyDisplay
        characters={[hero]}
        onCharacterSelect={onCharacterSelect}
        onCharacterInspect={vi.fn()}
        currentTurnCharacterId={null}
        autoCharacters={new Set()}
        onToggleAuto={vi.fn()}
        onCenterCharacter={onCenterCharacter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Center map on Elara Hawthorne' }));

    expect(onCenterCharacter).toHaveBeenCalledWith('hero');
    expect(onCharacterSelect).not.toHaveBeenCalled();
  });
});
