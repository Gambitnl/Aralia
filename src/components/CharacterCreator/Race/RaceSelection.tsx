/**
 * @file RaceSelection.tsx
 * Refactored to use the Split Config Style (List on Left, Details on Right).
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

interface RaceSelectionProps {
  races: Race[];
  onRaceSelect: (raceId: string) => void;
}

const RaceSelection: React.FC<RaceSelectionProps> = ({ races, onRaceSelect }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  
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

  return (
    <CreationStepLayout title="Choose Your Race">
      <SplitPaneLayout
        controls={
          <div className="space-y-2">
            {sortedRaces.map((race) => (
              <button
                key={race.id}
                onClick={() => setSelectedRaceId(race.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent ${
                  selectedRaceId === race.id
                    ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 shadow-md font-semibold'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                    <span>{race.name}</span>
                    {selectedRaceId === race.id && (
                        <motion.span layoutId="active-indicator" className="text-amber-500 text-sm">
                            ▶
                        </motion.span>
                    )}
                </div>
              </button>
            ))}
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