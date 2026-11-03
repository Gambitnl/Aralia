import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LevelUpModal from '../LevelUpModal';
import { CLASSES_DATA } from '../../../data/classes';
import { createMockPlayerCharacter } from '../../../utils/core/factories';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    // GG-378: the footer uses the shared <Button>, which renders motion.button.
    // Drop the motion-only props so the DOM gets plain button attributes.
    button: ({ children, whileTap: _whileTap, whileHover: _whileHover, transition: _transition, ...props }:
      React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode; whileTap?: unknown; whileHover?: unknown; transition?: unknown }) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

describe('LevelUpModal subclass choice (level 3)', () => {
  const fighterToL3 = () =>
    createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 2, xp: 900, subclassId: undefined });

  it('offers the class subclasses when advancing to level 3', () => {
    render(<LevelUpModal isOpen character={fighterToL3()} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Choose your subclass')).toBeInTheDocument();
    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText('Battle Master')).toBeInTheDocument();
  });

  it('blocks confirm until a subclass is chosen, then passes it in the choices', () => {
    const onConfirm = vi.fn();
    render(<LevelUpModal isOpen character={fighterToL3()} onClose={vi.fn()} onConfirm={onConfirm} />);

    const confirm = screen.getByRole('button', { name: /Confirm Level Up/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByText('Champion'));
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ subclassId: 'champion' }),
    );
  });
});
