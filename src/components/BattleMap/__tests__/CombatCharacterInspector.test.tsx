/**
 * This file proves the shared combat inspector presents the right panel identity.
 *
 * Enemy combatants receive the requested Monster Info title, while allies use
 * the broader Combatant Info title. Both presentations continue to read the
 * same live CombatCharacter facts inside the shared panel.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { applyGrappledCondition } from '../../../utils/combat/grappleUtils';
import { CombatCharacterInspector } from '../CombatCharacterInspector';

vi.mock('../../ui/WindowFrame', () => ({
  WindowFrame: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

describe('CombatCharacterInspector title', () => {
  it('labels an enemy as Monster Info and renders its live combat facts', () => {
    const enemy = createMockCombatCharacter({
      id: 'ogre',
      name: 'Ogre Brute',
      team: 'enemy',
      currentHP: 31,
      maxHP: 59,
      armorClass: 11,
    });

    render(<CombatCharacterInspector character={enemy} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Monster Info · Ogre Brute' })).toBeInTheDocument();
    expect(screen.getByText('31 / 59 HP')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('labels a player character as Combatant Info', () => {
    const ally = createMockCombatCharacter({
      id: 'fighter',
      name: 'Player Fighter',
      team: 'player',
    });

    render(<CombatCharacterInspector character={ally} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Combatant Info · Player Fighter' })).toBeInTheDocument();
  });

  it('describes a maintained grapple without a false round countdown or Restrained implication', () => {
    const target = applyGrappledCondition(createMockCombatCharacter({
      id: 'escape-target',
      name: 'Escape Target',
      team: 'enemy',
    }), {
      grapplerId: 'grappler',
      escapeDc: 13,
    });

    render(<CombatCharacterInspector character={target} onClose={vi.fn()} />);

    // Both legacy mirrors remain visible, but each now explains the maintained
    // end rule instead of exposing the old arbitrary "9r" implementation detail.
    expect(screen.getAllByText((text) => (
      text.includes('Grappled') && text.includes('until escape/release')
    ))).toHaveLength(2);
    expect(screen.queryByText(/Grappled 9r/)).not.toBeInTheDocument();
    expect(screen.getByText(/Attacks against anyone other than the grappler have disadvantage/))
      .toHaveTextContent('Grappled does not also apply Restrained');
  });
});
