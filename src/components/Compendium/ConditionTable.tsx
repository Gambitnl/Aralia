/**
 * @file src/components/Compendium/ConditionTable.tsx
 *
 * This component renders the PHB 2024 Condition Summary Table with interactive
 * search filtering, tactical advantage/disadvantage badges, and an integrated
 * 6-level Exhaustion drawer.
 *
 * Why it exists:
 * In combat encounters, players and DMs frequently need to look up status effects
 * at a glance (e.g. "Do I get advantage against a stunned target?", "What happens at
 * Exhaustion Level 3?"). This table provides a compact, high-contrast reference
 * dashboard that can be sorted, filtered, and cross-linked with glossary terms.
 *
 * Called by: CompendiumRuleTables.tsx, CompendiumModal.tsx, or Glossary screens
 * Depends on: src/data/glossary/conditionsData.ts, src/components/ui/Table.tsx
 */

import React, { useState, useMemo } from 'react';
import { ConditionRuleEntry } from '../../data/glossary/types';
import { CONDITIONS_DATA } from '../../data/glossary/conditionsData';
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
// Defines the incoming properties for the Condition Table.
// ============================================================================

export interface ConditionTableProps {
  /** Optional custom dataset override (defaults to canonical CONDITIONS_DATA) */
  conditions?: ConditionRuleEntry[];
  /** Callback fired when a player clicks a linked glossary term */
  onNavigate?: (termId: string) => void;
  /** Optional initial search filter term */
  initialSearch?: string;
  /** Whether to show the search bar header */
  showSearch?: boolean;
}

// ============================================================================
// Helper Sub-Components
// ============================================================================
// Mini badge chips for visual tactical clarity (Advantage in green, Disadvantage in red,
// Critical hits in amber).
// ============================================================================

const AdvantageBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 mr-1.5 mb-1 shadow-sm">
    ▲ {children}
  </span>
);

const DisadvantageBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-950/70 border border-rose-500/40 text-rose-300 mr-1.5 mb-1 shadow-sm">
    ▼ {children}
  </span>
);

const CriticalBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-950/70 border border-amber-500/50 text-amber-300 mr-1.5 mb-1 shadow-sm">
    ★ {children}
  </span>
);

// ============================================================================
// Main Condition Table Component
// ============================================================================
// Renders the full conditions table with search filtering and collapsible
// Exhaustion tier breakdown.
// ============================================================================

export const ConditionTable: React.FC<ConditionTableProps> = ({
  conditions = CONDITIONS_DATA,
  onNavigate,
  initialSearch = '',
  showSearch = true,
}) => {
  // Search query state for live filtering
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // State to track if the Exhaustion details drawer is expanded
  const [isExhaustionExpanded, setIsExhaustionExpanded] = useState(false);

  // Filter conditions based on user search term
  const filteredConditions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return conditions;

    return conditions.filter((c) => {
      const matchName = c.name.toLowerCase().includes(term);
      const matchSummary = c.summary.toLowerCase().includes(term);
      const matchEffects = c.effects.some((e) => e.toLowerCase().includes(term));
      const matchNotes = c.phb2024Notes?.toLowerCase().includes(term);
      return matchName || matchSummary || matchEffects || matchNotes;
    });
  }, [conditions, searchTerm]);

  return (
    <div className="space-y-4" data-testid="condition-table-container">
      {/* Search Header Bar */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-semibold text-sm">Conditions ({filteredConditions.length})</span>
            <span className="text-gray-400 text-xs">PHB 2024 Reference</span>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conditions, effects..."
              className="w-full bg-gray-950/80 border border-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-amber-400 placeholder-gray-500"
              aria-label="Search conditions"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-200 text-xs"
                aria-label="Clear condition search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Condition Table */}
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36 border-r border-gray-700">Condition</TableHead>
              <TableHead className="w-72 border-r border-gray-700">Summary & Effects</TableHead>
              <TableHead className="w-56 border-r border-gray-700">Attacks & Saves</TableHead>
              <TableHead className="border-r border-gray-700">Movement & Tactical Notes</TableHead>
              <TableHead className="w-32">Cross References</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConditions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                  No conditions found matching &ldquo;{searchTerm}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              filteredConditions.map((condition) => {
                const isExhaustion = condition.id === 'exhaustion';

                return (
                  <React.Fragment key={condition.id}>
                    <TableRow className={isExhaustion ? 'bg-amber-950/20' : ''}>
                      {/* Condition Name */}
                      <TableCell className="font-bold text-amber-300 border-r border-gray-700/60 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{condition.name}</span>
                          {isExhaustion && (
                            <button
                              type="button"
                              onClick={() => setIsExhaustionExpanded(!isExhaustionExpanded)}
                              className="text-[11px] text-sky-400 hover:text-sky-300 text-left underline focus:outline-none"
                              data-testid="toggle-exhaustion-tiers"
                            >
                              {isExhaustionExpanded ? '▲ Hide 6 Tiers' : '▼ Show 6 Tiers'}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Summary & Bullet Effects */}
                      <TableCell className="border-r border-gray-700/60 align-top">
                        <p className="text-xs text-gray-200 mb-2 font-medium leading-relaxed">
                          {condition.summary}
                        </p>
                        {condition.effects.length > 0 && (
                          <ul className="space-y-1 text-[11px] text-gray-400 list-disc list-inside">
                            {condition.effects.map((effect, idx) => (
                              <li key={idx} className="leading-snug">{effect}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>

                      {/* Attacks & Saving Throws Modifiers */}
                      <TableCell className="border-r border-gray-700/60 align-top">
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {condition.attackModifications?.attacksAgainstHaveAdvantage && (
                            <AdvantageBadge>Attacks Against</AdvantageBadge>
                          )}
                          {condition.attackModifications?.attacksMadeHaveDisadvantage && (
                            <DisadvantageBadge>Attacks Made</DisadvantageBadge>
                          )}
                          {condition.attackModifications?.autoCriticalWithin5Feet && (
                            <CriticalBadge>Auto-Crit within 5 ft</CriticalBadge>
                          )}
                        </div>

                        {condition.attackModifications?.details && (
                          <p className="text-[11px] text-gray-300 mb-1 leading-snug">
                            {condition.attackModifications.details}
                          </p>
                        )}

                        {condition.savingThrowEffects && (
                          <p className="text-[11px] text-amber-200/90 leading-snug">
                            <span className="font-semibold text-amber-400">Saves: </span>
                            {condition.savingThrowEffects}
                          </p>
                        )}
                      </TableCell>

                      {/* Movement & 2024 Notes */}
                      <TableCell className="border-r border-gray-700/60 align-top text-[11px]">
                        {condition.movementRestrictions && (
                          <div className="mb-1.5">
                            <span className="font-semibold text-rose-300">Movement: </span>
                            <span className="text-gray-300">{condition.movementRestrictions}</span>
                          </div>
                        )}
                        {condition.phb2024Notes && (
                          <div className="text-sky-300/90 bg-sky-950/30 p-1.5 rounded border border-sky-800/40">
                            <span className="font-bold text-sky-400">2024 Rule: </span>
                            {condition.phb2024Notes}
                          </div>
                        )}
                      </TableCell>

                      {/* Cross-Link See Also */}
                      <TableCell className="align-top">
                        {condition.seeAlso && condition.seeAlso.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {condition.seeAlso.map((termId) => (
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

                    {/* Exhaustion 6-Tier Expanded Sub-Table */}
                    {isExhaustion && isExhaustionExpanded && condition.exhaustionTiers && (
                      <TableRow className="bg-gray-950/80">
                        <TableCell colSpan={5} className="p-3">
                          <div className="border border-amber-600/50 rounded-lg p-3 bg-gray-900/90 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                                PHB 2024 Exhaustion Tiers (Cumulative -2 to d20 tests, -5 ft speed per tier)
                              </h4>
                              <span className="text-[11px] text-gray-400">Long Rest removes 1 level</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                              {condition.exhaustionTiers.map((tier) => (
                                <div
                                  key={tier.level}
                                  className={`p-2 rounded border text-xs ${
                                    tier.level === 6
                                      ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 font-bold'
                                      : 'bg-gray-950 border-gray-700 text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-amber-400">Level {tier.level}</span>
                                    <span className="text-rose-400 font-semibold">{tier.d20Penalty} to d20 Tests</span>
                                  </div>
                                  <div className="text-[11px] text-gray-400">
                                    Speed -{tier.speedReductionFeet} ft
                                  </div>
                                  {tier.specialEffect && (
                                    <div className="text-[10px] text-amber-300/80 mt-1">
                                      {tier.specialEffect}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
