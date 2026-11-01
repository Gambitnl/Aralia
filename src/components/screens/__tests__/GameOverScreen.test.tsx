import React, { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GamePhase } from '../../../types/core';
import type { GameState } from '../../../types/state';
import type { SaveLoadResult } from '../../../services/saveLoadService';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import GameOverScreen from '../GameOverScreen';

const recordSlot = 'aralia_rpg_slot_defeat_ui_record';
const service = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn() }));
vi.mock('../../../services/combatDefeatService', () => ({
  createDefeatSlotId: () => 'aralia_rpg_slot_defeat_ui_record',
  defeatSlotFromSearch: (search: string) => new URLSearchParams(search).get('defeat'),
  saveDefeatChronicle: service.save,
  loadDefeatChronicle: service.load,
}));

function fate(): GameState {
  return createMockGameState({ phase: GamePhase.GAME_OVER, gold: 22,
    party: [createMockPlayerCharacter({ id: 'hero', name: 'Hero', hp: 0, maxHp: 10 })],
    lastCombatOutcome: { result: 'defeat', worldSeed: 42, currentLocationId: 'cell_123',
      gameTime: '0351-01-01T12:00:00.000Z',
      party: [{ id: 'hero', name: 'Hero', currentHP: 0, maxHP: 10,
        deathSaves: { successes: 0, failures: 3 } }],
      enemies: [{ id: 'ghoul', name: 'Ghoul', currentHP: 22, maxHP: 22 }],
      events: [{ id: 'last-hit', type: 'damage', timestamp: 1, message: 'Massive damage kills Hero at 0 HP.' }],
    },
  });
}

function Harness({ initial, onMenu = vi.fn(), onRestore = vi.fn() }: {
  initial: GameState; onMenu?: () => void; onRestore?: (state: GameState) => void;
}) {
  const [state, setState] = useState(initial);
  return <GameOverScreen gameState={state} title="Game Over" onReturnToMainMenu={onMenu}
    onRestore={loaded => { onRestore(loaded); setState(loaded); }} />;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/Aralia/?phase=game_over');
  service.save.mockReset(); service.load.mockReset();
  service.save.mockResolvedValue({ success: true });
});

describe('recorded defeat screen', () => {
  it('joins repeated effect setup and waits for save confirmation before abandoning the live aftermath', async () => {
    let finish: ((result: SaveLoadResult) => void) | undefined;
    service.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onMenu = vi.fn();
    render(<StrictMode><Harness initial={fate()} onMenu={onMenu} /></StrictMode>);
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Return to Main Menu' })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText(/0\/10 HP/)).toHaveTextContent('Dead');
    expect(screen.getByText('Ghoul: 22/22 HP')).toBeInTheDocument();
    expect(screen.getByText(/Massive damage kills/)).toBeInTheDocument();
    await act(async () => { finish!({ success: true }); });
    expect(screen.getByRole('button', { name: 'Return to Main Menu' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('hydrates the specific recorded defeat after a cold terminal URL without writing another record', async () => {
    window.history.replaceState({}, '', `/Aralia/?phase=game_over&defeat=${recordSlot}`);
    const saved = fate();
    saved.lastCombatOutcome!.chronicleSlotId = recordSlot;
    service.load.mockResolvedValue({ success: true, data: saved });
    const restored = vi.fn();
    render(<Harness initial={createMockGameState({ phase: GamePhase.GAME_OVER, party: [] })} onRestore={restored} />);
    await waitFor(() => expect(screen.getByText('Ghoul: 22/22 HP')).toBeInTheDocument());
    expect(service.load).toHaveBeenCalledWith(recordSlot);
    expect(service.save).not.toHaveBeenCalled();
    expect(restored).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Death saves: 0 successes, 3 failures/)).toBeInTheDocument();
  });

  it('retries the same failed record rather than creating another defeat', async () => {
    service.save.mockResolvedValueOnce({ success: false, message: 'Storage is full.' })
      .mockResolvedValueOnce({ success: true });
    render(<Harness initial={fate()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Storage is full.'));
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('This defeat is recorded separately.'));
    expect(service.save).toHaveBeenCalledTimes(2);
    expect(service.save.mock.calls.map(call => call[1])).toEqual([recordSlot, recordSlot]);
  });

  it('does not invent an outcome for an unattached empty Game Over URL', () => {
    render(<Harness initial={createMockGameState({ phase: GamePhase.GAME_OVER, party: [] })} />);
    expect(screen.getByRole('status')).toHaveTextContent('No saved defeat is attached');
    expect(service.save).not.toHaveBeenCalled();
    expect(service.load).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Party at defeat' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Main Menu' })).toBeEnabled();
  });

  it('opens an already loaded native Chronicle without saving or loading it again', () => {
    window.history.replaceState({}, '', `/Aralia/?phase=game_over&defeat=${recordSlot}`);
    const saved = fate(); saved.lastCombatOutcome!.chronicleSlotId = recordSlot;
    render(<Harness initial={saved} />);
    expect(screen.getByText('Ghoul: 22/22 HP')).toBeInTheDocument();
    expect(service.save).not.toHaveBeenCalled();
    expect(service.load).not.toHaveBeenCalled();
  });
});
