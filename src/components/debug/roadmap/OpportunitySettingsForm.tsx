import { useState } from 'react';
import type { OpportunitySettings } from '../../../../scripts/roadmap-server-logic';

/**
 * This file renders a small editor form for opportunity scanner settings.
 *
 * The opportunities drawer uses this form to let users adjust scan interval and
 * stale-node threshold values, then submit those values back to the parent
 * visualizer callback for API persistence.
 */

// ============================================================================
// Component Contract
// ============================================================================
// The parent passes current settings and receives an updated payload on submit.
// ============================================================================
interface Props {
  settings: OpportunitySettings;
  onSave: (updated: OpportunitySettings) => void;
}

// ============================================================================
// Opportunity Settings Form
// ============================================================================
// This controlled form keeps local numeric inputs in sync with current settings
// and emits an updated settings object when submitted.
// ============================================================================
export function OpportunitySettingsForm({ settings, onSave }: Props) {
  // Seed editable fields from current settings so the form reflects live values.
  const [autoScanMinutes, setAutoScanMinutes] = useState(settings.autoScanMinutes);
  const [staleDays, setStaleDays] = useState(settings.staleDays);

  // Submit handler merges edited fields into the full settings object.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...settings, autoScanMinutes, staleDays });
  };

  // Render the two editable numeric controls and save action.
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 text-xs">
      <label className="flex flex-col gap-1">
        <span>Auto Scan (minutes)</span>
        <input
          aria-label="auto scan minutes"
          type="number"
          min={1}
          value={autoScanMinutes}
          onChange={(e) => setAutoScanMinutes(Number(e.target.value))}
          className="w-20 rounded border border-blue-700 bg-transparent px-1 py-0.5"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Stale Threshold (days)</span>
        <input
          aria-label="stale days"
          type="number"
          min={1}
          value={staleDays}
          onChange={(e) => setStaleDays(Number(e.target.value))}
          className="w-20 rounded border border-blue-700 bg-transparent px-1 py-0.5"
        />
      </label>
      <button
        type="submit"
        className="mt-1 rounded bg-blue-800 px-2 py-1 text-white hover:bg-blue-700"
      >
        Save Settings
      </button>
    </form>
  );
}
