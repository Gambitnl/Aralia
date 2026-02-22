// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 22/02/2026, 16:18:36
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file BackgroundSelection.tsx
 * Refactored to use the Split Config Style.
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Race } from '../../types';
import { BACKGROUNDS, AGE_APPROPRIATE_BACKGROUNDS } from '../../data/backgrounds';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { BackgroundDetailPane } from './BackgroundDetailPane';
import { Button } from '../ui/Button';

interface BackgroundSelectionProps {
  selectedRace: Race | null;
  characterAge: number;
  currentBackground: string | null;
  onBackgroundChange: (backgroundId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// Get age category for background filtering
const getAgeCategoryForBackgrounds = (age: number, raceId: string) => {
  // Get age data (similar logic to AgeSelection component)
  const ageData = getAgeDataForBackgroundFiltering(raceId);
  const categories = ageData.categories;

  if (age <= categories.child.max) return 'child';
  if (age <= categories.adolescent.max) return 'young';
  if (age <= categories.adult.max) return 'adult';
  return 'adult'; // Default to adult for elderly
};

const getAgeDataForBackgroundFiltering = (raceId: string) => {
  switch (raceId) {
    case 'human':
      return {
        categories: {
          child: { max: 12 },
          adolescent: { max: 17 },
          adult: { max: 50 },
          middleAged: { max: 70 },
          elderly: { max: 90 }
        }
      };
    case 'elf':
    case 'eladrin':
      return {
        categories: {
          child: { max: 80 },
          adolescent: { max: 99 },
          adult: { max: 400 },
          middleAged: { max: 600 },
          elderly: { max: 800 }
        }
      };
    default:
      return {
        categories: {
          child: { max: 12 },
          adolescent: { max: 17 },
          adult: { max: 50 },
          middleAged: { max: 70 },
          elderly: { max: 90 }
        }
      };
  }
};

const BackgroundSelection: React.FC<BackgroundSelectionProps> = ({
  selectedRace,
  characterAge,
  currentBackground,
  onBackgroundChange,
  onNext,
  onBack,
}) => {
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(currentBackground);

  const ageCategory = selectedRace ? getAgeCategoryForBackgrounds(characterAge, selectedRace.id) : 'adult';

  const availableBackgrounds = useMemo(() => {
    const appropriateIds = AGE_APPROPRIATE_BACKGROUNDS[ageCategory as keyof typeof AGE_APPROPRIATE_BACKGROUNDS] || [];
    return appropriateIds.map(id => BACKGROUNDS[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }, [ageCategory]);

  const defaultBackgroundId = availableBackgrounds[0]?.id ?? null;
  // Avoid setState-in-effect by treating the first available background as the implicit selection.
  const effectiveBackgroundId = selectedBackgroundId ?? defaultBackgroundId;

  const selectedBackground = effectiveBackgroundId ? BACKGROUNDS[effectiveBackgroundId] : null;

  const handleConfirm = () => {
      if (effectiveBackgroundId) {
          onBackgroundChange(effectiveBackgroundId);
          onNext();
      }
  };

  const customNextButton = selectedBackground ? (
    <Button
      variant="primary"
      onClick={handleConfirm}
    >
      Confirm {selectedBackground.name}
    </Button>
  ) : null;

  return (
    <CreationStepLayout
      title="Background Selection"
      onBack={onBack}
      customNextButton={customNextButton}
      bodyScrollable={false}
    >
        <SplitPaneLayout
            controls={
                <div className="space-y-4">
                    <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-800/50">
                        <h3 className="text-xs font-bold text-blue-300 uppercase mb-1">
                            Age Category: <span className="capitalize text-white">{ageCategory}</span>
                        </h3>
                        <p className="text-xs text-blue-200/70 leading-tight">
                            Showing backgrounds appropriate for a {characterAge}-year-old {selectedRace?.name}.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {availableBackgrounds.map((bg) => (
                            <button
                                key={bg.id}
                                onClick={() => setSelectedBackgroundId(bg.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent ${
                                    effectiveBackgroundId === bg.id
                                        ? 'bg-green-900/40 border-green-500/50 text-green-300 shadow-md font-semibold'
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{bg.name}</span>
                                    {effectiveBackgroundId === bg.id && (
                                        <motion.span layoutId="active-indicator-bg" className="text-green-400 text-sm">
                                            ▶
                                        </motion.span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            }
            preview={
                selectedBackground ? (
                    <motion.div
                        key={selectedBackground.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        <BackgroundDetailPane background={selectedBackground} onSelect={handleConfirm} />
                    </motion.div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 italic">
                        Select a background to view details
                    </div>
                )
            }
        />
    </CreationStepLayout>
  );
};

export default BackgroundSelection;
