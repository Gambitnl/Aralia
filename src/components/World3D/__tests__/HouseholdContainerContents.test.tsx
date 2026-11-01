/** Household examination must sum real quantities without rewriting owned stock. */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HouseholdContainerContents } from '../HouseholdContainerContents';
import type { ContainerManifest } from '../../../systems/worldforge/interior/manifests';

describe('HouseholdContainerContents', () => {
  it('combines separated identical IDs, keeps first-seen order and leaves source ownership untouched', () => {
    const manifest: ContainerManifest = {
      level: 0, furnishingIndex: 2, kind: 'barrel', ownerHomeId: 'home-hartdown',
      entries: [{itemId: 'clay_pot', qty: 1}, {itemId: 'tallow_candles', qty: 2}, {itemId: 'clay_pot', qty: 3}],
    };
    const before = structuredClone(manifest);
    Object.freeze(manifest.entries);
    for (const entry of manifest.entries) Object.freeze(entry);
    render(<HouseholdContainerContents manifest={manifest} />);
    const rows = within(screen.getByRole('region', {name: 'Household belongings'})).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('4 × Clay Pot');
    expect(rows[1].textContent).toContain('2 × Tallow Candles');
    fireEvent.click(screen.getByText('4 × Clay Pot'));
    expect(screen.getByText('A glazed clay cooking pot.')).toBeInTheDocument();
    expect(manifest).toEqual(before);
  });

  it('keeps different IDs separate even without catalog metadata', () => {
    render(<HouseholdContainerContents manifest={{level: 1, furnishingIndex: 0,
      kind: 'chest', ownerHomeId: 'home-other', entries: [
        {itemId: 'unknown_ledger', qty: 1}, {itemId: 'unknown-ledger', qty: 2},
      ]}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('1 × unknown ledger')).toBeInTheDocument();
    expect(screen.getByText('2 × unknown ledger')).toBeInTheDocument();
  });
});
