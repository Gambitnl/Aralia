/**
 * @file RaceSelection.tsx
 * Refactored to use accordion-style grouping by baseRace.
 * Parent rows are not selectable; only variant races (subraces) are.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Race } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { RaceDetailPane, RaceDetailData } from './RaceDetailPane';
import { RACE_GROUPS, getRaceGroupById } from '../../../data/races/raceGroups';

// Helper to transform raw Race data into the detail pane format
const transformRaceData = (race: Race): RaceDetailData => {
  const baseTraits: RaceDetailData['baseTraits'] = {};
  const feats: RaceDetailData['feats'] = [];

  const coreTraitKeywords = ['creature type:', 'size:', 'speed:', 'darkvision:'];

  race.traits.forEach(trait => {
    const lowerTrait = trait.toLowerCase();
    let isCoreTrait = false;
    let keywordFound: string | null = null;

    for (const keyword of coreTraitKeywords) {
      if (lowerTrait.startsWith(keyword)) {
        isCoreTrait = true;
        keywordFound = keyword;
        break;
      }
    }

    if (isCoreTrait && keywordFound) {
      const value = trait.substring(keywordFound.length).trim();
      switch (keywordFound) {
        case 'creature type:': baseTraits.type = value; break;
        case 'size:': baseTraits.size = value; break;
        case 'speed:':
          const speedMatch = value.match(/(\d+)/);
          baseTraits.speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;
          break;
        case 'darkvision:':
          const dvMatch = value.match(/(\d+)/);
          baseTraits.darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;
          if (value.toLowerCase().includes('superior') || value.toLowerCase().includes('120')) {
            baseTraits.darkvision = 120;
          }
          break;
      }
    } else {
      const parts = trait.split(':');
      const name = parts[0]?.trim();
      const description = parts.slice(1).join(':').trim();
      if (name) {
        feats.push({ name, description: description || "No detailed description." });
      }
    }
  });

  if (baseTraits.darkvision === undefined) {
    const dvTrait = race.traits.find(t => t.toLowerCase().includes('darkvision'));
    if (dvTrait) {
      const dvMatch = dvTrait.match(/(\d+)/);
      baseTraits.darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;
    } else {
      baseTraits.darkvision = 0;
    }
  }

  const furtherChoicesNote = (race.elvenLineages || race.gnomeSubraces || race.giantAncestryChoices || race.fiendishLegacies || race.racialSpellChoice)
    ? "Your choice of this race will unlock additional options in the next steps of character creation."
    : undefined;

  return {
    id: race.id,
    name: race.name,
    image: race.imageUrl,
    description: race.description,
    baseTraits,
    feats,
    furtherChoicesNote,
  };
};

interface RaceGroup {
  id: string;
  name: string;
  description?: string;
  variants: Race[];
}

interface RaceSelectionProps {
  races: Race[];
  onRaceSelect: (raceId: string) => void;
}

const RaceSelection: React.FC<RaceSelectionProps> = ({ races, onRaceSelect }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Group races by baseRace
  const raceGroups = useMemo(() => {
    const groupMap = new Map<string, Race[]>();

    races.forEach(race => {
      const groupId = race.baseRace || race.id;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(race);
    });

    // Convert to array and sort
    const groups: RaceGroup[] = [];
    groupMap.forEach((variants, groupId) => {
      const meta = getRaceGroupById(groupId);
      // Use the first variant's name if no meta, or capitalize the groupId
      const displayName = meta?.name || groupId.charAt(0).toUpperCase() + groupId.slice(1);
      groups.push({
        id: groupId,
        name: displayName,
        description: meta?.description,
        variants: variants.sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [races]);

  // Auto-select the first variant of the first group
  useEffect(() => {
    if (!selectedRaceId && raceGroups.length > 0) {
      const firstGroup = raceGroups[0];
      if (firstGroup.variants.length > 0) {
        setSelectedRaceId(firstGroup.variants[0].id);
      }
    }
  }, [raceGroups, selectedRaceId]);

  const selectedRace = races.find(r => r.id === selectedRaceId);

  // Compute detail data with sibling variants for comparison table
  const detailData = useMemo(() => {
    if (!selectedRace) return null;

    const baseData = transformRaceData(selectedRace);

    // Find the group this race belongs to
    const groupId = selectedRace.baseRace || selectedRace.id;
    const group = raceGroups.find(g => g.id === groupId);

    // If group has multiple variants, add sibling data for comparison table
    if (group && group.variants.length > 1) {
      baseData.siblingVariants = group.variants.map(v => {
        // Extract speed from traits
        const speedTrait = v.traits.find(t => t.toLowerCase().startsWith('speed:'));
        const speedMatch = speedTrait?.match(/(\d+)/);
        const speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;

        // Extract darkvision from traits
        const dvTrait = v.traits.find(t => t.toLowerCase().includes('darkvision'));
        const dvMatch = dvTrait?.match(/(\d+)/);
        const darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;

        // Extract key trait names (first 3 non-core traits)
        const coreKeywords = ['creature type:', 'size:', 'speed:', 'darkvision:'];
        const keyTraits = v.traits
          .filter(t => !coreKeywords.some(k => t.toLowerCase().startsWith(k)))
          .map(t => t.split(':')[0].trim())
          .slice(0, 3);

        return {
          id: v.id,
          name: v.name,
          speed,
          darkvision,
          keyTraits,
        };
      });
    }

    return baseData;
  }, [selectedRace, raceGroups]);


  const handleGroupClick = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  const handleVariantClick = (raceId: string) => {
    setSelectedRaceId(raceId);
  };

  return (
    <CreationStepLayout title="Choose Your Race">
      <SplitPaneLayout
        controls={
          <div className="space-y-1">
            {raceGroups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const hasMultipleVariants = group.variants.length > 1;
              const isSingleRace = group.variants.length === 1;

              // Single race without variants - render as direct selection button
              if (isSingleRace) {
                const race = group.variants[0];
                const isSelected = selectedRaceId === race.id;
                return (
                  <button
                    key={race.id}
                    onClick={() => handleVariantClick(race.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${isSelected
                      ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 shadow-md font-semibold'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                      }`}
                  >
                    <span>{race.name}</span>
                    {isSelected && (
                      <motion.span layoutId="active-indicator" className="text-amber-500 text-sm">
                        ▶
                      </motion.span>
                    )}
                  </button>
                );
              }

              // Multi-variant group - render as accordion
              return (
                <div key={group.id} className="flex flex-col">
                  {/* Group Header (NOT selectable) */}
                  <button
                    onClick={() => handleGroupClick(group.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${isExpanded
                      ? 'bg-gray-700/60 border-gray-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/40 border border-sky-700/50 text-sky-400 font-bold">
                        {group.variants.length}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-gray-400`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded Variants */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-4 pl-3 border-l-2 border-gray-700 space-y-1 py-2">
                          {group.variants.map((race) => {
                            const isSelected = selectedRaceId === race.id;
                            return (
                              <button
                                key={race.id}
                                onClick={() => handleVariantClick(race.id)}
                                className={`w-full text-left px-3 py-2 rounded-md transition-all duration-150 text-sm flex items-center justify-between ${isSelected
                                  ? 'bg-amber-900/50 text-amber-400 font-semibold'
                                  : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white'
                                  }`}
                              >
                                <span>{race.name}</span>
                                {isSelected && (
                                  <motion.span layoutId="active-indicator" className="text-amber-500 text-xs">
                                    ▶
                                  </motion.span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        }
        preview={
          detailData ? (
            <motion.div
              key={detailData.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <RaceDetailPane race={detailData} onSelect={onRaceSelect} />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 italic">
              Select a race to view details
            </div>
          )
        }
      />
    </CreationStepLayout>
  );
};

export default RaceSelection;