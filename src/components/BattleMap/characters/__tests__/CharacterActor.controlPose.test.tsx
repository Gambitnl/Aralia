/**
 * G7 — 3D surface wiring: CharacterActor must resolve the shared control-option
 * pose contract from the combatant's live statusEffects and hand it to
 * EntityModel (which eases it onto the body root per frame). This spec pins the
 * wiring, not the per-frame math — easeActorPose has its own unit tests in
 * src/components/BattleMap/__tests__/controlOptionPose.test.ts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CharacterActor from '../CharacterActor';
import type { CombatCharacter } from '../../../../types/combat';
import type { ControlPose } from '../../controlOptionPose';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-html">{children}</div>
}));

// Replace the body with a probe that reports which pose it was handed.
vi.mock('../characterActor/EntityModel', () => ({
  EntityModel: ({ controlPose }: { controlPose?: ControlPose | null }) => (
    <div data-testid="entity-model-probe" data-control-pose={controlPose?.id ?? 'none'} />
  )
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
    />
  );

describe('CharacterActor control-option pose wiring (G7)', () => {
  it('hands the resolved grovel pose to the body when Command: Grovel is active', () => {
    renderActor(
      buildCharacter({
        statusEffects: [
          {
            id: 's1',
            name: 'Command: Grovel',
            type: 'debuff',
            duration: 1,
            description: 'grovels'
          } as CombatCharacter['statusEffects'][number]
        ]
      })
    );
    expect(screen.getByTestId('entity-model-probe')).toHaveAttribute('data-control-pose', 'grovel');
  });

  it('hands no pose when no directive is active (fallback/restore path)', () => {
    renderActor(buildCharacter({ statusEffects: [] }));
    expect(screen.getByTestId('entity-model-probe')).toHaveAttribute('data-control-pose', 'none');
  });
});
