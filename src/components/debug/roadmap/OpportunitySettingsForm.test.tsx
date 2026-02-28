import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpportunitySettingsForm } from './OpportunitySettingsForm';

/**
 * This file verifies the opportunity settings form behavior.
 *
 * The opportunities drawer uses this form to edit scanner settings in the UI and
 * submit them back to the roadmap API. These tests lock down value rendering and
 * submit payload behavior.
 */

// ============================================================================
// Test Fixtures
// ============================================================================
// This section defines a stable starting settings object so each test can isolate
// exactly one behavior change.
// ============================================================================
const defaultSettings = {
  autoScanMinutes: 15,
  staleDays: 21,
  maxCrosslinkMatchesPerNode: 5,
  maxSnapshotEntries: 10,
  keepSnapshots: true
};

// ============================================================================
// OpportunitySettingsForm
// ============================================================================
// These tests ensure existing settings are displayed and edited values are returned
// through the onSave callback when the form is submitted.
// ============================================================================
describe('OpportunitySettingsForm', () => {
  // The form should pre-fill inputs with the current settings object values.
  it('renders current settings values in inputs', () => {
    render(<OpportunitySettingsForm settings={defaultSettings} onSave={vi.fn()} />);
    expect((screen.getByLabelText(/auto scan/i) as HTMLInputElement).value).toBe('15');
    expect((screen.getByLabelText(/stale/i) as HTMLInputElement).value).toBe('21');
  });

  // Submitting after editing should pass the numeric update to the onSave callback.
  it('calls onSave with updated values on submit', () => {
    const onSave = vi.fn();
    render(<OpportunitySettingsForm settings={defaultSettings} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/auto scan/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ autoScanMinutes: 30 }));
  });
});
