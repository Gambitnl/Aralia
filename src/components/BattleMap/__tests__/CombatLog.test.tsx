/**
 * @file CombatLog.test.tsx
 *
 * Focused checks for the 2D combat log panel controls.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CombatLog from '../CombatLog';
import type { CombatLogEntry } from '../../../types/combat';

const logEntries: CombatLogEntry[] = [
  {
    id: 'entry-1',
    message: 'Kaelen strikes the target.',
    type: 'action',
    timestamp: Date.now(),
  },
];

describe('CombatLog', () => {
  beforeEach(() => {
    // The real browser scrolls the latest combat event into view. JSDOM only
    // needs a harmless stub so the component can mount.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('keeps the popout trigger large enough for cramped combat rails', () => {
    render(<CombatLog logEntries={logEntries} />);

    const popoutButton = screen.getByRole('button', {
      name: /pop out combat log into resizable window/i,
    });

    expect(popoutButton).toHaveClass('h-11');
    expect(popoutButton).toHaveClass('w-11');
    expect(popoutButton).toHaveClass('items-center');
    expect(popoutButton).toHaveClass('justify-center');
  });
});
