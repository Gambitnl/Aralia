import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InventoryList from '../Overview/InventoryList';
import { Item } from '../../../types';
import { createMockPlayerCharacter } from '../../../utils/factories';

/**
 * This file proves the character sheet inventory shows perishable food correctly.
 *
 * The inventory UI is where players decide whether carried food can still be eaten.
 * These tests keep that visible behavior tied to durable item timestamps instead
 * of letting the screen fall back to a placeholder freshness flag.
 *
 * Called by: Vitest focused Character Sheet test runs.
 * Depends on: InventoryList.tsx and the shared mock character factory.
 */

// ============================================================================
// Time-Controlled Food Fixtures
// ============================================================================
// These helpers build fresh and spoiled food against a fixed clock so the test
// checks the gameplay rule instead of the machine's real current time.
// ============================================================================

const NOW = Date.UTC(2026, 0, 2, 12, 0, 0);
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * ONE_HOUR_MS;

const buildFood = (id: string, name: string, acquiredAt: number): Item => ({
  id,
  name,
  description: 'A simple ration that spoils if carried too long.',
  type: 'food_drink',
  perishable: true,
  shelfLife: '1 day',
  nutritionValue: 5,
  acquiredAt,
});

// ============================================================================
// Inventory Expiration Behavior
// ============================================================================
// The inventory list must distinguish edible food from food whose acquisition
// timestamp is older than its shelf life.
// ============================================================================

describe('InventoryList food expiration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders fresh food as edible and expired food as visibly expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const character = createMockPlayerCharacter({ id: 'food-tester' });
    const freshFood = buildFood('fresh_apple', 'Fresh Apple', NOW - ONE_HOUR_MS);
    const expiredFood = buildFood('old_bread', 'Old Bread', NOW - TWO_DAYS_MS);
    const onAction = vi.fn();

    render(
      <InventoryList
        inventory={[freshFood, expiredFood]}
        gold={0}
        character={character}
        onAction={onAction}
      />
    );

    const freshRow = screen.getByText('Fresh Apple').closest('li');
    const expiredRow = screen.getByText('Old Bread').closest('li');

    expect(freshRow).not.toBeNull();
    expect(expiredRow).not.toBeNull();
    expect(within(freshRow!).getByText(/Expires:/)).toHaveTextContent('Expires: 1 day');
    expect(within(expiredRow!).getByText(/Expired/)).toHaveTextContent('Expired');
    expect(within(freshRow!).getByRole('button', { name: 'Eat Fresh Apple' })).toBeEnabled();
    expect(within(expiredRow!).getByRole('button', { name: 'Eat Old Bread' })).toBeDisabled();
  });
});
