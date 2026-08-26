/**
 * @file src/components/Compendium/CompendiumRuleTables.tsx
 *
 * This component is the primary unified dashboard for PHB 2024 structured rule tables.
 *
 * Why it exists:
 * Players and game masters need a single, searchable compendium interface that aggregates
 * all core tactical rule tables:
 * 1. Conditions Summary & Exhaustion Tiers
 * 2. Cover & Obscurement Modifiers
 * 3. Actions in Combat Reference
 * 4. Weapon Mastery Properties
 *
 * It provides top-level category tabs, live cross-table keyword searching, and direct
 * navigation callbacks to the wider Glossary system.
 *
 * Called by: CompendiumModal.tsx, or embedded directly in Glossary/Character Sheet pages
 * Depends on: ConditionTable, CoverObscurementTable, CombatActionsTable, WeaponMasteryTable,
 *             and searchRuleTables
 */

import React, { useState, useMemo } from 'react';
import { RuleTableCategory } from '../../data/glossary/types';
import { searchRuleTables } from '../../data/glossary/searchIndex';
import { ConditionTable } from './ConditionTable';
import { CoverObscurementTable } from './CoverObscurementTable';
import { CombatActionsTable } from './CombatActionsTable';
import { WeaponMasteryTable } from './WeaponMasteryTable';

// ============================================================================
// Props & Tab Types
// ============================================================================
// Defines the tab options and incoming properties for the rule tables view.
// ============================================================================

export type CompendiumTab = 'all' | RuleTableCategory;

export interface CompendiumRuleTablesProps {
  /** Initial active tab */
  initialTab?: CompendiumTab;
  /** Optional callback when clicking a glossary cross-reference link */
  onNavigate?: (termId: string) => void;
  /** Custom class name for wrapping container */
  className?: string;
}

// ============================================================================
// Unified Compendium Rule Tables Component
// ============================================================================
// Renders tabbed navigation, unified search bar, and active table views.
// ============================================================================

export const CompendiumRuleTables: React.FC<CompendiumRuleTablesProps> = ({
  initialTab = 'conditions',
  onNavigate,
  className = '',
}) => {
  // State for active tab and master search string
  const [activeTab, setActiveTab] = useState<CompendiumTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Results for the unified "All Tables" search tab
  const unifiedSearchResults = useMemo(() => {
    if (activeTab !== 'all') return [];
    return searchRuleTables(searchQuery);
  }, [activeTab, searchQuery]);

  return (
    <div className={`flex flex-col space-y-4 text-gray-100 ${className}`} data-testid="compendium-rule-tables">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gray-950/80 p-3 rounded-lg border border-gray-800 shadow-md">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('conditions')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'conditions'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            data-testid="tab-conditions"
          >
            🛡️ Conditions & Exhaustion
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cover_obscurement')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'cover_obscurement'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/60 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            data-testid="tab-cover"
          >
            🧱 Cover & Obscurement
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('combat_actions')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'combat_actions'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/60 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            data-testid="tab-actions"
          >
            ⚡ Combat Actions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weapon_mastery')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'weapon_mastery'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            data-testid="tab-masteries"
          >
            ⚔️ Weapon Masteries
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
            data-testid="tab-all"
          >
            🔍 Search All Rules
          </button>
        </div>

        {/* Global Search Box for 'all' tab */}
        {activeTab === 'all' && (
          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all 4 rule tables..."
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-amber-400 placeholder-gray-500"
              aria-label="Global rule search"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-200 text-xs"
                aria-label="Clear global search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {activeTab === 'conditions' && (
          <ConditionTable onNavigate={onNavigate} />
        )}

        {activeTab === 'cover_obscurement' && (
          <CoverObscurementTable onNavigate={onNavigate} />
        )}

        {activeTab === 'combat_actions' && (
          <CombatActionsTable onNavigate={onNavigate} />
        )}

        {activeTab === 'weapon_mastery' && (
          <WeaponMasteryTable onNavigate={onNavigate} />
        )}

        {activeTab === 'all' && (
          <div className="space-y-3" data-testid="unified-search-results">
            <div className="text-xs text-gray-400 mb-2">
              Found <span className="text-amber-400 font-bold">{unifiedSearchResults.length}</span> matching rule entries across all tables:
            </div>

            {unifiedSearchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-900/40 rounded-lg border border-gray-800">
                No rules found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unifiedSearchResults.map((result) => {
                  let categoryBadgeStyle = 'bg-amber-950/70 border-amber-600/40 text-amber-300';
                  let categoryLabel = 'Condition';

                  if (result.category === 'cover_obscurement') {
                    categoryBadgeStyle = 'bg-sky-950/70 border-sky-600/40 text-sky-300';
                    categoryLabel = 'Cover & Obscurement';
                  } else if (result.category === 'combat_actions') {
                    categoryBadgeStyle = 'bg-purple-950/70 border-purple-600/40 text-purple-300';
                    categoryLabel = 'Combat Action';
                  } else if (result.category === 'weapon_mastery') {
                    categoryBadgeStyle = 'bg-emerald-950/70 border-emerald-600/40 text-emerald-300';
                    categoryLabel = 'Weapon Mastery';
                  }

                  return (
                    <div
                      key={`${result.category}-${result.id}`}
                      className="p-3.5 rounded-lg bg-gray-900/60 border border-gray-700/60 hover:border-amber-400/60 transition-colors flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-bold text-amber-300">{result.title}</h4>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${categoryBadgeStyle}`}>
                            {categoryLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-medium mb-1.5">
                          {result.subtitle}
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                          {result.snippet}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveTab(result.category)}
                          className="text-amber-400 hover:text-amber-200 text-[11px] font-semibold"
                        >
                          View Table →
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate?.(result.id)}
                          className="text-sky-400 hover:text-sky-200 text-[11px] underline"
                        >
                          Open in Glossary
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
