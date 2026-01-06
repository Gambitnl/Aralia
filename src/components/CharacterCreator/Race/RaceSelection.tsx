/**
 * @file RaceSelection.tsx
 * Refactored to use the Split Config Style (List on Left, Details on Right).
 * Features an accordion-style race list to indicate sub-choices and structural subraces.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Race } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { RaceDetailPane, RaceDetailData } from './RaceDetailPane';

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

  const furtherChoicesNote = (race.elvenLineages || race.gnomeSubraces || ['dragonborn', 'human', 'goliath', 'tiefling', 'aarakocra', 'air_genasi', 'bugbear', 'centaur', 'changeling', 'deep_gnome', 'duergar'].includes(race.id))
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

interface RaceChoiceDetails {
  type: 'subrace' | 'choice';
  label: string;
  previewOptions: string[];
}

// Helper to get categorization and sub-options for a race
const getRaceDetails = (race: Race): RaceChoiceDetails | null => {
  // Structural Variations (Subraces/Lineages)
  if (race.elvenLineages) return { type: 'subrace', label: 'Lineages', previewOptions: race.elvenLineages.map(l => l.name) };
  if (race.gnomeSubraces) return { type: 'subrace', label: 'Subraces', previewOptions: race.gnomeSubraces.map(s => s.name) };
  if (race.giantAncestryChoices) return { type: 'subrace', label: 'Ancestries', previewOptions: race.giantAncestryChoices.map(a => a.name) };
  if (race.fiendishLegacies) return { type: 'subrace', label: 'Legacies', previewOptions: race.fiendishLegacies.map(l => l.name) };
  if (race.id === 'dragonborn') return { type: 'subrace', label: 'Ancestries', previewOptions: ['Black', 'Blue', 'Brass', 'Bronze', 'Copper', 'Gold', 'Green', 'Red', 'Silver', 'White'] };

  // Selection-based Choices
  if (race.id === 'human') return { type: 'choice', label: 'Choices', previewOptions: ['Skill Proficiency', 'Origin Feat'] };
  if (race.id === 'centaur') return { type: 'choice', label: 'Choice', previewOptions: ['Skill Proficiency'] };
  if (race.id === 'changeling') return { type: 'choice', label: 'Choices', previewOptions: ['Skill Proficiencies'] };
  if (race.id === 'duergar' || race.id === 'air_genasi' || race.id === 'aarakocra') return { type: 'choice', label: 'Choice', previewOptions: ['Spellcasting Ability'] };

  return null;
};

interface RaceSelectionProps {
  races: Race[];
  onRaceSelect: (raceId: string) => void;
}

const RaceSelection: React.FC<RaceSelectionProps> = ({ races, onRaceSelect }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [expandedRaceId, setExpandedRaceId] = useState<string | null>(null);

  // Auto-select the first race if none selected, to ensure the right pane isn't empty
  useEffect(() => {
    if (!selectedRaceId && races.length > 0) {
      // Sort first to match display order
      const sorted = [...races].sort((a, b) => a.name.localeCompare(b.name));
      setSelectedRaceId(sorted[0].id);
    }
  }, [races, selectedRaceId]);

  const sortedRaces = [...races].sort((a, b) => a.name.localeCompare(b.name));
  const selectedRace = races.find(r => r.id === selectedRaceId);
  const detailData = selectedRace ? transformRaceData(selectedRace) : null;

  const handleRaceClick = (raceId: string) => {
    setSelectedRaceId(raceId);
    setExpandedRaceId(expandedRaceId === raceId ? null : raceId);
  };

  return (
    <CreationStepLayout title="Choose Your Race">
      <SplitPaneLayout
        controls={
          <div className="space-y-2">
            {sortedRaces.map((race) => {
              const details = getRaceDetails(race);
              const hasChoices = details !== null;
              const isSelected = selectedRaceId === race.id;
              const isExpanded = expandedRaceId === race.id;

              return (
                <div key={race.id} className="flex flex-col">
                  <button
                    onClick={() => handleRaceClick(race.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex flex-col ${isSelected
                      ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 shadow-md font-semibold'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span>{race.name}</span>
                        {hasChoices && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${details.type === 'subrace'
                              ? isSelected ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-sky-900/40 border-sky-700/50 text-sky-400'
                              : isSelected ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-gray-900/50 border-gray-700 text-gray-500'
                            }`}>
                            {details.type === 'subrace' ? 'Subraces' : 'Options'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasChoices && (
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isSelected ? 'text-amber-500' : 'text-gray-500'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                        {isSelected && (
                          <motion.span layoutId="active-indicator" className="text-amber-500 text-sm">
                            ▶
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </button>

                  {hasChoices && (
                    <motion.div
                      initial={false}
                      animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`px-5 py-2 flex flex-wrap gap-1.5 border-l-2 ml-4 mt-1 mb-2 ${isSelected ? 'border-amber-500/30' : 'border-gray-700'}`}>
                        <div className="w-full text-[10px] uppercase text-gray-500 mb-1 font-semibold tracking-widest flex items-center gap-1.5">
                          {details.label}
                          <div className="h-[1px] flex-grow bg-gray-800" />
                        </div>
                        {details.previewOptions.map((opt, i) => (
                          <span key={i} className={`text-[11px] px-2 py-0.5 rounded border ${isSelected ? 'text-amber-200/60 bg-amber-900/20 border-amber-500/20' : 'text-gray-400 bg-gray-800/50 border-gray-700/50'
                            }`}>
                            {opt}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
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