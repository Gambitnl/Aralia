/**
 * @file src/components/Compendium/CoverObscurementTable.tsx
 *
 * This component renders the PHB 2024 Cover and Obscurement rule table, displaying
 * defense bonuses, line-of-sight blocks, sensory perception penalties, and real combat
 * battlefield examples.
 *
 * Why it exists:
 * In tactical combat and stealth scenarios, players and DMs need unambiguous confirmation
 * of what modifiers an obstacle grants (+2 AC for low walls, +5 AC for arrow slits, line of
 * sight immunity for total cover, and perception disadvantage in dim light/fog). This component
 * presents these mechanics clearly in an interactive table.
 *
 * Called by: CompendiumRuleTables.tsx, CompendiumModal.tsx, or Glossary screens
 * Depends on: src/data/glossary/coverObscurementData.ts, src/components/ui/Table.tsx
 */

import React, { useState, useMemo } from 'react';
import { CoverObscurementEntry, CoverOrObscurementType } from '../../data/glossary/types';
import { COVER_OBSCUREMENT_DATA } from '../../data/glossary/coverObscurementData';
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
// Defines incoming properties for the Cover & Obscurement Table.
// ============================================================================

export interface CoverObscurementTableProps {
  /** Optional custom dataset override (defaults to canonical COVER_OBSCUREMENT_DATA) */
  items?: CoverObscurementEntry[];
  /** Callback fired when a player clicks a linked glossary term */
  onNavigate?: (termId: string) => void;
  /** Optional initial search filter term */
  initialSearch?: string;
  /** Whether to show the search and filter header bar */
  showSearch?: boolean;
}

// ============================================================================
// Main Cover & Obscurement Component
// ============================================================================
// Renders the interactive table with type filtering (All vs Cover vs Obscurement).
// ============================================================================

export const CoverObscurementTable: React.FC<CoverObscurementTableProps> = ({
  items = COVER_OBSCUREMENT_DATA,
  onNavigate,
  initialSearch = '',
  showSearch = true,
}) => {
  // State for search query and type filter
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<'all' | CoverOrObscurementType>('all');

  // Filter items by type and search keyword
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      if (!term) return true;

      const matchName = item.name.toLowerCase().includes(term);
      const matchDesc = item.description.toLowerCase().includes(term);
      const matchExamples = item.examples.some((ex) => ex.toLowerCase().includes(term));
      const matchEffect = item.perceptionEffect?.toLowerCase().includes(term) ||
        item.targetingRestriction?.toLowerCase().includes(term);

      return matchName || matchDesc || matchExamples || matchEffect;
    });
  }, [items, searchTerm, typeFilter]);

  return (
    <div className="space-y-4" data-testid="cover-obscurement-table-container">
      {/* Search & Filter Header Bar */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-950/80 p-1 rounded border border-gray-800">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All Rules ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('cover')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                typeFilter === 'cover'
                  ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Cover (3)
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('obscurement')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                typeFilter === 'obscurement'
                  ? 'bg-purple-500/20 border border-purple-400 text-purple-300'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Obscurement (2)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search cover, fog, darkness..."
              className="w-full bg-gray-950/80 border border-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-amber-400 placeholder-gray-500"
              aria-label="Search cover and obscurement"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-200 text-xs"
                aria-label="Clear cover search"
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
              <TableHead className="w-44 border-r border-gray-700">Type & Rule</TableHead>
              <TableHead className="w-32 border-r border-gray-700">AC & Saves</TableHead>
              <TableHead className="w-72 border-r border-gray-700">Mechanics & Target Restrictions</TableHead>
              <TableHead className="border-r border-gray-700">Battlefield Examples</TableHead>
              <TableHead className="w-32">See Also</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-400">
                  No cover or obscurement rules match &ldquo;{searchTerm}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isCover = item.type === 'cover';

                return (
                  <TableRow key={item.id}>
                    {/* Name & Type Badge */}
                    <TableCell className="font-bold border-r border-gray-700/60 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-amber-300">{item.name}</span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold w-max ${
                            isCover
                              ? 'bg-sky-950/70 border border-sky-600/40 text-sky-300'
                              : 'bg-purple-950/70 border border-purple-600/40 text-purple-300'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>
                    </TableCell>

                    {/* AC & Dexterity Save Bonuses */}
                    <TableCell className="border-r border-gray-700/60 align-top">
                      {item.acBonus ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 w-max shadow-sm">
                            +{item.acBonus} to AC
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 w-max shadow-sm">
                            +{item.dexSaveBonus} to Dex Saves
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Mechanics & Target Restrictions */}
                    <TableCell className="border-r border-gray-700/60 align-top text-xs">
                      <p className="text-gray-200 mb-2 leading-relaxed">{item.description}</p>
                      {item.targetingRestriction && (
                        <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-1.5 rounded border border-amber-800/40 mb-1">
                          <span className="font-bold text-amber-400">Targeting: </span>
                          {item.targetingRestriction}
                        </div>
                      )}
                      {item.perceptionEffect && (
                        <div className="text-[11px] text-purple-300/90 bg-purple-950/30 p-1.5 rounded border border-purple-800/40">
                          <span className="font-bold text-purple-400">Perception: </span>
                          {item.perceptionEffect}
                        </div>
                      )}
                    </TableCell>

                    {/* Environmental Examples */}
                    <TableCell className="border-r border-gray-700/60 align-top text-[11px]">
                      <ul className="space-y-1 text-gray-300 list-disc list-inside">
                        {item.examples.map((example, idx) => (
                          <li key={idx} className="leading-snug">{example}</li>
                        ))}
                      </ul>
                    </TableCell>

                    {/* Cross-Link See Also */}
                    <TableCell className="align-top">
                      {item.seeAlso && item.seeAlso.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.seeAlso.map((termId) => (
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
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
