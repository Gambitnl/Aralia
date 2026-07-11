/**
 * These tests protect the recovery choices shown by the Resume Journey window.
 *
 * The storage service marks checkpoints as a kind of autosave, so this suite
 * proves that presentation keeps checkpoint history, rapid autosaves, and
 * player-created chronicles distinct while preserving load and delete actions.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveSlotSummary } from '../../../services/saveLoadService';
import LoadGameModal from '../LoadGameModal';

// The shared window chrome is covered elsewhere. This stand-in keeps the test
// focused on recovery grouping while retaining the real title and close action.
vi.mock('../../ui/WindowFrame', () => ({
  WindowFrame: ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <button type="button" onClick={onClose}>Close saves</button>
      {children}
    </div>
  ),
}));

// Deletion confirmation behavior has its own component coverage. This compact
// version exposes the same decision boundary needed by these integration tests.
vi.mock('../../ui/ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, onConfirm, children }: { isOpen: boolean; onConfirm: () => void; children: React.ReactNode }) => (
    isOpen ? <div role="alertdialog">{children}<button type="button" onClick={onConfirm}>Erase Forever</button></div> : null
  ),
}));

const slots: SaveSlotSummary[] = [
  { slotId: 'aralia_rpg_checkpoint_5min', slotName: '5 Minute Checkpoint', lastSaved: 3, isAutoSave: true, isCheckpoint: true },
  { slotId: 'aralia_rpg_autosave', slotName: 'Rapid Auto-Save', lastSaved: 2, isAutoSave: true },
  { slotId: 'aralia_rpg_slot_hero', slotName: 'Before the Gate', lastSaved: 1 },
];

describe('LoadGameModal recovery groups', () => {
  const onClose = vi.fn();
  const onLoadSlot = vi.fn();
  const onDeleteSlot = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('separates checkpoints, rapid autosaves, and manual chronicles', () => {
    render(<LoadGameModal slots={slots} onClose={onClose} onLoadSlot={onLoadSlot} onDeleteSlot={onDeleteSlot} />);

    const checkpoints = screen.getByRole('region', { name: 'Waystones (Checkpoints)' });
    const rapid = screen.getByRole('region', { name: 'Echoes (Rapid Auto-Saves)' });
    const chronicles = screen.getByRole('region', { name: 'Chronicles' });

    expect(within(checkpoints).getByText('5 Minute Checkpoint')).toBeInTheDocument();
    expect(within(checkpoints).queryByText('Rapid Auto-Save')).not.toBeInTheDocument();
    expect(within(rapid).getByText('Rapid Auto-Save')).toBeInTheDocument();
    expect(within(chronicles).getByText('Before the Gate')).toBeInTheDocument();
  });

  it('loads a checkpoint through its canonical slot id', () => {
    render(<LoadGameModal slots={slots} onClose={onClose} onLoadSlot={onLoadSlot} onDeleteSlot={onDeleteSlot} />);

    const checkpoints = screen.getByRole('region', { name: 'Waystones (Checkpoints)' });
    fireEvent.click(within(checkpoints).getByRole('button', { name: 'Load' }));

    expect(onLoadSlot).toHaveBeenCalledWith('aralia_rpg_checkpoint_5min');
  });

  it('requires confirmation before deleting a checkpoint', () => {
    render(<LoadGameModal slots={slots} onClose={onClose} onLoadSlot={onLoadSlot} onDeleteSlot={onDeleteSlot} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete save 5 Minute Checkpoint' }));
    expect(onDeleteSlot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Erase Forever' }));

    expect(onDeleteSlot).toHaveBeenCalledWith('aralia_rpg_checkpoint_5min');
  });
});
