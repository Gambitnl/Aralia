/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Spell Source' selection for complex feats 
 * like 'Magic Initiate'. It maps abstract spellcasting requirements to 
 * concrete Class identities (Bard, Cleric, etc.).
 *
 * Recent updates focus on 'Thematic Identity' and 'Premium UI Feedback'.
 * - Integrated `SOURCE_INFO` with hand-crafted flavour text. This adds 
 *   narrative depth to mechanical choices, helping the player feel 
 *   the impact of choosing a 'Wizard' source vs a 'Warlock' source.
 * - Refined styling to use `SOURCE_ACCENT` and `SOURCE_SIGIL_BG` per-class. 
 *   Each source now has its own color signature (e.g., Emerald for Druid, 
 *   Sky for Wizard) which permeates the button border and icon badge.
 * - Added `motion.button` wrapper for tactile feedback, using the 
 *   established 'Amber Glow' for selection persistence.
 * 
 * @file src/components/CharacterCreator/SpellSourceSelector.tsx
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MagicInitiateSource } from '../../types';
import { GlossaryIcon, GlossaryIconName } from '../Glossary/IconRegistry';

/**
 * Display metadata for each supported spellcasting class.
 */
const SOURCE_INFO: Record<
  MagicInitiateSource,
  { name: string; ability: string; flavour: string }
> = {
  bard: {
    name: 'Bard',
    ability: 'Charisma',
    flavour: 'Words woven with glamour — magic through melody and story.',
  },
  cleric: {
    name: 'Cleric',
    ability: 'Wisdom',
    flavour: 'Divine favour channelled through unshakeable faith.',
  },
  druid: {
    name: 'Druid',
    ability: 'Wisdom',
    flavour: 'Primal forces shaped by the will of untamed nature.',
  },
  sorcerer: {
    name: 'Sorcerer',
    ability: 'Charisma',
    flavour: 'Raw arcane power burning in the blood — no study required.',
  },
  warlock: {
    name: 'Warlock',
    ability: 'Charisma',
    flavour: 'Eldritch gifts granted by a pact with a being of immense power.',
  },
  wizard: {
    name: 'Wizard',
    ability: 'Intelligence',
    flavour: 'Scholarly mastery of arcane formulae, honed through rigorous study.',
  },
};

/** Canonical icon per class — sourced from CLASS_ICONS in the design preview. */
const SOURCE_ICON: Record<MagicInitiateSource, GlossaryIconName> = {
  bard:     'music',
  cleric:   'fa_hands_praying',
  druid:    'leaf',
  sorcerer: 'magic_staff',
  warlock:  'fa_skull',
  wizard:   'fa_hat_wizard',
};

/** Accent colours per class to distinguish them visually. */
const SOURCE_ACCENT: Record<MagicInitiateSource, string> = {
  bard:     'text-fuchsia-400',
  cleric:   'text-yellow-300',
  druid:    'text-emerald-400',
  sorcerer: 'text-red-400',
  warlock:  'text-violet-400',
  wizard:   'text-sky-400',
};

const SOURCE_SIGIL_BG: Record<MagicInitiateSource, string> = {
  bard:     'bg-fuchsia-900/40 border-fuchsia-700/50',
  cleric:   'bg-yellow-900/40 border-yellow-700/50',
  druid:    'bg-emerald-900/40 border-emerald-700/50',
  sorcerer: 'bg-red-900/40 border-red-700/50',
  warlock:  'bg-violet-900/40 border-violet-700/50',
  wizard:   'bg-sky-900/40 border-sky-700/50',
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
    <div className="space-y-4">
      {/* Section header — sky-300 matches CreationStepLayout title colour */}
      <div>
        <h4 className="text-sky-300 font-cinzel text-base font-semibold tracking-wide">
          Choose Spell Source
        </h4>
        <div className="mt-1 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
        <p className="text-xs text-gray-400 mt-2">
          Select which class list you draw your spells from.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {availableSources.map((sourceId) => {
          const info = SOURCE_INFO[sourceId];
          const accentText = SOURCE_ACCENT[sourceId];
          const sigilBg = SOURCE_SIGIL_BG[sourceId];
          const isSelected = selectedSource === sourceId;

          return (
            <motion.button
              key={sourceId}
              onClick={() => onSourceSelect(sourceId)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`
                p-3 rounded-lg border text-left transition-all duration-200 w-full
                ${
                  isSelected
                    ? 'bg-amber-900/25 border-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.2)]'
                    : 'bg-gray-900/60 border-gray-700/60 hover:border-gray-500/80 hover:bg-gray-800/60'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Class icon badge */}
                <div
                  className={`
                    w-9 h-9 rounded-md flex items-center justify-center
                    border flex-shrink-0
                    ${sigilBg} ${accentText}
                  `}
                >
                  <GlossaryIcon name={SOURCE_ICON[sourceId]} className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-cinzel font-semibold text-sm ${
                        isSelected ? 'text-amber-300' : 'text-gray-200'
                      }`}
                    >
                      {info.name}
                    </span>
                    {isSelected && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-4 h-4 text-amber-400 flex-shrink-0"
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ability: <span className={`${accentText} opacity-80`}>{info.ability}</span>
                  </p>
                </div>
              </div>

              {/* Flavour text — only shown when selected or on hover via Tailwind group */}
              {/* WHAT CHANGED: Dynamic flavour text visibility. */}
              {/* WHY IT CHANGED: To provide narrative context for the 
                  choice. If the source is selected, we highlight the 
                  text to emphasize the narrative identity. */}
              <p className={`text-xs leading-relaxed mt-2 transition-colors ${
                isSelected ? 'text-gray-300' : 'text-gray-500'
              }`}>
                {info.flavour}
              </p>
            </motion.button>
          );
        })}
      </div>

      {!selectedSource && (
        <p className="text-xs text-amber-400/70 italic mt-1">
          Select a class to see available spells.
        </p>
      )}
    </div>
  );
};

export default SpellSourceSelector;
