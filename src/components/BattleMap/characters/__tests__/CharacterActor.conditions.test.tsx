/**
 * Task 76 (GOAL #19): the 3D actor must expose active conditions the way the
 * 2D token layer does. This spec proves the condition badge row renders known
 * conditions with tooltips, dedupes repeats, falls back gracefully for custom
 * condition strings, and disappears entirely when no conditions are active.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CharacterActor from '../CharacterActor';
import type { CombatCharacter } from '../../../../types/combat';
import {
  DEFAULT_CONDITION_VISUAL,
  resolveConditionVisual,
} from '../../../../utils/visuals/conditionPalette';

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

/** jsdom reports `style.color` as `rgb(r, g, b)`, so compare in that form. */
const asRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const renderActor = (character: CombatCharacter) =>
  render(
    <CharacterActor
      character={character}
      allCharacters={[character]}
      tileElevation={0}
      isSelected={false}
      isTurn={false}
      isTargetable={false}
      targetingMode={false}
      onClick={() => undefined}
      activeCharacterId={null}
    />
  );

describe('CharacterActor condition badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chips for active conditions with source tooltips and dedupes repeats', () => {
    renderActor(
      buildCharacter({
        conditions: [
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0, source: 'Ray of Sickness' },
          { name: 'Stunned', duration: { type: 'permanent' }, appliedTurn: 1 },
          // Duplicate name — must render once.
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 2 },
        ] as CombatCharacter['conditions'],
      })
    );

    expect(screen.getByTestId('character-condition-badges')).toBeTruthy();
    expect(screen.getAllByTestId('condition-badge-Poisoned')).toHaveLength(1);
    expect(screen.getByTestId('condition-badge-Poisoned').getAttribute('title')).toBe(
      'Poisoned (Ray of Sickness)'
    );
    expect(screen.getByTestId('condition-badge-Stunned').getAttribute('title')).toBe('Stunned');
    expect(screen.getByTestId('condition-badge-Poisoned').textContent).toBe('PO');
  });

  it('falls back to a two-letter chip for unknown custom condition names', () => {
    renderActor(
      buildCharacter({
        conditions: [
          { name: 'Hexed', duration: { type: 'permanent' }, appliedTurn: 0 },
        ] as CombatCharacter['conditions'],
      })
    );
    expect(screen.getByTestId('condition-badge-Hexed').textContent).toBe('HE');
  });

  it('takes its chip colors from the shared palette, not a local table', () => {
    renderActor(
      buildCharacter({
        conditions: [
          { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0 },
          { name: 'Charmed', duration: { type: 'permanent' }, appliedTurn: 0 },
          { name: 'Hexed', duration: { type: 'permanent' }, appliedTurn: 0 },
        ] as CombatCharacter['conditions'],
      })
    );

    // Poisoned is one of the six colors Remy ruled (Set C, 2026-09-21).
    expect(screen.getByTestId('condition-badge-Poisoned').style.color).toBe(
      asRgb(resolveConditionVisual('Poisoned').chipColor)
    );
    expect(resolveConditionVisual('Poisoned').chipColor).toBe('#56d364');

    // Charmed has NO ruled color yet, so it must sit on the one shared
    // neutral default rather than a color someone guessed locally.
    expect(screen.getByTestId('condition-badge-Charmed').style.color).toBe(
      asRgb(DEFAULT_CONDITION_VISUAL.chipColor)
    );
    // ...and an unknown name lands on exactly the same neutral.
    expect(screen.getByTestId('condition-badge-Hexed').style.color).toBe(
      asRgb(DEFAULT_CONDITION_VISUAL.chipColor)
    );
  });

  it('renders nothing when the character has no active conditions', () => {
    renderActor(buildCharacter());
    expect(screen.queryByTestId('character-condition-badges')).toBeNull();
  });
});
