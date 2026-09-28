// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 22:09:51
 * Dependents: components/DesignPreview/steps/classes/classesScenarioAdapter.tsx, components/DesignPreview/steps/raceDomain/raceFrameworkAdapter.tsx, components/DesignPreview/steps/spells/spellsFrameworkAdapter.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file keeps peer combat domains visually aligned with the Rules sidebar.
 * It owns presentation only: search, collapsible scenario evidence, the selected
 * scenario card, and the domain catalogue. Each adapter still owns its canonical
 * selection and mechanic state, while the shared framework owns panel sizing.
 *
 * Called by: Classes, Races, and Spells framework adapters.
 * Depends on: the shared collapsible section used by the Rules scenario sidebar.
 */

import React from 'react';
import PreviewCombatScenarioCollapsibleSection from './PreviewCombatScenarioCollapsibleSection';

// ============================================================================
// Public Presentation Contract
// ============================================================================

export interface PreviewCombatDomainScenarioSidebarProps {
  domainId: string;
  query: string;
  resultCount: number;
  totalCount: number;
  onQueryChange: (query: string) => void;
  verification: React.ReactNode;
  controls: React.ReactNode;
  selectedLabel: string;
  selectedSummary: string;
  selectedMeta?: React.ReactNode;
  catalogueLabel: string;
  catalogueDescription: string;
  catalogue: React.ReactNode;
}

// ============================================================================
// Rules-shaped Domain Sidebar
// ============================================================================
// Domain-specific IDs avoid duplicate input/description relationships because
// the preview intentionally keeps hidden domain panels mounted across tab changes.

export function PreviewCombatDomainScenarioSidebar({
  domainId,
  query,
  resultCount,
  totalCount,
  onQueryChange,
  verification,
  controls,
  selectedLabel,
  selectedSummary,
  selectedMeta,
  catalogueLabel,
  catalogueDescription,
  catalogue,
}: PreviewCombatDomainScenarioSidebarProps): React.ReactElement {
  const searchId = `${domainId}-tactical-sandbox-search`;
  const searchStatusId = `${searchId}-status`;
  const hasQuery = query.trim().length > 0;

  return (
    <div data-testid={`${domainId}-tactical-sandbox-sidebar`} className="flex min-h-full flex-col gap-4">
      <header>
        <h2 className="font-serif text-xl font-bold uppercase tracking-wide text-amber-400">
          Tactical Sandbox
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Isolate and verify modular {domainId} mechanics on native engine components.
        </p>
      </header>

      <section className="space-y-1.5" aria-labelledby={`${searchId}-label`}>
        <label
          id={`${searchId}-label`}
          htmlFor={searchId}
          className="block text-[10px] font-bold uppercase tracking-wider text-gray-300"
        >
          Find a scenario
        </label>
        <div className="relative">
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={`Search ${domainId}…`}
            aria-describedby={searchStatusId}
            className="w-full rounded-lg border border-gray-700/80 bg-gray-950/85 px-3 py-2 text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-600 hover:border-gray-600 focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40"
          />
        </div>
        <p id={searchStatusId} role="status" aria-live="polite" className="text-[11px] text-gray-500">
          {hasQuery ? `${resultCount} of ${totalCount} scenarios shown` : `${totalCount} scenarios available`}
        </p>
      </section>

      <section className="space-y-2 rounded-2xl border border-cyan-900/70 bg-cyan-950/10 p-2">
        <div className="px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Scenario specific</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Domain evidence and controls for {selectedLabel}. Collapse each box independently.
          </p>
        </div>
        <PreviewCombatScenarioCollapsibleSection title="Rules & Verification" tone="amber">
          {verification}
        </PreviewCombatScenarioCollapsibleSection>
        <PreviewCombatScenarioCollapsibleSection title="Test Controls" tone="cyan">
          {controls}
        </PreviewCombatScenarioCollapsibleSection>
      </section>

      <section aria-label="Selected scenario" className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Selected scenario</p>
        <article className="rounded-xl border border-cyan-500/70 bg-cyan-950/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">{selectedLabel}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{selectedSummary}</p>
            </div>
            <span className="shrink-0 rounded border border-amber-500/60 bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-300">
              Selected
            </span>
          </div>
          {selectedMeta && <div className="mt-2 text-[11px] text-cyan-300">{selectedMeta}</div>}
        </article>
      </section>

      <section aria-label={catalogueLabel} className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">{catalogueLabel}</p>
        <p className="text-[10px] leading-relaxed text-gray-500">{catalogueDescription}</p>
        {catalogue}
      </section>
    </div>
  );
}

export default PreviewCombatDomainScenarioSidebar;
