// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 02:30:02
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/classes/classesScenarioAdapter.tsx, components/DesignPreview/steps/raceDomain/raceFrameworkAdapter.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BattleMapData, CombatCharacter } from '../../../types/combat';
import type { useAbilitySystem } from '../../../hooks/useAbilitySystem';
import type { useTurnManager } from '../../../hooks/combat/useTurnManager';

/**
 * This file provides the domain-neutral shell used by Tactical Sandbox previews.
 * It keeps the map, renderer switch, reset actions, and right rail in one stable
 * layout while each domain injects its own actors, controls, and proof content.
 * Called by a domain host such as PreviewCombatScenarios; it calls only the
 * renderer and slot contracts supplied by that host.
 */

// ============================================================================
// Shared Framework Types
// ============================================================================
// These types describe the facts every tactical preview domain must provide.
// They deliberately contain no Classes, Races, Spells, or scenario-specific
// controls, so peer domains can reuse the same import without inheriting Rules
// content.
// ============================================================================

export type PreviewCombatScenarioRenderMode = '2d' | '3d';

export interface PreviewCombatScenarioDomainIdentity {
  domainId: string;
  domainLabel: string;
}

export interface PreviewCombatScenarioIdentity {
  scenarioId: string;
  scenarioLabel: string;
}

/**
 * Canonical combat callbacks travel through the framework as an observational
 * renderer context. Domains can render the native map components without
 * creating a second turn manager or ability system of their own.
 */
export interface PreviewCombatScenarioCombatState {
  turnManager: ReturnType<typeof useTurnManager>;
  turnState: ReturnType<typeof useTurnManager>['turnState'];
  abilitySystem: ReturnType<typeof useAbilitySystem>;
  isCharacterTurn: (id: string) => boolean;
  onCharacterUpdate: (character: CombatCharacter) => void;
}

export interface PreviewCombatScenarioCameraLifecycle {
  /** Called whenever the visible renderer mode changes. */
  onModeChange?: (mode: PreviewCombatScenarioRenderMode) => void;
  /** Called before a domain resets its canonical map and actors. */
  onReset?: () => void;
}

export interface PreviewCombatScenarioRendererContext {
  domain: PreviewCombatScenarioDomainIdentity;
  scenario: PreviewCombatScenarioIdentity;
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  combatState: PreviewCombatScenarioCombatState;
  mode: PreviewCombatScenarioRenderMode;
  cameraLifecycle: PreviewCombatScenarioCameraLifecycle;
}

export interface PreviewCombatScenarioRenderers {
  twoD: (context: PreviewCombatScenarioRendererContext) => React.ReactNode;
  threeD: (context: PreviewCombatScenarioRendererContext) => React.ReactNode;
}

export interface PreviewCombatScenarioRightRailSlots {
  turn: React.ReactNode;
  actionEconomy?: React.ReactNode;
  abilities: React.ReactNode;
  combatLog: React.ReactNode;
}

export interface PreviewCombatScenarioFrameworkProofState {
  domainId: string;
  scenarioId: string;
  renderMode: PreviewCombatScenarioRenderMode;
  mapHydrated: boolean;
  actorCount: number;
}

export interface PreviewCombatScenarioFrameworkProofHooks {
  /** Stable test id for the observable state node. */
  testId?: string;
  /** Receives the same state exposed through the DOM proof attributes. */
  onStateChange?: (state: PreviewCombatScenarioFrameworkProofState) => void;
}

/**
 * The shared shell owns these panel bounds so every domain gets the same
 * predictable resize and collapse behaviour. Values are intentionally small
 * finite ranges: a browser proof can exercise them without creating a layout
 * that hides the map or right rail off-screen.
 * Called by: PreviewCombatScenarioFramework's panel toolbar.
 * Depends on: no domain state; this is a presentation lifecycle contract.
 */
export type PreviewCombatScenarioPanelId = 'sidebar' | 'map' | 'rightRail';

export interface PreviewCombatScenarioPanelLayout {
  sidebar: { collapsed: boolean; width: number };
  map: { collapsed: boolean; flex: number };
  rightRail: { collapsed: boolean; width: number };
}

export const PREVIEW_COMBAT_SCENARIO_DEFAULT_PANEL_LAYOUT: PreviewCombatScenarioPanelLayout = {
  sidebar: { collapsed: false, width: 380 },
  map: { collapsed: false, flex: 3 },
  rightRail: { collapsed: false, width: 300 },
};

const PANEL_LAYOUT_LIMITS = {
  sidebar: { min: 280, max: 460, step: 40 },
  map: { min: 2, max: 5, step: 1 },
  rightRail: { min: 240, max: 420, step: 40 },
} as const;

interface PreviewCombatScenarioPanelControlsProps {
  panel: PreviewCombatScenarioPanelId;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  onResize: (direction: 'increase' | 'decrease') => void;
}

/**
 * One accessible control group is shared by the sidebar, map, and right rail.
 * The labels describe the panel and action so keyboard and screen-reader users
 * can operate the same deterministic bounds as pointer users.
 */
const PreviewCombatScenarioPanelControls: React.FC<PreviewCombatScenarioPanelControlsProps> = ({
  panel,
  label,
  collapsed,
  onToggle,
  onResize,
}) => (
  <div
    className="flex items-center justify-between gap-1 rounded-lg border border-gray-800 bg-gray-950/50 px-2 py-1"
    role="group"
    aria-label={`${label} panel controls`}
    data-testid={`preview-combat-scenario-${panel}-controls`}
  >
    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-gray-500">{label}</span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label} panel`}
        aria-expanded={!collapsed}
        aria-pressed={collapsed}
        data-testid={`preview-combat-scenario-${panel}-collapse`}
        onClick={onToggle}
        className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] font-bold text-gray-200 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <button
        type="button"
        aria-label={`Decrease ${label} panel size`}
        data-testid={`preview-combat-scenario-${panel}-decrease-size`}
        onClick={() => onResize('decrease')}
        disabled={collapsed}
        className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] font-bold text-gray-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Increase ${label} panel size`}
        data-testid={`preview-combat-scenario-${panel}-increase-size`}
        onClick={() => onResize('increase')}
        disabled={collapsed}
        className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] font-bold text-gray-200 hover:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        +
      </button>
    </div>
  </div>
);

export interface PreviewCombatScenarioFrameworkProps {
  domain: PreviewCombatScenarioDomainIdentity;
  scenario: PreviewCombatScenarioIdentity;
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  combatState: PreviewCombatScenarioCombatState;
  renderMode: PreviewCombatScenarioRenderMode;
  onRenderModeChange: (mode: PreviewCombatScenarioRenderMode) => void;
  onReset: () => void;
  renderers: PreviewCombatScenarioRenderers;
  sidebar: React.ReactNode;
  liveState?: React.ReactNode;
  rightRail: PreviewCombatScenarioRightRailSlots;
  toolbarActions?: React.ReactNode;
  cameraLifecycle?: PreviewCombatScenarioCameraLifecycle;
  proof?: PreviewCombatScenarioFrameworkProofHooks;
  endTurn?: {
    disabled: boolean;
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

/**
 * Public registration contract for Classes, Races, Spells, and future domains.
 * The registry stores content descriptors only; the framework remains the
 * single owner of the mounted shell, map, camera, reset, and right rail.
 */
export interface PreviewCombatScenarioAdapter {
  domain: PreviewCombatScenarioDomainIdentity;
  scenario: PreviewCombatScenarioIdentity;
  render: (props: PreviewCombatScenarioFrameworkProps) => React.ReactNode;
}

export interface PreviewCombatScenarioAdapterRegistry {
  readonly adapters: readonly PreviewCombatScenarioAdapter[];
  get: (domainId: string, scenarioId: string) => PreviewCombatScenarioAdapter | undefined;
}

export const definePreviewCombatScenarioAdapter = (
  adapter: PreviewCombatScenarioAdapter,
): PreviewCombatScenarioAdapter => adapter;

export const createPreviewCombatScenarioAdapterRegistry = (
  adapters: readonly PreviewCombatScenarioAdapter[],
): PreviewCombatScenarioAdapterRegistry => ({
  adapters,
  get: (domainId, scenarioId) => adapters.find(
    adapter => adapter.domain.domainId === domainId && adapter.scenario.scenarioId === scenarioId,
  ),
});

// ============================================================================
// Framework Shell
// ============================================================================
// This component owns only the repeated tactical-preview layout. Domain hosts
// retain all canonical state transitions and inject their visible content into
// the sidebar, live-state, renderer, and right-rail slots.
// ============================================================================

export const PreviewCombatScenarioFramework: React.FC<PreviewCombatScenarioFrameworkProps> = ({
  domain,
  scenario,
  mapData,
  characters,
  combatState,
  renderMode,
  onRenderModeChange,
  onReset,
  renderers,
  sidebar,
  liveState,
  rightRail,
  toolbarActions,
  cameraLifecycle,
  proof,
  endTurn,
  children,
}) => {
  // Panel layout is framework state, not domain state. Resetting the board
  // therefore restores the same readable defaults for Rules and every peer
  // adapter without touching characters, maps, turns, or combat logs.
  const [panelLayout, setPanelLayout] = useState<PreviewCombatScenarioPanelLayout>(
    PREVIEW_COMBAT_SCENARIO_DEFAULT_PANEL_LAYOUT,
  );
  const [isWideViewport, setIsWideViewport] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );

  // Keep the desktop split responsive while retaining the same panel state on
  // narrow viewports. The listener is deliberately local to the shell so a
  // domain adapter never needs to own viewport bookkeeping.
  useEffect(() => {
    const handleViewportResize = () => setIsWideViewport(window.innerWidth >= 1024);
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  const resetPanelLayout = useCallback(() => {
    setPanelLayout(PREVIEW_COMBAT_SCENARIO_DEFAULT_PANEL_LAYOUT);
  }, []);

  const togglePanel = useCallback((panel: PreviewCombatScenarioPanelId) => {
    setPanelLayout(previous => ({
      ...previous,
      [panel]: { ...previous[panel], collapsed: !previous[panel].collapsed },
    }));
  }, []);

  const resizePanel = useCallback((panel: PreviewCombatScenarioPanelId, direction: 'increase' | 'decrease') => {
    setPanelLayout(previous => {
      const delta = direction === 'increase' ? 1 : -1;
      if (panel === 'map') {
        const limits = PANEL_LAYOUT_LIMITS.map;
        const nextFlex = Math.min(limits.max, Math.max(limits.min, previous.map.flex + delta * limits.step));
        return { ...previous, map: { ...previous.map, flex: nextFlex } };
      }

      const limits = PANEL_LAYOUT_LIMITS[panel];
      const current = previous[panel];
      const nextWidth = Math.min(limits.max, Math.max(limits.min, current.width + delta * limits.step));
      return {
        ...previous,
        [panel]: {
          ...current,
          width: nextWidth,
        },
      };
    });
  }, []);

  // The proof object is derived from live props so tests and browser capture
  // tools observe canonical hydration rather than a second display-only state.
  const proofState = useMemo<PreviewCombatScenarioFrameworkProofState>(() => ({
    domainId: domain.domainId,
    scenarioId: scenario.scenarioId,
    renderMode,
    mapHydrated: mapData !== null,
    actorCount: characters.length,
  }), [characters.length, domain.domainId, mapData, renderMode, scenario.scenarioId]);

  // Renderer changes are a lifecycle boundary for camera implementations. The
  // shell reports that boundary without trying to own a camera or mutate map
  // state, so each domain can preserve its own canonical camera policy.
  useEffect(() => {
    cameraLifecycle?.onModeChange?.(renderMode);
  }, [cameraLifecycle, renderMode]);

  // Proof callbacks are intentionally observational. They cannot change the
  // scenario, which keeps mounted tests honest about state retention.
  useEffect(() => {
    proof?.onStateChange?.(proofState);
  }, [proof, proofState]);

  // Reset notifies the camera boundary before delegating to the domain's real
  // reset hook. The domain remains responsible for map, actors, turn state,
  // controls, and combat-log restoration.
  const handleReset = () => {
    cameraLifecycle?.onReset?.();
    resetPanelLayout();
    onReset();
  };

  const rendererContext: PreviewCombatScenarioRendererContext = {
    domain,
    scenario,
    mapData,
    characters,
    combatState,
    mode: renderMode,
    cameraLifecycle: cameraLifecycle ?? {},
  };

  return (
    <div
      className="bg-gray-950 text-gray-100 flex flex-col xl:flex-row h-full overflow-hidden font-sans border border-gray-800 rounded-xl shadow-2xl relative"
      data-domain-id={domain.domainId}
      data-scenario-id={scenario.scenarioId}
    >
      <div
        data-testid={proof?.testId ?? 'preview-combat-scenario-framework-state'}
        data-framework-domain={domain.domainId}
        data-scenario-id={scenario.scenarioId}
        data-render-mode={renderMode}
        data-map-hydrated={String(proofState.mapHydrated)}
        data-actor-count={proofState.actorCount}
        hidden
        aria-hidden="true"
      />

      {/* The domain sidebar remains a slot so Rules, Classes, Races, and Spells
          can keep their own content while sharing the same tactical frame. */}
      <div
        className="w-full max-w-full xl:flex-shrink-0 bg-gray-900/60 border-b xl:border-b-0 xl:border-r border-gray-800 p-5 flex flex-col gap-5 backdrop-blur-md overflow-y-auto scrollable-content"
        style={{ width: isWideViewport ? `${panelLayout.sidebar.width}px` : '100%' }}
        data-testid="preview-combat-scenario-sidebar-panel"
        data-panel-collapsed={String(panelLayout.sidebar.collapsed)}
      >
        <PreviewCombatScenarioPanelControls
          panel="sidebar"
          label="Sidebar"
          collapsed={panelLayout.sidebar.collapsed}
          onToggle={() => togglePanel('sidebar')}
          onResize={direction => resizePanel('sidebar', direction)}
        />
        {!panelLayout.sidebar.collapsed && sidebar}
      </div>

      {/* The main pane owns renderer switching and stable toolbar actions. */}
      <div className="flex-grow flex flex-col p-4 overflow-hidden relative bg-gray-950">
        <div className="flex justify-between items-center mb-4 bg-gray-900/40 border border-gray-850 p-3 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded bg-amber-950/40 text-amber-300 border border-amber-900/50 text-[10px] uppercase font-bold tracking-wider">
              Sandbox Active
            </span>
            <span className="text-xs text-gray-400 hidden sm:inline">
              Selected: <strong className="text-gray-200">{scenario.scenarioLabel}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {toolbarActions}
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-lg transition-colors border border-gray-700"
              title="Reset characters and map grids"
            >
              🔄 Reset Board
            </button>

            {endTurn && (
              <button
                type="button"
                disabled={endTurn.disabled}
                onClick={endTurn.onClick}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg text-white transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent border border-amber-500/20"
              >
                {endTurn.label}
              </button>
            )}

            <button
              type="button"
              data-testid="preview-combat-scenario-render-mode-toggle"
              aria-pressed={renderMode === '3d'}
              onClick={() => onRenderModeChange(renderMode === '2d' ? '3d' : '2d')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-lg text-white transition-colors"
            >
              {renderMode === '2d' ? '🎮 3D View' : '🗺️ 2D View'}
            </button>
          </div>
        </div>

        {liveState}
        {children}

        {/* The map and right rail are separate slots, preserving the same
            responsive relationship while each domain supplies its own content. */}
        <div
          className="flex-grow min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden"
          style={{
            gridTemplateColumns: isWideViewport
              ? `minmax(0, ${panelLayout.map.flex}fr) ${panelLayout.rightRail.collapsed ? '52px' : `${panelLayout.rightRail.width}px`}`
              : 'minmax(0, 1fr)',
          }}
        >
          <section
            className="flex min-h-0 min-w-0 h-full flex-1 flex-col items-stretch justify-center bg-gray-900/20 border border-gray-850 rounded-2xl overflow-hidden relative p-2"
            data-testid="preview-combat-scenario-map-panel"
            data-panel-collapsed={String(panelLayout.map.collapsed)}
          >
            <PreviewCombatScenarioPanelControls
              panel="map"
              label="Map"
              collapsed={panelLayout.map.collapsed}
              onToggle={() => togglePanel('map')}
              onResize={direction => resizePanel('map', direction)}
            />
            {!panelLayout.map.collapsed && (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden pt-2">
                {renderMode === '3d' ? renderers.threeD(rendererContext) : renderers.twoD(rendererContext)}
              </div>
            )}
          </section>

          <aside
            className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto scrollable-content max-h-full"
            data-testid="preview-combat-scenario-right-rail-panel"
            data-panel-collapsed={String(panelLayout.rightRail.collapsed)}
          >
            <PreviewCombatScenarioPanelControls
              panel="rightRail"
              label="Right rail"
              collapsed={panelLayout.rightRail.collapsed}
              onToggle={() => togglePanel('rightRail')}
              onResize={direction => resizePanel('rightRail', direction)}
            />
            {!panelLayout.rightRail.collapsed && (
              <div className="flex flex-col gap-4">
                {rightRail.turn}
                {rightRail.actionEconomy}
                {rightRail.abilities}
                {rightRail.combatLog}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PreviewCombatScenarioFramework;
