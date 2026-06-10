/**
 * This test protects the 3D defense-badge parity slice.
 *
 * The battle map already exposes resistance, vulnerability, and immunity on
 * the 2D token layer. This spec keeps the 3D actor layer honest by proving the
 * same facts appear as a compact always-on overlay and disappear when a
 * character has no matching traits.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CharacterActor from '../CharacterActor';
import type { CombatCharacter } from '../../../../types/combat';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-html">{children}</div>
}));

const buildCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'actor-1',
  name: 'Target',
  class: { id: 'fighter', name: 'Fighter' } as CombatCharacter['class'],
  position: { x: 1, y: 1 },
  currentHP: 18,
  maxHP: 18,
  initiative: 10,
  team: 'enemy',
  abilities: [],
  statusEffects: [],
  stats: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 10,
    speed: 30,
    baseInitiative: 0
  } as CombatCharacter['stats'],
  actionEconomy: {
    action: {},
    bonusAction: {},
    reaction: {},
    movement: {}
  },
  ...overrides
} as unknown as CombatCharacter);

describe('CharacterActor defense badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 3D resistance, vulnerability, and immunity badge row with tooltip summaries', () => {
    render(
      <CharacterActor
        character={buildCharacter({
          resistances: ['fire'],
          nonMagicalResistances: ['bludgeoning'],
          vulnerabilities: ['cold'],
          immunities: ['necrotic'],
          nonMagicalImmunities: ['piercing', 'slashing']
        })}
        allCharacters={[buildCharacter()]}
        tileElevation={0}
        isSelected={false}
        isTurn={false}
        isTargetable={false}
        targetingMode={false}
        onClick={() => undefined}
        activeCharacterId={null}
      />
    );

    const badgeRow = screen.getByTestId('character-defense-badges');
    const resistanceBadge = screen.getByTestId('defense-badge-resistance');
    const vulnerabilityBadge = screen.getByTestId('defense-badge-vulnerability');
    const immunityBadge = screen.getByTestId('defense-badge-immunity');

    expect(badgeRow).toBeInTheDocument();
    expect(resistanceBadge).toHaveTextContent('R');
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Resistance: fire'));
    expect(resistanceBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical resistance: bludgeoning'));
    expect(vulnerabilityBadge).toHaveTextContent('V');
    expect(vulnerabilityBadge).toHaveAttribute('aria-label', 'Vulnerability: cold');
    expect(immunityBadge).toHaveTextContent('I');
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Immunity: necrotic'));
    expect(immunityBadge).toHaveAttribute('aria-label', expect.stringContaining('Non-magical immunity: piercing, slashing'));
  });

  it('omits the 3D defense badge row when the character has no matching traits', () => {
    render(
      <CharacterActor
        character={buildCharacter()}
        allCharacters={[buildCharacter()]}
        tileElevation={0}
        isSelected={false}
        isTurn={false}
        isTargetable={false}
        targetingMode={false}
        onClick={() => undefined}
        activeCharacterId={null}
      />
    );

    expect(screen.queryByTestId('character-defense-badges')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-resistance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-vulnerability')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-immunity')).not.toBeInTheDocument();
  });
});
