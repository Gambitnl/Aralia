// NOTE: This is the NEW, correct RaceSelection component.
/**
 * @file RaceSelection.tsx
 * This component allows the player to select a race for their character
 * from a list of available D&D races. It features simplified cards
 * and a modal for detailed race information.
 * Races are displayed in alphabetical order.
 */
import React, { useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { Race } from '../../../types';
import { BTN_PRIMARY_SM } from '../../../styles/buttonStyles';
import RaceDetailModal, { RaceForModal } from './RaceDetailModal';

/**
 * Transforms the global Race data structure into the specific format
 * expected by the new, self-contained RaceDetailModal component.
 * This function is now more robust.
 * @param {Race} race - The race data object from the game's constants.
 * @returns {RaceForModal} The transformed data object for the modal's props.
 */
const transformRaceDataForModal = (race: Race): RaceForModal => {
    const baseTraits: RaceForModal['baseTraits'] = {};
    const feats: RaceForModal['feats'] = [];

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
                case 'creature type:':
                    baseTraits.type = value;
                    break;
                case 'size:':
                    baseTraits.size = value;
                    break;
                case 'speed:':
                    {
                        const speedMatch = value.match(/(\d+)/);
                        baseTraits.speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;
                    }
                    break;
                case 'darkvision:':
                    {
                        const dvMatch = value.match(/(\d+)/);
                        baseTraits.darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;
                        if (value.toLowerCase().includes('superior') || value.toLowerCase().includes('120')) {
                            baseTraits.darkvision = 120;
                        }
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

const containerMotion: MotionProps = {
  initial: { x: 300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -300, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' },
};

const RaceSelection: React.FC<RaceSelectionProps> = ({ races, onRaceSelect }) => {
  const [viewingRace, setViewingRace] = useState<Race | null>(null);

  const handleOpenModal = (race: Race) => {
    setViewingRace(race);
  };
  const handleCloseModal = () => {
    setViewingRace(null);
  };

  const handleConfirmRaceSelection = (raceId: string) => {
    onRaceSelect(raceId);
    handleCloseModal();
  };
  
  const getShortDescription = (description: string): string => {
    const firstSentence = description.split('.')[0];
    if (firstSentence.length < 100) return firstSentence + '.';
    return description.substring(0, 97) + '...';
  }

  const sortedRaces = [...races].sort((a, b) => a.name.localeCompare(b.name));
  
  const raceForModal = viewingRace ? transformRaceDataForModal(viewingRace) : null;

  return (
    <motion.div
      key="raceSelection"
      {...containerMotion}
    >
      <h2 className="text-2xl text-sky-300 mb-6 text-center">Choose Your Race</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {sortedRaces.map((race) => (
          <div
            key={race.id}
            className="bg-gray-700 p-4 rounded-lg shadow flex flex-col justify-between" 
          >
            <div>
              <h3 className="text-xl font-semibold text-amber-400 mb-2">{race.name}</h3>
              <p className="text-sm text-gray-400 mb-3" style={{ minHeight: '3.5em' }}>
                {getShortDescription(race.description)}
              </p>
            </div>
            <button
              onClick={() => handleOpenModal(race)}
              className={`mt-auto w-full ${BTN_PRIMARY_SM}`}
              aria-label={`View details for ${race.name}`}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {viewingRace && raceForModal && (
        <RaceDetailModal
          race={raceForModal}
          onSelect={handleConfirmRaceSelection}
          onClose={handleCloseModal}
        />
      )}
    </motion.div>
  );
};

export default RaceSelection;
