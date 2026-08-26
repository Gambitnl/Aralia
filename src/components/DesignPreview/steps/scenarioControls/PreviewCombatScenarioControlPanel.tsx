// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 02:09:16
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the scenario-specific switches used by Tactical Sandbox.
 *
 * The panel does not know how darkvision, difficult terrain, reactions, or any
 * other rule works. It renders accessible controls from the active scenario's
 * definitions and reports value changes to the preview page, which then asks
 * the owning scenario module to update real combat state.
 *
 * Called by: PreviewCombatScenarios.
 * Depends on: PreviewCombatScenarioControlTypes for the data-driven contract.
 */

import React from 'react';
import PreviewCombatScenarioCollapsibleSection from '../PreviewCombatScenarioCollapsibleSection';
import type {
  PreviewCombatScenarioControlDefinition,
  PreviewCombatScenarioControlValue,
  PreviewCombatScenarioControlValues,
} from './PreviewCombatScenarioControlTypes';

interface PreviewCombatScenarioControlPanelProps {
  controls: PreviewCombatScenarioControlDefinition[];
  values: PreviewCombatScenarioControlValues;
  onChange: (controlId: string, value: PreviewCombatScenarioControlValue) => void;
}

// ============================================================================
// Individual Control Rendering
// ============================================================================
// Every switch carries its current value in visible text as well as native
// accessibility state. Testers can therefore understand a screenshot without
// relying on color, and automated proof can select controls by stable labels.
// ============================================================================

const ScenarioControlInput: React.FC<{
  control: PreviewCombatScenarioControlDefinition;
  value: PreviewCombatScenarioControlValue;
  onChange: (value: PreviewCombatScenarioControlValue) => void;
}> = ({ control, value, onChange }) => {
  if (control.kind === 'toggle') {
    const enabled = value === true;

    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
          enabled
            ? 'border-cyan-400/70 bg-cyan-950/45 text-cyan-50'
            : 'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold">{control.label}</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">
            {control.description}
          </span>
        </span>
        <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
          enabled ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-200'
        }`}>
          {enabled ? 'On' : 'Off'}
        </span>
      </button>
    );
  }

  if (control.kind === 'select') {
    return (
      <label className="block rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
        <span className="block text-xs font-bold text-slate-100">{control.label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">
          {control.description}
        </span>
        <select
          value={String(value)}
          onChange={event => onChange(event.target.value)}
          className="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        >
          {(control.options ?? []).map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (control.kind === 'number') {
    return (
      <label className="block rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
        <span className="flex items-center justify-between gap-3 text-xs font-bold text-slate-100">
          {control.label}
          <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-200">{Number(value)}</span>
        </span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">
          {control.description}
        </span>
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(value)}
          onChange={event => onChange(Number(event.target.value))}
          className="mt-2 w-full accent-cyan-400"
        />
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onChange(true)}
      className="w-full rounded-lg border border-amber-400/60 bg-amber-950/35 px-3 py-2 text-left text-amber-50 transition-colors hover:bg-amber-900/45"
    >
      <span className="block text-xs font-bold">{control.label}</span>
      <span className="mt-0.5 block text-[10px] leading-relaxed text-amber-100/70">
        {control.description}
      </span>
    </button>
  );
};

// ============================================================================
// Scenario Test Controls Box
// ============================================================================
// The whole panel disappears only when a scenario genuinely has no controls.
// When controls exist, the shared collapsible shell lets testers shorten this
// box without changing values or collapsing the neighboring rules box.
// ============================================================================

export const PreviewCombatScenarioControlPanel: React.FC<
  PreviewCombatScenarioControlPanelProps
> = ({ controls, values, onChange }) => {
  if (controls.length === 0) {
    return null;
  }

  return (
    <PreviewCombatScenarioCollapsibleSection
      title="Test Controls"
      tone="cyan"
      description="Change one rule input, then use the real map and combat log to compare the result."
    >
      <div className="space-y-2">
        {controls.map(control => (
          <ScenarioControlInput
            key={control.id}
            control={control}
            value={values[control.id] ?? control.defaultValue}
            onChange={value => onChange(control.id, value)}
          />
        ))}
      </div>
    </PreviewCombatScenarioCollapsibleSection>
  );
};

export default PreviewCombatScenarioControlPanel;
