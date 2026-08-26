/**
 * @file src/components/Compendium/WeaponMasteryTable.tsx
 *
 * This component renders the PHB 2024 Weapon Mastery Properties Table, showcasing all
 * 8 weapon masteries (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex) alongside their
 * weapon prerequisites, triggers, mechanics, and list of compatible weapons.
 *
 * Why it exists:
 * In D&D 5e (2024), weapon choice is driven by Mastery properties as much as raw damage dice.
 * Players building martial characters or deciding on equipment loadouts need a comprehensive
 * matrix mapping weapons to mastery mechanics and tactical battlefield synergies.
 *
 * Called by: CompendiumRuleTables.tsx, CompendiumModal.tsx, or Character Creator screens
 * Depends on: src/data/glossary/weaponMasteryData.ts, src/components/ui/Table.tsx
 */

import React, { useState, useMemo } from 'react';
import { WeaponMasteryEntry } from '../../data/glossary/types';
import { WEAPON_MASTERY_DATA } from '../../data/glossary/weaponMasteryData';
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
// Defines incoming properties for the Weapon Mastery Table.
// ============================================================================

export interface WeaponMasteryTableProps {
  /** Optional custom dataset override (defaults to canonical WEAPON_MASTERY_DATA) */
  masteries?: WeaponMasteryEntry[];
  /** Callback fired when a player clicks a linked glossary term */
  onNavigate?: (termId: string) => void;
  /** Optional initial search filter term */
  initialSearch?: string;
  /** Whether to show search header */
  showSearch?: boolean;
}

// ============================================================================
// Main Weapon Mastery Table Component
// ============================================================================
// Renders the interactive mastery table with weapon filtering and save DC highlights.
// ============================================================================

export const WeaponMasteryTable: React.FC<WeaponMasteryTableProps> = ({
  masteries = WEAPON_MASTERY_DATA,
  onNavigate,
  initialSearch = '',
  showSearch = true,
}) => {
  // Search query state
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // Filter masteries based on search input
  const filteredMasteries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return masteries;

    return masteries.filter((m) => {
      const matchName = m.name.toLowerCase().includes(term);
      const matchPrereq = m.prerequisite.toLowerCase().includes(term);
      const matchTrigger = m.trigger.toLowerCase().includes(term);
      const matchMechanic = m.mechanic.toLowerCase().includes(term);
      const matchWeapons = m.standardWeapons.some((w) => w.toLowerCase().includes(term));
      const matchNotes = m.tacticalNotes?.toLowerCase().includes(term);

      return matchName || matchPrereq || matchTrigger || matchMechanic || matchWeapons || matchNotes;
    });
  }, [masteries, searchTerm]);

  return (
    <div className="space-y-4" data-testid="weapon-mastery-table-container">
      {/* Search Header Bar */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-semibold text-sm">Weapon Masteries ({filteredMasteries.length})</span>
            <span className="text-gray-400 text-xs">Martial Tactical Properties</span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search mastery, weapon, dagger..."
              className="w-full bg-gray-950/80 border border-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 focus:outline-none focus:border-amber-400 placeholder-gray-500"
              aria-label="Search weapon masteries"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-200 text-xs"
                aria-label="Clear mastery search"
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
              <TableHead className="w-36 border-r border-gray-700">Mastery</TableHead>
              <TableHead className="w-48 border-r border-gray-700">Prerequisites & Trigger</TableHead>
              <TableHead className="w-72 border-r border-gray-700">Mechanic & Saving Throw</TableHead>
              <TableHead className="w-60 border-r border-gray-700">Compatible Weapons</TableHead>
              <TableHead className="border-r border-gray-700">Tactical Combat Notes</TableHead>
              <TableHead className="w-28">See Also</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMasteries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-gray-400">
                  No weapon masteries match &ldquo;{searchTerm}&rdquo;
                </TableCell>
              </TableRow>
            ) : (
              filteredMasteries.map((mastery) => (
                <TableRow key={mastery.id}>
                  {/* Mastery Name */}
                  <TableCell className="font-bold border-r border-gray-700/60 align-top">
                    <span className="text-sm text-amber-300 block">{mastery.name}</span>
                  </TableCell>

                  {/* Prerequisites & Trigger */}
                  <TableCell className="border-r border-gray-700/60 align-top text-xs">
                    <div className="space-y-1">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider block">Requires:</span>
                        <span className="text-gray-300 text-[11px]">{mastery.prerequisite}</span>
                      </div>
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Trigger:</span>
                        <span className="text-amber-200 text-[11px] font-medium">{mastery.trigger}</span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Mechanic & Saving Throw */}
                  <TableCell className="border-r border-gray-700/60 align-top text-xs">
                    <p className="text-gray-200 mb-2 leading-relaxed">{mastery.mechanic}</p>
                    {mastery.savingThrow && (
                      <div className="text-[11px] text-rose-300/90 bg-rose-950/30 p-1.5 rounded border border-rose-800/40 font-semibold">
                        {mastery.savingThrow}
                      </div>
                    )}
                  </TableCell>

                  {/* Standard Weapons */}
                  <TableCell className="border-r border-gray-700/60 align-top">
                    <div className="flex flex-wrap gap-1">
                      {mastery.standardWeapons.map((weapon) => (
                        <span
                          key={weapon}
                          className="text-[11px] bg-gray-950 border border-gray-700 text-gray-200 px-2 py-0.5 rounded shadow-sm"
                        >
                          {weapon}
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  {/* Tactical Notes */}
                  <TableCell className="border-r border-gray-700/60 align-top text-[11px] text-gray-300 leading-relaxed">
                    {mastery.tacticalNotes ?? '—'}
                  </TableCell>

                  {/* See Also */}
                  <TableCell className="align-top">
                    {mastery.seeAlso && mastery.seeAlso.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {mastery.seeAlso.map((termId) => (
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
