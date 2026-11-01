/** Real message rendering and dismissal in the existing desktop window shell. */
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GameMessage } from '../../../types';
import WorldMessageLog from '../WorldMessageLog';

beforeAll(() => {
  Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});
});

const roll: GameMessage = {
  id: 1,
  sender: 'system',
  timestamp: new Date('0351-01-04T16:51:15.000Z'),
  text: 'Ilan Merrick: Constitution save — d20 3 + 4 = 7 vs DC 17 — failed.',
};

describe('WorldMessageLog', () => {
  it('owns gameplay shortcuts and ordinary Tab navigation only while reading', () => {
    const backgroundShortcut = vi.fn();
    window.addEventListener('keydown', backgroundShortcut);
    try {
      const { rerender } = render(<WorldMessageLog isOpen messages={[roll]} onClose={vi.fn()} />);
      const reset = screen.getByRole('button', { name: 'Reset layout' });
      fireEvent.keyDown(reset, { key: 'm', code: 'KeyM' });
      fireEvent.keyDown(reset, { key: 'Tab', code: 'Tab' });
      expect(backgroundShortcut).not.toHaveBeenCalled();
      rerender(<WorldMessageLog isOpen={false} messages={[roll]} onClose={vi.fn()} />);
      fireEvent.keyDown(document, { key: 'm', code: 'KeyM' });
      expect(backgroundShortcut).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('keydown', backgroundShortcut);
    }
  });

  it('renders the actual roll and later consequences without inventing a journal account', () => {
    const { rerender } = render(<WorldMessageLog isOpen messages={[roll]} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Adventure log' })).toBeVisible();
    expect(screen.getByText(roll.text)).toBeVisible();
    const consequence = { ...roll, id: 2, text: 'The forced march takes its toll — Ilan grows exhausted.' };
    rerender(<WorldMessageLog isOpen messages={[roll, consequence]} onClose={vi.fn()} />);
    expect(screen.getByText(consequence.text)).toBeVisible();
    expect(screen.queryByText(/Party formed at the crossroads/)).toBeNull();
  });

  it('keeps a closed log out of the accessible tree', () => {
    render(<WorldMessageLog isOpen={false} messages={[roll]} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(roll.text)).toBeNull();
  });

  it('closes once through Escape and restores focus to the launching control', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(<WorldMessageLog isOpen messages={[roll]} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });

  it('offers the shared frame Close control', () => {
    const onClose = vi.fn();
    render(<WorldMessageLog isOpen messages={[roll]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
