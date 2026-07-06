/**
 * This test file protects the Lockpicking gameplay modal as a single 2D dialog.
 *
 * The modal uses WindowFrame for its chrome, drag/resize controls, and dialog
 * semantics. These checks make sure Lockpicking does not add a second nested
 * dialog around that frame, because duplicate modal names confuse keyboard,
 * screen-reader, and browser-inspection flows.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LockpickingModal from './LockpickingModal';
import { createMockPlayerCharacter } from '../../utils/core/factories';
import { Item } from '../../types';
import { Lock } from '../../systems/puzzles/types';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef<HTMLDivElement>(),
}));

vi.mock('../../contexts/DiceContext', () => ({
  useDice: () => ({
    visualRoll: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('LockpickingModal', () => {
  const testLock: Lock = {
    id: 'test-lock',
    dc: 15,
    breakDC: 20,
    isLocked: true,
    isBroken: false,
  };

  const rogue = createMockPlayerCharacter({
    id: 'rogue-1',
    name: 'Ada',
    class: { id: 'rogue', name: 'Rogue', hitDie: 8 },
  });

  const inventory = [{ id: 'thieves-tools', name: "Thieves' Tools" }] as Item[];

  it('exposes one named Lockpicking dialog through WindowFrame', () => {
    render(
      <LockpickingModal
        isOpen
        onClose={vi.fn()}
        lock={testLock}
        character={rogue}
        inventory={inventory}
      />
    );

    expect(screen.getAllByRole('dialog', { name: 'Lockpicking' })).toHaveLength(1);
    expect(screen.getByTestId('window-lockpicking-window')).toBeInTheDocument();
  });
});
