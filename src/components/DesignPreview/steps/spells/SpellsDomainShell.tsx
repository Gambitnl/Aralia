// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:50:13
 * Dependents: components/DesignPreview/steps/spells/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { SPELL_SCENARIO_REGISTRY, getSpellScenario } from './spellRegistry';
import type { SpellScenarioDefinition, SpellScenarioRegistry } from './types';

/**
 * This file renders the compact Tactical Sandbox Spells domain surface.
 *
 * It owns only selection, Reset, and the scenario-content boundary. The
 * default registry intentionally shows a truthful pending message because no
 * spell-specific scenario component is registered yet. Rules can mount this
 * surface immediately and later add canonical resolver-backed components one
 * entry at a time.
 *
 * Called by: the Rules orchestrator's future domain-tab integration.
 * Depends on: spellRegistry.ts and the optional component seam in types.ts.
 */

export interface SpellsDomainShellProps {
  registry?: SpellScenarioRegistry;
  initialSpellId?: string;
  onSelectionChange?: (spell: SpellScenarioDefinition) => void;
}

// ============================================================================
// Initial Selection
// ============================================================================
// Keep invalid host input safe: the first registry entry is the stable default
// used by the shell, its tests, and Reset.
// ============================================================================

function resolveInitialSpellId(
  registry: SpellScenarioRegistry,
  initialSpellId: string | undefined,
): string {
  return getSpellScenario(registry, initialSpellId)?.id ?? '';
}

// ============================================================================
// Pending Scenario Content
// ============================================================================
// This content is deliberately explicit about the boundary. It identifies the
// canonical evidence without showing a fake roll, HP change, reaction, or log.
// ============================================================================

const PendingScenario: React.FC<{ spell: SpellScenarioDefinition }> = ({ spell }) => (
  <div
    data-testid="spell-scenario-pending"
    className="rounded-xl border border-amber-400/40 bg-amber-950/30 p-4 text-amber-50"
  >
    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
      Scenario pending
    </p>
    <p className="mt-2 text-sm leading-relaxed">
      Canonical support exists for {spell.name}, but its deterministic Sandbox
      scenario is not registered yet. This shell does not simulate the
      mechanic as UI-only truth.
    </p>
    <p className="mt-3 text-xs leading-relaxed text-amber-100/75">
      Next scenario work should use: {spell.canonicalEvidence.resolverPaths[0]}
    </p>
  </div>
);

// ============================================================================
// Spells Domain Shell
// ============================================================================
// The selector and content region stay intentionally compact so the Rules host
// can place this domain beside other Tactical Sandbox tabs without inheriting
// spell-specific state or a second catalog implementation.
// ============================================================================

export const SpellsDomainShell: React.FC<SpellsDomainShellProps> = ({
  registry = SPELL_SCENARIO_REGISTRY,
  initialSpellId,
  onSelectionChange,
}) => {
  const defaultSpellId = useMemo(
    () => resolveInitialSpellId(registry, initialSpellId),
    [initialSpellId, registry],
  );
  const [selectedSpellId, setSelectedSpellId] = useState(defaultSpellId);
  const selectedSpell = getSpellScenario(registry, selectedSpellId);

  // A host can replace the registry while the shell remains mounted. Falling
  // back to the current first entry prevents a stale selection from producing
  // an empty content region during that integration transition.
  const activeSpell = selectedSpell ?? getSpellScenario(registry, defaultSpellId);

  // Selection is the only state this shell changes. Scenario components own
  // their own deterministic controls when they become available.
  const selectSpell = (spell: SpellScenarioDefinition) => {
    setSelectedSpellId(spell.id);
    onSelectionChange?.(spell);
  };

  // Reset returns to the registry's first item and reports the same event as a
  // normal selection so the Rules host can mirror the active domain if needed.
  const resetSelection = () => {
    const firstSpell = registry[0];
    if (!firstSpell) return;
    selectSpell(firstSpell);
  };

  if (!activeSpell) {
    return (
      <section aria-label="Spells" className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 text-slate-100">
        <h2 className="text-lg font-black tracking-wide">Spells</h2>
        <p className="mt-2 text-sm text-slate-400">No spell scenarios are registered yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Spells" className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Tactical Sandbox</p>
          <h2 className="mt-1 text-xl font-black tracking-wide">Spells</h2>
        </div>
        <button
          type="button"
          onClick={resetSelection}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-100"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Spell selector</p>
          <div role="list" aria-label="Available spells" className="space-y-2">
            {registry.map(spell => (
              <div key={spell.id} role="listitem">
                <button
                  type="button"
                  aria-pressed={spell.id === activeSpell.id}
                  onClick={() => selectSpell(spell)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    spell.id === activeSpell.id
                      ? 'border-cyan-400/70 bg-cyan-950/50 text-cyan-50'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="block text-sm font-bold">{spell.name}</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-400">
                    {spell.kind.replace('-', ' ')} · {spell.availability}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div data-testid="spell-scenario-content" className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Scenario content</p>
              <h3 className="mt-1 text-lg font-black">{activeSpell.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{activeSpell.summary}</p>
            </div>
            <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Level {activeSpell.level}
            </span>
          </div>

          <div className="mt-4">
            {activeSpell.availability === 'available' && activeSpell.scenarioComponent ? (
              <activeSpell.scenarioComponent spell={activeSpell} />
            ) : (
              <PendingScenario spell={activeSpell} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpellsDomainShell;
