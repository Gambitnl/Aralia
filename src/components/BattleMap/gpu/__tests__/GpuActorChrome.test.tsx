/**
 * @file components/BattleMap/gpu/__tests__/GpuActorChrome.test.tsx
 *
 * Pins the WebGPU actor chrome (task agora-a2b8).
 *
 * The WebGPU battle scene shipped with real generated bodies but no chrome: no
 * nameplate, no HP pip, no defeat or temporary-HP marker, no defense or
 * condition chips. This spec proves the chrome is mounted, that it shows and
 * hides on the same conditions the WebGL actor uses, and — the point of the
 * split — that it reuses the WebGL `<Html>` components rather than a WebGPU
 * copy that could drift.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GpuActorChrome } from '../GpuActorChrome';
import { TEAM_COLORS } from '../../characters/characterActor/actorTheme';
import type { CombatCharacter } from '../../../../types/combat';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-html">{children}</div>,
}));

const buildCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter =>
  ({
    id: 'gpu-actor-1',
    name: 'Goblin Scout',
    position: { x: 2, y: 3 },
    currentHP: 9,
    maxHP: 12,
    initiative: 8,
    team: 'enemy',
    abilities: [],
    statusEffects: [],
    conditions: [],
    ...overrides,
  }) as unknown as CombatCharacter;

function renderChrome(overrides: Partial<React.ComponentProps<typeof GpuActorChrome>> = {}) {
  const character = overrides.character ?? buildCharacter();
  return render(
    <GpuActorChrome
      character={character}
      teamColors={TEAM_COLORS.enemy}
      pipY={2.1}
      isAlive
      isSelected={false}
      isTurn={false}
      hovered={false}
      hpPercent={0.75}
      hpColor="#22c55e"
      distanceToActive={null}
      {...overrides}
    />,
  );
}

describe('GpuActorChrome', () => {
  it('keeps the nameplate hidden until the actor is selected, active, or hovered', () => {
    renderChrome();
    expect(screen.queryByTestId('character-nameplate-3d')).toBeNull();
  });

  it('shows the nameplate with name and HP when hovered', () => {
    renderChrome({ hovered: true });

    const plate = screen.getByTestId('character-nameplate-3d');
    expect(plate.textContent).toContain('Goblin Scout');
    expect(plate.textContent).toContain('9/12');
  });

  it('shows the nameplate on selection and on the active turn', () => {
    const selected = renderChrome({ isSelected: true });
    expect(screen.getByTestId('character-nameplate-3d')).toBeTruthy();
    selected.unmount();

    renderChrome({ isTurn: true });
    expect(screen.getByTestId('character-nameplate-3d')).toBeTruthy();
  });

  it('reports the hovered range to the active character on the nameplate', () => {
    renderChrome({ hovered: true, distanceToActive: 25 });
    expect(screen.getByTestId('character-nameplate-3d').textContent).toContain('Distance: 25 ft');
  });

  it('marks a defeated combatant and only then', () => {
    const alive = renderChrome();
    expect(screen.queryByTestId('character-defeated-marker-3d')).toBeNull();
    alive.unmount();

    renderChrome({ character: buildCharacter({ currentHP: 0 }), isAlive: false });
    expect(screen.getByTestId('character-defeated-marker-3d')).toBeTruthy();
  });

  it('shows the temporary-HP buffer beside the pip when there is one', () => {
    const none = renderChrome();
    expect(screen.queryByTestId('temporary-hit-points-badge-3d')).toBeNull();
    none.unmount();

    renderChrome({ character: buildCharacter({ tempHP: 5 }) });
    expect(screen.getByTestId('temporary-hit-points-badge-3d').textContent).toContain('+5');
  });

  it('mounts the same defense and condition chips the WebGL actor uses', () => {
    renderChrome({
      character: buildCharacter({
        resistances: ['fire'],
        conditions: [{ name: 'Prone' }],
      } as unknown as Partial<CombatCharacter>),
    });

    expect(screen.getByTestId('character-defense-badges')).toBeTruthy();
    expect(screen.getByTestId('character-condition-badges')).toBeTruthy();
  });
});
