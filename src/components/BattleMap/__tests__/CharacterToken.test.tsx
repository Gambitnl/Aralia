/**
 * These tests pin the compact token-level defense badges that G20 now exposes.
 *
 * The goal is not to retest combat math. The badge row simply mirrors the
 * existing resistance, vulnerability, and immunity fields in a tiny overlay so
 * players do not have to open the inspector for every target check. The tests
 * keep that presentation slice visible while leaving the 3D follow-up for a
 * later parity pass.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CharacterToken from '../CharacterToken';
import type { CombatCharacter } from '../../../types/combat';

const buildCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'token-1',
  name: 'Target',
  level: 3,
  class: { id: 'fighter', name: 'Fighter' } as CombatCharacter['class'],
  position: { x: 2, y: 1 },
  stats: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 10,
    speed: 30,
    baseInitiative: 0,
    size: 'Medium'
  } as CombatCharacter['stats'],
  abilities: [],
  team: 'enemy',
  currentHP: 22,
  maxHP: 22,
  initiative: 10,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 0
  },
  ...overrides
});

describe('CharacterToken defense badges', () => {
  it('renders compact resistance, vulnerability, and immunity badges with tooltip summaries', () => {
    render(
      <CharacterToken
        character={buildCharacter({
          resistances: ['fire'],
          nonMagicalResistances: ['bludgeoning'],
          vulnerabilities: ['cold'],
          immunities: ['necrotic'],
          nonMagicalImmunities: ['piercing', 'slashing']
        })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    const resistanceBadge = screen.getByTestId('defense-badge-resistance');
    const vulnerabilityBadge = screen.getByTestId('defense-badge-vulnerability');
    const immunityBadge = screen.getByTestId('defense-badge-immunity');

    expect(resistanceBadge).toHaveTextContent('R');
    expect(resistanceBadge).toHaveClass('left-0', 'top-0');
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Resistance: fire'));
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical resistance: bludgeoning'));

    expect(vulnerabilityBadge).toHaveTextContent('V');
    expect(vulnerabilityBadge).toHaveClass('left-0', 'top-1/2');
    expect(vulnerabilityBadge).toHaveAttribute('aria-label', 'Vulnerability: cold');

    expect(immunityBadge).toHaveTextContent('I');
    expect(immunityBadge).toHaveClass('left-0', 'bottom-0');
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Immunity: necrotic'));
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical immunity: piercing, slashing'));
  });

  it('keeps the token clear when a character has no damage traits to expose', () => {
    render(
      <CharacterToken
        character={buildCharacter()}
        position={{ x: 1, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.queryByTestId('defense-badge-resistance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-vulnerability')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-immunity')).not.toBeInTheDocument();
  });
});

describe('CharacterToken status and concentration markers', () => {
  it('renders named status and concentration markers for spell effects', () => {
    render(
      <CharacterToken
        character={buildCharacter({
          statusEffects: [{
            id: 'enhance-ability-bear',
            name: 'Enhance Ability: Bear',
            type: 'buff',
            duration: 10,
            source: 'Enhance Ability'
          }],
          concentratingOn: {
            spellId: 'enhance-ability',
            spellName: 'Enhance Ability',
            spellLevel: 2,
            startedTurn: 3,
            effectIds: ['enhance-ability-bear'],
            canDropAsFreeAction: true
          }
        })}
        position={{ x: 2, y: 1 }}
        isSelected={false}
        isTargetable={false}
        targetingMode={false}
        isTurn={false}
        onCharacterClick={() => undefined}
      />
    );

    expect(screen.getByLabelText('Enhance Ability: Bear status marker')).toBeInTheDocument();
    expect(screen.getByLabelText('Concentrating on Enhance Ability')).toBeInTheDocument();
  });
});
