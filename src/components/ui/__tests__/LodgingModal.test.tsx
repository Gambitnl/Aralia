import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LodgingModal from '../LodgingModal';
import type { LodgingOffer } from '../../../types/rest';
vi.mock('../../../hooks/useFocusTrap', () => ({useFocusTrap: () => React.createRef()}));
const offer: LodgingOffer = {businessId: 'inn', businessName: 'Bram’s inn', keeperId: 'keeper', keeperName: 'Bram',
  worldSeed: 1, cellId: 2, locationId: 'cell_2', burgId: 1, plotId: 106,
  partyIds: ['brea'], beds: [{level: 0, index: 0, roomId: 6}], roomLabels: ['Room 5, ground floor'], costGp: 0.5, quotedAt: '0351-01-01T08:00:00Z'};
describe('lodging commitment', () => {
  it('explains cost, duration, physical access and separate provisions before payment', () => {
    render(<LodgingModal offer={offer} gold={18.49} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/24 hours/)).toHaveTextContent(/Food and water are separate/);
    expect(screen.getByText(/Reach a reserved bed/)).toHaveTextContent(/does not move the party or grant recovery/);
    expect(screen.getByText(/not refunded/)).toBeInTheDocument();
    expect(screen.getByText('Room 5, ground floor')).toBeInTheDocument();
    expect(screen.queryByText(/Room 7/)).not.toBeInTheDocument();
  });
  it('blocks an unaffordable reservation', () => {
    const confirm = vi.fn();
    render(<LodgingModal offer={offer} gold={0.49} onConfirm={confirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name: /^Reserve for/}));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot afford/);
  });
  it('holds the dialog while committing, blocks repeat payment, and retains a rejected offer', async () => {
    let reject!: (cause: Error) => void;
    const confirm = vi.fn(() => new Promise<void>((_, fail) => {reject = fail;}));
    const close = vi.fn();
    render(<LodgingModal offer={offer} gold={18.49} onConfirm={confirm} onClose={close} />);
    fireEvent.click(screen.getByRole('button', {name: /^Reserve for/}));
    fireEvent.click(screen.getByRole('button', {name: 'Reserving…'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Keeper unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Keeper unavailable');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /^Reserve for/})).toBeEnabled();
  });
});
