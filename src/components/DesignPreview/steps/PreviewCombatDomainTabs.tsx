// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 10:51:36
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines and renders the shared domain tabs at the top of the Tactical Sandbox.
 *
 * The Rules, Classes, Races, and Spells lanes use this one accessible shell so a new domain
 * can join the window without changing its own mechanics or the host's navigation behavior.
 * The parent host supplies each panel's renderer; inactive panels stay mounted and hidden so
 * switching domains cannot reset a live Rules scenario, its logs, or its 2D/3D view.
 *
 * Called by: PreviewCombatScenarios, the central Tactical Sandbox host.
 * Depends on: React only; domain modules depend on the tab-definition contract exported here.
 */

import React, { useRef, useState } from 'react';
import { Button } from '../../ui/Button';

// ============================================================================
// Domain Registration Contract
// ============================================================================
// Every peer domain exports one definition with a stable id, plain-language copy,
// and a renderer. Keeping the contract here means Classes, Races, and Spells do
// not need to know how the host stores its tab state or styles its tab strip.
// ============================================================================

export const PREVIEW_COMBAT_DOMAIN_TAB_ORDER = ['rules', 'classes', 'races', 'spells'] as const;

export type PreviewCombatDomainTabId = (typeof PREVIEW_COMBAT_DOMAIN_TAB_ORDER)[number];

export interface PreviewCombatDomainTabModule {
  id: PreviewCombatDomainTabId;
  label: string;
  description: string;
  render: () => React.ReactNode;
}

/**
 * Define a peer domain tab without exposing any shell implementation details.
 *
 * This identity helper gives each domain module a named import contract and leaves
 * the returned renderer untouched, which is important for preserving panel state.
 */
export function definePreviewCombatDomainTab(
  tab: PreviewCombatDomainTabModule,
): PreviewCombatDomainTabModule {
  return tab;
}

/**
 * Build the stable top-level order from the modules supplied by the host.
 *
 * The registry rejects duplicate ids early because rendering two panels for one
 * domain would make aria-controls and keyboard selection ambiguous. Missing peer
 * modules are allowed so a partial build can still land Rules and add other lanes
 * later without inventing placeholder mechanics.
 */
export function createPreviewCombatDomainTabRegistry(
  tabs: readonly PreviewCombatDomainTabModule[],
): readonly PreviewCombatDomainTabModule[] {
  const seen = new Set<PreviewCombatDomainTabId>();

  // Check the registration contract before sorting, so a peer mistake points at
  // the domain id instead of failing later in the rendered tab relationships.
  for (const tab of tabs) {
    if (seen.has(tab.id)) {
      throw new Error(`Duplicate Tactical Sandbox domain tab: ${tab.id}`);
    }
    seen.add(tab.id);
  }

  // Sort only by the canonical four-domain order. Array order from peer modules
  // therefore cannot accidentally move Rules away from its landing position.
  return [...tabs].sort(
    (left, right) =>
      PREVIEW_COMBAT_DOMAIN_TAB_ORDER.indexOf(left.id) -
      PREVIEW_COMBAT_DOMAIN_TAB_ORDER.indexOf(right.id),
  );
}

// ============================================================================
// Shared Tab Shell
// ============================================================================
// The shell owns only navigation state. Domain panels remain mounted while hidden
// so switching tabs changes visibility without unmounting a live combat sandbox.
// ============================================================================

export interface PreviewCombatDomainTabsProps {
  tabs: readonly PreviewCombatDomainTabModule[];
  activeTabId?: PreviewCombatDomainTabId;
  defaultActiveTabId?: PreviewCombatDomainTabId;
  onActiveTabChange?: (tabId: PreviewCombatDomainTabId) => void;
  ariaLabel?: string;
  className?: string;
}

function resolveLandingTabId(
  tabs: readonly PreviewCombatDomainTabModule[],
  requestedTabId: PreviewCombatDomainTabId | undefined,
): PreviewCombatDomainTabId {
  // Rules is the deliberate landing page whenever the host has registered it.
  // This keeps the existing Combat Scenarios experience as the default surface.
  if (requestedTabId && tabs.some(tab => tab.id === requestedTabId)) {
    return requestedTabId;
  }

  if (tabs.some(tab => tab.id === 'rules')) {
    return 'rules';
  }

  // An empty registry is not useful to the host, but returning the first item
  // keeps the shell safe for focused peer-module tests and staged integration.
  return tabs[0]?.id ?? 'rules';
}

export function PreviewCombatDomainTabs({
  tabs,
  activeTabId,
  defaultActiveTabId = 'rules',
  onActiveTabChange,
  ariaLabel = 'Tactical Sandbox domains',
  className = '',
}: PreviewCombatDomainTabsProps): React.ReactElement {
  const registry = createPreviewCombatDomainTabRegistry(tabs);
  const [uncontrolledActiveTabId, setUncontrolledActiveTabId] = useState(() =>
    resolveLandingTabId(registry, defaultActiveTabId),
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedTabId = resolveLandingTabId(registry, activeTabId ?? uncontrolledActiveTabId);
  const selectedTabIndex = Math.max(
    0,
    registry.findIndex(tab => tab.id === selectedTabId),
  );

  // Update the local selection only in uncontrolled mode, then notify the host
  // so a parent that owns the URL or other shared state can mirror the choice.
  const selectTab = (tabId: PreviewCombatDomainTabId) => {
    if (activeTabId === undefined) {
      setUncontrolledActiveTabId(tabId);
    }
    onActiveTabChange?.(tabId);
  };

  // Arrow keys wrap within the registered tabs; Home and End provide a fast
  // route for keyboard users when the responsive strip has many domains.
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % registry.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + registry.length) % registry.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = registry.length - 1;
    }

    if (nextIndex === undefined || registry.length === 0) {
      return;
    }

    event.preventDefault();
    const nextTab = registry[nextIndex];
    selectTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/80 ${className}`}
      data-testid="preview-combat-domain-tabs"
    >
      <div
        aria-label={ariaLabel}
        className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-800/90 p-1.5 [scrollbar-width:thin]"
        role="tablist"
      >
        {registry.map((tab, index) => {
          const isSelected = tab.id === selectedTabId;
          const tabId = `preview-combat-domain-tab-${tab.id}`;
          const panelId = `preview-combat-domain-panel-${tab.id}`;

          return (
            <Button
              ref={element => {
                tabRefs.current[index] = element;
              }}
              aria-controls={panelId}
              aria-selected={isSelected}
              className={`min-w-[6.5rem] shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:min-w-[7rem] ${
                isSelected
                  ? 'border-amber-400/80 bg-amber-500/15 text-amber-200 shadow-[inset_0_-2px_0_rgba(251,191,36,0.9)]'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100'
              }`}
              data-selected={isSelected ? 'true' : 'false'}
              id={tabId}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              <span className="block truncate">{tab.label}</span>
              <span className="mt-1 block truncate text-[9px] font-normal normal-case tracking-normal text-slate-500">
                {tab.description}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="min-w-0">
        {registry.map((tab, index) => {
          const isSelected = index === selectedTabIndex;
          const tabId = `preview-combat-domain-tab-${tab.id}`;
          const panelId = `preview-combat-domain-panel-${tab.id}`;

          return (
            <section
              aria-labelledby={tabId}
              className="min-w-0 p-2 sm:p-3"
              data-domain-panel={tab.id}
              hidden={!isSelected}
              id={panelId}
              key={tab.id}
              role="tabpanel"
            >
              {tab.render()}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default PreviewCombatDomainTabs;
