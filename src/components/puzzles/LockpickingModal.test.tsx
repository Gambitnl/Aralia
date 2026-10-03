/**
 * This test file protects the Lockpicking gameplay modal as a single 2D dialog.
 *
 * The modal uses WindowFrame for its chrome, drag/resize controls, and dialog
 * semantics. These checks make sure Lockpicking does not add a second nested
 * dialog around that frame, because duplicate modal names confuse keyboard,
 * screen-reader, and browser-inspection flows.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LockpickingModal from './LockpickingModal';
import { createMockPlayerCharacter } from '../../utils/core/factories';
import { Item, Class } from '../../types';
import { Lock } from '../../systems/puzzles/types';
import { attemptLockpick } from '../../systems/puzzles/lockSystem';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef<HTMLDivElement>(),
}));

/**
 * The modal reads the face back out of the RollResult (agora-f821.1), so the
 * mock must return the shape DiceContext really returns. `pinnedFace` is what
 * the player is shown; the tests below assert it is also what decided.
 */
let pinnedFace = 20;
const visualRollMock = vi.fn(async () => ({
  rolls: [{ sides: 20, value: pinnedFace }],
  total: pinnedFace,
}));

vi.mock('../../contexts/DiceContext', () => ({
  useDice: () => ({
    visualRoll: visualRollMock,
    hideOverlay: vi.fn(),
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
    class: { id: 'rogue', name: 'Rogue', hitDie: 8 } as unknown as Class,
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
  it('resolves the pick with the exact d20 face it showed the player', async () => {
    pinnedFace = 17;
    visualRollMock.mockClear();
    const onLockpickResult = vi.fn();

    render(
      <LockpickingModal
        isOpen
        onClose={vi.fn()}
        lock={testLock}
        character={rogue}
        inventory={inventory}
        onLockpickResult={onLockpickResult}
      />
    );

    fireEvent.click(screen.getByText('Pick Lock'));
    await waitFor(() => expect(onLockpickResult).toHaveBeenCalled());

    // Exactly one d20 was rolled: the one the player watched.
    expect(visualRollMock).toHaveBeenCalledTimes(1);

    // The resolver, given the same face, must land on the same margin — no
    // second d20 anywhere in the path.
    const expected = attemptLockpick(rogue, testLock, inventory, pinnedFace);
    expect(onLockpickResult.mock.calls[0][0].margin).toBe(expected.margin);
  });

  it('moves the reported margin with the shown face, one for one', async () => {
    const marginFor = async (face: number): Promise<number> => {
      pinnedFace = face;
      const onLockpickResult = vi.fn();
      const view = render(
        <LockpickingModal
          isOpen
          onClose={vi.fn()}
          lock={testLock}
          character={rogue}
          inventory={inventory}
          onLockpickResult={onLockpickResult}
        />
      );
      fireEvent.click(view.getByText('Pick Lock'));
      await waitFor(() => expect(onLockpickResult).toHaveBeenCalled());
      const margin = onLockpickResult.mock.calls[0][0].margin as number;
      view.unmount();
      return margin;
    };

    expect((await marginFor(18)) - (await marginFor(8))).toBe(10);
  });
});
