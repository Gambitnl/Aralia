/**
 * ARCHITECTURAL CONTEXT:
 * This component is an artisanal spell selection tool used exclusively 
 * within the 'Feat Selection' workflow. It handles multi-spell requirements 
 * with granular filtering (school, name) and rich visual feedback.
 *
 * Recent updates focus on 'UI Polish' and 'Selection Ergonomics'.
 * - Refined selection behavior to use a 'FIFO' (First-In, First-Out) 
 *   replacement model when the maximum spell count is reached. This 
 *   allows for quick selection adjustments without requiring manual 
 *   de-selection of previous choices.
 * - Standardized control styling (search input, school filter) to use 
 *   subtle transparency (`bg-gray-900/60`) and consistent sky-themed 
 *   focus states, aligning with the premium 'Aralia' design language.
 * - Integrated `AnimatePresence` with `popLayout` to ensure that 
 *   filtering and expansion transitions feel smooth and non-jarring.
 * 
 * @file src/components/CharacterCreator/FeatSpellPicker.tsx
 */
import React, { useState, useMemo, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeatSpellRequirement, SpellSchool } from '../../types';
import SpellContext from '../../context/SpellContext';
import {
  filterSpellsForRequirement,
  getSchoolIcon,
  getSchoolColorClass,
  getSchoolBgClass,
  getSpellLevelLabel,
  formatCastingTime,
} from '../../utils/spellFilterUtils';

interface FeatSpellPickerProps {
  /** The spell requirement configuration */
  requirement: FeatSpellRequirement;
  /** Currently selected spell IDs */
  selectedSpellIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (spellIds: string[]) => void;
  /** Optional class source for Magic Initiate filtering */
  selectedSpellSource?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

const FeatSpellPicker: React.FC<FeatSpellPickerProps> = ({
  requirement,
  selectedSpellIds,
  onSelectionChange,
  selectedSpellSource,
  disabled = false,
}) => {
  const allSpells = useContext(SpellContext);
  const [expandedSpellId, setExpandedSpellId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | 'all'>('all');

  // Filter available spells based on requirement
  const availableSpells = useMemo(() => {
    if (!allSpells) return [];
    return filterSpellsForRequirement(allSpells, requirement, selectedSpellSource);
  }, [allSpells, requirement, selectedSpellSource]);

  // Apply search and school filters
  const filteredSpells = useMemo(() => {
    return availableSpells.filter((spell) => {
      const matchesSearch = spell.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSchool = schoolFilter === 'all' || spell.school === schoolFilter;
      return matchesSearch && matchesSchool;
    });
  }, [availableSpells, searchQuery, schoolFilter]);

  // Get unique schools for filter dropdown
  const uniqueSchools = useMemo(() => {
    const schools = new Set(availableSpells.map((s) => s.school).filter(Boolean));
    return Array.from(schools) as SpellSchool[];
  }, [availableSpells]);

  const handleSpellToggle = useCallback(
    (spellId: string) => {
      if (disabled) return;

      const isSelected = selectedSpellIds.includes(spellId);
      let newSelection: string[];

      if (isSelected) {
        // Deselect
        newSelection = selectedSpellIds.filter((id) => id !== spellId);
      } else if (selectedSpellIds.length < requirement.count) {
        // Add to selection
        newSelection = [...selectedSpellIds, spellId];
      } else {
        // WHAT CHANGED: Implemented FIFO replacement.
        // WHY IT CHANGED: Provides a better UX for multi-pick requirements. 
        // If the user has picked 2 out of 2 spells and clicks a 3rd one, 
        // we replace the first choice instead of just ignoring the click.
        newSelection = [...selectedSpellIds.slice(1), spellId];
      }

      onSelectionChange(newSelection);
    },
    [disabled, selectedSpellIds, requirement.count, onSelectionChange]
  );

  const selectionProgress = `${selectedSpellIds.length}/${requirement.count}`;
  const isComplete = selectedSpellIds.length === requirement.count;

  // Loading state
  if (!allSpells) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="animate-pulse">Loading spell data...</div>
      </div>
    );
  }

  // Empty state
  if (availableSpells.length === 0) {
    return (
      <div className="text-center py-8 text-amber-500/80">
        <p>No spells available for this selection.</p>
        <p className="text-sm text-gray-500 mt-2">
          {selectedSpellSource
            ? `No matching spells found in the ${selectedSpellSource} spell list.`
            : 'The required spells may not be loaded yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with requirement description */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-sky-300 font-cinzel text-sm font-semibold tracking-wide">
            {getSpellLevelLabel(requirement.level)} Selection
          </h4>
          <div className="mt-0.5 mb-1.5 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
          <p className="text-xs text-gray-400">{requirement.description}</p>
        </div>
        <div
          className={`
            px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0
            ${
              isComplete
                ? 'bg-green-900/50 text-green-300 border border-green-700/60'
                : 'bg-gray-800/80 text-gray-400 border border-gray-700/60'
            }
          `}
        >
          {selectionProgress}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search spells…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-1.5 bg-gray-900/60 border border-gray-700/60
                     rounded-lg text-sm text-gray-200 placeholder-gray-600
                     focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 outline-none
                     transition-colors"
        />
        {uniqueSchools.length > 1 && (
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value as SpellSchool | 'all')}
            className="px-3 py-1.5 bg-gray-900/60 border border-gray-700/60 rounded-lg
                       text-sm text-gray-200 focus:border-sky-500/60 outline-none cursor-pointer
                       transition-colors"
          >
            <option value="all">All Schools</option>
            {uniqueSchools.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Spell Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        <AnimatePresence mode="popLayout">
          {filteredSpells.map((spell) => {
            const isSelected = selectedSpellIds.includes(spell.id);
            const isExpanded = expandedSpellId === spell.id;

            return (
              <motion.div
                key={spell.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`
                  relative rounded-lg border cursor-pointer transition-all duration-200
                  ${
                    isSelected
                      ? 'bg-amber-900/30 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {/* Main clickable area */}
                <div
                  onClick={() => handleSpellToggle(spell.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSpellToggle(spell.id);
                    }
                  }}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-pressed={isSelected}
                  aria-disabled={disabled}
                  className="p-3"
                >
                  <div className="flex items-start gap-3">
                    {/* School Icon */}
                    <div
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0
                        ${getSchoolBgClass(spell.school || '')} border
                      `}
                    >
                      {getSchoolIcon(spell.school || '')}
                    </div>

                    {/* Spell Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5
                          className={`
                            font-semibold truncate
                            ${isSelected ? 'text-amber-300' : 'text-gray-200'}
                          `}
                        >
                          {spell.name}
                        </h5>
                        {isSelected && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 text-amber-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </motion.svg>
                        )}
                      </div>

                      {/* School Badge + Casting Time */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs ${getSchoolColorClass(spell.school || '')}`}>
                          {spell.school}
                        </span>
                        {spell.castingTime && (
                          <span className="text-xs text-gray-500">
                            {formatCastingTime(spell.castingTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSpellId(isExpanded ? null : spell.id);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                      aria-label={isExpanded ? 'Collapse spell details' : 'Expand spell details'}
                    >
                      <svg
                        className={`w-5 h-5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded description */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-gray-700/50">
                        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                          {spell.description}
                        </p>
                        {spell.higherLevels && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            <strong className="text-gray-400">At Higher Levels:</strong>{' '}
                            {spell.higherLevels}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty search results */}
      {filteredSpells.length === 0 && availableSpells.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p>No spells match your search.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSchoolFilter('all');
            }}
            className="mt-2 text-amber-500 hover:text-amber-400 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default FeatSpellPicker;
