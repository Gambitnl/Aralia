/**
 * @file SpellSourceSelector.tsx
 * A selector for Magic Initiate-style feats that require choosing a spellcasting class.
 * Features class icons, descriptions, and selection state styling.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MagicInitiateSource } from '../../types';

/**
 * Information about each spellcasting class for display purposes.
 */
const SOURCE_INFO: Record<
  MagicInitiateSource,
  { name: string; icon: string; ability: string; description: string }
> = {
  bard: {
    name: 'Bard',
    icon: '\u{1F3B5}', // Musical note
    ability: 'Charisma',
    description: 'Master of music and magic, weaving spells through performance',
  },
  cleric: {
    name: 'Cleric',
    icon: '\u{2721}', // Star of David (divine symbol)
    ability: 'Wisdom',
    description: 'Divine servant channeling the power of the gods',
  },
  druid: {
    name: 'Druid',
    icon: '\u{1F33F}', // Herb
    ability: 'Wisdom',
    description: 'Guardian of nature drawing power from the primal world',
  },
  sorcerer: {
    name: 'Sorcerer',
    icon: '\u{26A1}', // Lightning
    ability: 'Charisma',
    description: 'Innate magic flows through your blood',
  },
  warlock: {
    name: 'Warlock',
    icon: '\u{1F52E}', // Crystal ball
    ability: 'Charisma',
    description: 'Power granted through pacts with otherworldly beings',
  },
  wizard: {
    name: 'Wizard',
    icon: '\u{1F4DA}', // Books
    ability: 'Intelligence',
    description: 'Scholar of the arcane arts, learned through study',
  },
};

interface SpellSourceSelectorProps {
  /** Available spell sources to choose from */
  availableSources: MagicInitiateSource[];
  /** Currently selected source */
  selectedSource: MagicInitiateSource | undefined;
  /** Callback when a source is selected */
  onSourceSelect: (source: MagicInitiateSource) => void;
}

const SpellSourceSelector: React.FC<SpellSourceSelectorProps> = ({
  availableSources,
  selectedSource,
  onSourceSelect,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-amber-300 font-cinzel text-lg">Choose Spell Source</h4>
        <p className="text-sm text-gray-400">
          Select which class&apos;s spell list you want to learn from:
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {availableSources.map((sourceId) => {
          const info = SOURCE_INFO[sourceId];
          const isSelected = selectedSource === sourceId;

          return (
            <motion.button
              key={sourceId}
              onClick={() => onSourceSelect(sourceId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                p-4 rounded-lg border text-left transition-all duration-200
                ${
                  isSelected
                    ? 'bg-amber-900/30 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" role="img" aria-label={info.name}>
                  {info.icon}
                </span>
                <span
                  className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-200'}`}
                >
                  {info.name}
                </span>
                {isSelected && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 text-amber-500 ml-auto flex-shrink-0"
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
              <p className="text-xs text-gray-500 leading-relaxed">{info.description}</p>
              <p className="text-xs text-gray-600 mt-1">
                Spellcasting: <span className="text-gray-400">{info.ability}</span>
              </p>
            </motion.button>
          );
        })}
      </div>

      {!selectedSource && (
        <p className="text-xs text-amber-300/80 mt-2">
          Please select a class to view available spells.
        </p>
      )}
    </div>
  );
};

export default SpellSourceSelector;
