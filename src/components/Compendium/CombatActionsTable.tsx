/**
 * @file src/components/Compendium/CombatActionsTable.tsx
 *
 * This component renders the PHB 2024 Actions in Combat Reference Table, organizing
 * standard actions, reactions, bonus actions, and special tactical options like Unarmed Strikes
 * and the Study action.
 *
 * Why it exists:
 * Action economy is the heartbeat of D&D 5e combat. The 2024 revision overhauled multiple
 * action rules (such as unifying spellcasting into the "Magic" action, creating the "Study"
 * action for recalling monster lore mid-combat, and standardizing DC 15 Hide checks). This
 * table allows players to quickly audit what they can do on their turn or reaction.
 *
 * Called by: CompendiumRuleTables.tsx, CompendiumModal.tsx, or Glossary screens
 * Depends on: src/data/glossary/combatActionsData.ts, src/components/ui/Table.tsx
 */

import React, { useState, useMemo } from 'react';
import { CombatActionEntry, ActionEconomyType } from '../../data/glossary/types';
import { COMBAT_ACTIONS_DATA } from '../../data/glossary/combatActionsData';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';

// ============================================================================
// Props & Types
// ============================================================================
// Defines incoming properties for the Combat Actions Table.
// ============================================================================

export interface CombatActionsTableProps {
  /** Optional custom dataset override (defaults to canonical COMBAT_ACTIONS_DATA) */
  actions?: CombatActionEntry[];
  /** Callback fired when a player clicks a linked glossary term */
  onNavigate?: (termId: string) => void;
  /** Optional initial search filter term */
  initialSearch?: string;
  /** Whether to show search and action economy filter header */
  showSearch?: boolean;
}

// ============================================================================
// Action Economy Badge Sub-Component
// ============================================================================
// Colored badges representing the action cost.
// ============================================================================

const ActionEconomyBadge: React.FC<{ type: ActionEconomyType }> = ({ type }) => {
  let styleClasses = 'bg-sky-950/80 border-sky-500/50 text-sky-300';

  if (type === 'Bonus Action') {
    styleClasses = 'bg-amber-950/80 border-amber-500/50 text-amber-300';
  } else if (type === 'Reaction') {
    styleClasses = 'bg-purple-950/80 border-purple-500/50 text-purple-300';
  } else if (type === 'Free / Movement') {
    styleClasses = 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
  }

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border tracking-wider ${styleClasses}`}>
      {type}
    </span>
  );
};

// ============================================================================
// Main Combat Actions Table Component
// ============================================================================
// Renders the interactive table with action economy filtering and step-by-step rules.
// ============================================================================

export const CombatActionsTable: React.FC<CombatActionsTableProps> = ({
  actions = COMBAT_ACTIONS_DATA,
  onNavigate,
  initialSearch = '',
  showSearch = true,
}) => {
  // Search query and economy filter states
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [economyFilter, setEconomyFilter] = useState<'all' | ActionEconomyType>('all');

  // Filter actions based on economy type and search term
  const filteredActions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return actions.filter((act) => {
      if (economyFilter !== 'all' && act.actionType !== economyFilter) {
        return false;
      }

      if (!term) return true;

      const matchName = act.name.toLowerCase().includes(term);
      const matchSummary = act.summary.toLowerCase().includes(term);
      const matchRules = act.detailedRules.some((r) => r.toLowerCase().includes(term));
      const matchSubtypes = act.subtypesOrOptions?.some((s) => s.toLowerCase().includes(term));
      const matchChanges = act.phb2024Changes?.toLowerCase().includes(term);

      return matchName || matchSummary || matchRules || matchSubtypes || matchChanges;
    });
  }, [actions, searchTerm, economyFilter]);

  return (
    <div className="space-y-4" data-testid="combat-actions-table-container">
      {/* Filter and Search Bar */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
          {/* Economy Filters */}
          <div className="flex items-center gap-1.5 bg-gray-950/80 p-1 rounded border border-gray-800 flex-wrap">
            <button
              type="button"
              onClick={() => setEconomyFilter('all')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                economyFilter === 'all'
                  ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All ({actions.length})
            </button>
            <button
              type="button"
              onClick={() => setEconomyFilter('Action')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                economyFilter === 'Action'
                  ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Action
            </button>
            <button
              type="button"
              onClick={() => setEconomyFilter('Reaction')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                economyFilter === 'Reaction'
                  ? 'bg-purple-500/20 border border-purple-400 text-purple-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Reaction
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actions, hide, study..."
              className="w-full bg-gray-950/80 border border-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-amber-400 placeholder-gray-500"
              aria-label="Search combat actions"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-200 text-xs"
                aria-label="Clear action search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48 border-r border-gray-700">Action & Cost</TableHead>
              <TableHead className="w-72 border-r border-gray-700">Summary & Subtypes</TableHead>
              <TableHead className="border-r border-gray-700">Step-by-Step Resolution Rules</TableHead>
              <TableHead className="w-64 border-r border-gray-700">PHB 2024 Revision Notes</TableHead>
              <TableHead className="w-32">See Also</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                  No combat actions match &ldquo;{searchTerm}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              filteredActions.map((action) => (
                <TableRow key={action.id}>
                  {/* Action Name & Economy Type */}
                  <TableCell className="font-bold border-r border-gray-700/60 align-top">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-amber-300">{action.name}</span>
                      <ActionEconomyBadge type={action.actionType} />
                      {action.triggerOrPrerequisite && (
                        <div className="text-[10px] text-amber-400/90 font-normal mt-1 bg-amber-950/30 p-1 rounded border border-amber-700/30">
                          <span className="font-bold">Trigger: </span>
                          {action.triggerOrPrerequisite}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Summary & Subtypes */}
                  <TableCell className="border-r border-gray-700/60 align-top text-xs">
                    <p className="text-gray-200 mb-2 leading-relaxed font-medium">{action.summary}</p>
                    {action.subtypesOrOptions && action.subtypesOrOptions.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Sub-options:</span>
                        <div className="flex flex-wrap gap-1">
                          {action.subtypesOrOptions.map((opt, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-gray-800/90 text-gray-300 border border-gray-700 px-1.5 py-0.5 rounded"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </TableCell>

                  {/* Detailed Rules */}
                  <TableCell className="border-r border-gray-700/60 align-top text-[11px]">
                    <ul className="space-y-1 text-gray-300 list-disc list-inside">
                      {action.detailedRules.map((rule, idx) => (
                        <li key={idx} className="leading-snug">{rule}</li>
                      ))}
                    </ul>
                  </TableCell>

                  {/* 2024 Rule Updates */}
                  <TableCell className="border-r border-gray-700/60 align-top text-[11px]">
                    {action.phb2024Changes ? (
                      <div className="text-emerald-300/90 bg-emerald-950/30 p-2 rounded border border-emerald-700/40 leading-relaxed">
                        <span className="font-bold text-emerald-400">2024 Change: </span>
                        {action.phb2024Changes}
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </TableCell>

                  {/* Cross-Link See Also */}
                  <TableCell className="align-top">
                    {action.seeAlso && action.seeAlso.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {action.seeAlso.map((termId) => (
                          <button
                            key={termId}
                            type="button"
                            onClick={() => onNavigate?.(termId)}
                            className="text-[10px] text-sky-400 hover:text-sky-200 bg-sky-900/40 hover:bg-sky-800/60 border border-sky-600/30 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {termId.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-[11px]">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
