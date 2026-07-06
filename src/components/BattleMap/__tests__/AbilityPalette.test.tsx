import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AbilityPalette from '../AbilityPalette';
import { Ability, CombatCharacter } from '../../../types/combat';

/**
 * This file checks the battle-map ability palette's generated follow-up buttons.
 *
 * The palette turns spell-granted actions into temporary combat abilities so the
 * player can click them like ordinary actions. These tests make sure important
 * runtime metadata survives that translation before the button reaches targeting
 * and command execution.
 *
 * Called by: focused BattleMap component tests.
 * Depends on: AbilityPalette and a mocked AbilityButton that exposes generated
 * ability props without depending on visuals or animation.
 */

const renderedAbilities: Ability[] = [];

vi.mock('../AbilityButton', () => ({
  default: ({ ability }: { ability: Ability }) => {
    // The real button renders visuals and motion. This mock records the ability
    // object exactly as the palette generated it, which is the metadata contract
    // this test cares about.
    renderedAbilities.push(ability);
    return <button type="button">{ability.name}</button>;
  }
}));

describe('AbilityPalette generated granted-action abilities', () => {
  beforeEach(() => {
    renderedAbilities.length = 0;
  });

  it('marks generated spell-attack granted actions as spell attacks', () => {
    const wallOfLight: Ability = {
      id: 'wall-of-light',
      name: 'Wall of Light',
      description: 'Creates a wall and grants a radiant beam follow-up.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'area',
      range: 120,
      effects: [],
      grantedActions: [{
        type: 'action',
        action: 'Launch Radiant Beam',
        frequency: 'each_turn',
        actor: 'caster',
        attackType: 'ranged_spell_attack',
        rangeLimit: 60,
        prerequisites: ['target_within_spell_range'],
        damage: {
          dice: '4d8',
          type: 'Radiant'
        }
      }]
    };
    const character = {
      id: 'caster',
      name: 'Caster',
      abilities: [wallOfLight]
    } as unknown as CombatCharacter;

    render(
      <AbilityPalette
        character={character}
        onSelectAbility={vi.fn()}
        canAffordAction={() => true}
      />
    );

    const generatedBeam = renderedAbilities.find(ability => ability.name === 'Launch Radiant Beam');

    // The generated button still executes through GrantedActionCommand, but it
    // must advertise spell-attack identity so shared rider logic does not treat
    // it like a ranged weapon attack.
    expect(generatedBeam).toEqual(expect.objectContaining({
      sourceSpellId: 'wall-of-light',
      attackType: 'spell',
      targeting: 'single_enemy',
      range: 12
    }));
  });

  it('keeps the popout trigger large enough for cramped combat rails', () => {
    const character = {
      id: 'fighter',
      name: 'Fighter',
      abilities: [{
        id: 'strike',
        name: 'Strike',
        description: 'A basic attack.',
        type: 'weapon',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        effects: []
      }]
    } as unknown as CombatCharacter;

    render(
      <AbilityPalette
        character={character}
        onSelectAbility={vi.fn()}
        canAffordAction={() => true}
      />
    );

    const popoutButton = screen.getByRole('button', {
      name: /pop out abilities into resizable window/i,
    });

    // The popout button sits in the narrow command rail during 2D combat, so it
    // needs the same touch target floor as the other combat panel controls.
    expect(popoutButton).toHaveClass('h-11');
    expect(popoutButton).toHaveClass('w-11');
    expect(popoutButton).toHaveClass('items-center');
    expect(popoutButton).toHaveClass('justify-center');
  });
});
