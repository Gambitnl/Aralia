/**
 * @file CreditsModal.test.tsx
 * Locks the player-visible credit lines. CC-BY 4.0 asks for a credit the end
 * user can see, so a missing line here is a license problem, not a style nit.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreditsModal } from '../CreditsModal';
import { REFERENCE_HAND_CREDIT } from '../../../systems/entities3d/three/referenceHandMesh';

describe('CreditsModal', () => {
  it('shows the hand mesh credit line and the Caeora token pack credit', () => {
    render(<CreditsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Credits' })).toBeInTheDocument();
    expect(screen.getByText(REFERENCE_HAND_CREDIT)).toBeInTheDocument();
    expect(screen.getByText(/Caeora painted VTT token packs/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /creativecommons\.org/i })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );
  });

  it('renders nothing when closed', () => {
    render(<CreditsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from the header button', () => {
    const onClose = vi.fn();
    render(<CreditsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
