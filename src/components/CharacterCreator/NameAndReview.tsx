// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:00
 * Dependents: CharacterCreator.tsx
 * Imports: 10 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file NameAndReview.tsx
 * Refactored to use Split Config Style (Name Entry vs Character Summary).
 */
import React, { useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { PlayerCharacter, AbilityScoreName, DraconicAncestryInfo } from '../../types';
import { RACES_DATA, WEAPONS_DATA, MASTERY_DATA, DRAGONBORN_ANCESTRIES } from '../../constants';
import { FEATS_DATA } from '../../data/feats/featsData';
import { getCharacterSpells } from '../../utils/spellUtils';
import { getAbilityModifierString, getCharacterRaceDisplayString } from '../../utils/characterUtils';
import { validateCharacterName } from '../../utils/securityUtils';
import SpellContext from '../../context/SpellContext';
import Tooltip from '../ui/Tooltip';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from './ui/SplitPaneLayout';
import { User, Shield, Zap, BookOpen } from 'lucide-react';

interface NameAndReviewProps {
  characterPreview: PlayerCharacter;
  onConfirm: (name: string) => void;
  onBack: () => void;
  initialName?: string;
  featStepSkipped?: boolean;
}

const NameAndReview: React.FC<NameAndReviewProps> = ({ characterPreview, onConfirm, onBack, initialName = '', featStepSkipped }) => {
  const [name, setName] = useState(initialName);
  const [validationError, setValidationError] = useState<string | null>(() => {
    if (!initialName) return null;
    const { valid, error } = validateCharacterName(initialName);
    return valid ? null : (error || 'Invalid name');
  });

  const { 
    class: charClass, 
    finalAbilityScores, 
    skills, 
    selectedFightingStyle, 
    selectedDivineOrder, 
    selectedDruidOrder, 
    selectedWarlockPatron,
    racialSelections,
    selectedWeaponMasteries,
    speed,
    feats
  } = characterPreview;

  const allSpells = useContext(SpellContext);
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const { valid, error } = validateCharacterName(newName);
    setValidationError(valid ? null : (error || 'Invalid name'));
  };

  const handleConfirm = () => {
    const { valid, error } = validateCharacterName(name);
    if (valid) {
      onConfirm(name.trim());
    } else {
      setValidationError(error || 'Invalid name');
    }
  };

  if (!allSpells) return <div className="p-8 text-center text-gray-500 italic">Loading character details...</div>;

  const { cantrips: allKnownCantrips, spells: allKnownSpells } = getCharacterSpells(characterPreview, allSpells);
  
  const selectedDraconicAncestryId = racialSelections?.['dragonborn']?.choiceId;
  const selectedDraconicAncestry = selectedDraconicAncestryId ? (DRAGONBORN_ANCESTRIES as Record<string, DraconicAncestryInfo>)[selectedDraconicAncestryId] : null;
  const selectedElvenLineageId = racialSelections?.['elf']?.choiceId;
  const elvenLineageDetails = selectedElvenLineageId ? RACES_DATA['elf']?.elvenLineages?.find(l => l.id === selectedElvenLineageId) : null;
  const selectedGnomeSubraceId = racialSelections?.['gnome']?.choiceId;
  const gnomeSubraceDetails = selectedGnomeSubraceId ? RACES_DATA['gnome']?.gnomeSubraces?.find(sr => sr.id === selectedGnomeSubraceId) : null;

  return (
    <CreationStepLayout
      title="Finalize Legend"
      onBack={onBack}
      onNext={handleConfirm}
      canProceed={!validationError && !!name.trim()}
      nextLabel="Begin Adventure!"
      bodyScrollable={false}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          controls={
            <div className="space-y-6">
              <div className="p-4 bg-gray-900/40 border border-gray-700 rounded-xl flex flex-col items-center text-center">
                {/* TODO: Add "Generate Portrait" button here using the Stitch/AI backend to create a custom avatar based on race/class/description. */}
                <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-amber-500/50 flex items-center justify-center mb-4 shadow-lg overflow-hidden relative group">
                  {characterPreview.portraitUrl ? (
                    <img src={characterPreview.portraitUrl} alt="Portrait" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-gray-600 group-hover:text-amber-500/50 transition-colors" />
                  )}
                </div>
                <h3 className="font-cinzel font-bold text-amber-400">The Legend Begins</h3>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-tighter">Enter a name to seal your fate</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="characterName" className="block text-sm font-bold text-gray-400 uppercase tracking-wide px-1">
                  Character Name
                </label>
                <input
                  type="text"
                  id="characterName"
                  value={name}
                  onChange={handleNameChange}
                  autoFocus
                  className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white focus:ring-2 outline-none transition-all shadow-inner ${
                    validationError
                      ? 'border-red-500/50 focus:ring-red-500/20'
                      : 'border-gray-700 focus:ring-amber-500/20 focus:border-amber-500/50'
                  }`}
                  placeholder="E.g., Valerius Stonebeard"
                />
                {validationError && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400 px-1">
                    {validationError}
                  </motion.p>
                )}
              </div>

              {featStepSkipped && (
                <div className="p-3 bg-sky-900/20 border border-sky-700/30 rounded-lg">
                  <p className="text-[10px] leading-tight text-sky-300/70 italic text-center">
                    Feat selection was bypassed (no eligibility at level 1).
                  </p>
                </div>
              )}
            </div>
          }
          preview={
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-end mb-6 border-b border-gray-700 pb-4">
                <div>
                  <h2 className="text-3xl font-bold text-amber-400 font-cinzel">{name || 'Unnamed Hero'}</h2>
                  <p className="text-gray-400 font-medium">
                    Level 1 {getCharacterRaceDisplayString(characterPreview)} {charClass.name}
                  </p>
                </div>
                <div className="flex gap-4 mb-1">
                  <div className="text-center">
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">HP</span>
                    <span className="text-xl font-black text-green-400">{characterPreview.maxHp}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">AC</span>
                    <span className="text-xl font-black text-sky-400">{characterPreview.armorClass}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">SPD</span>
                    <span className="text-xl font-black text-amber-400">{speed}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2 custom-scrollbar">
                {/* Attributes Column */}
                <section>
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Shield size={14} /> Core Attributes
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(finalAbilityScores).map(([ability, value]) => (
                      <div key={ability} className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-2 text-center">
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">{ability.substring(0, 3)}</div>
                        <div className="text-lg font-bold text-white leading-none">{value}</div>
                        <div className="text-xs font-medium text-gray-400 mt-0.5">{getAbilityModifierString(value as number)}</div>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
                    <Zap size={14} /> Proficiencies
                  </h3>
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map(s => (
                        <span key={s.id} className="text-[11px] bg-sky-900/30 text-sky-300 px-2 py-0.5 rounded border border-sky-700/30">
                          {s.name}
                        </span>
                      ))}
                      {selectedWeaponMasteries?.map(id => {
                        const w = WEAPONS_DATA[id];
                        return w ? (
                          <span key={id} className="text-[11px] bg-amber-900/20 text-amber-200 px-2 py-0.5 rounded border border-amber-700/30">
                            {w.name} ({MASTERY_DATA[w.mastery!]?.name})
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </section>

                {/* Features & Spells Column */}
                <section>
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BookOpen size={14} /> Class & Racial Features
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedFightingStyle && (
                      <div className="text-gray-300">
                        <span className="text-amber-500/80 font-semibold mr-2">Fighting Style:</span> {selectedFightingStyle.name}
                      </div>
                    )}
                    {feats && feats.length > 0 && feats.map(featId => {
                      const feat = FEATS_DATA.find(f => f.id === featId);
                      return feat ? (
                        <div key={featId} className="text-gray-300">
                          <span className="text-amber-500/80 font-semibold mr-2">Feat:</span> {feat.name}
                        </div>
                      ) : null;
                    })}
                    {selectedDivineOrder && <div className="text-gray-300"><span className="text-purple-400 font-semibold mr-2">Divine Order:</span> {selectedDivineOrder}</div>}
                    {selectedDruidOrder && <div className="text-gray-300"><span className="text-emerald-400 font-semibold mr-2">Primal Order:</span> {selectedDruidOrder}</div>}
                    {selectedWarlockPatron && <div className="text-gray-300"><span className="text-pink-400 font-semibold mr-2">Patron:</span> {selectedWarlockPatron}</div>}
                  </div>

                  {(allKnownCantrips.length > 0 || allKnownSpells.length > 0) && (
                    <>
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mt-6 mb-3">Magic Manifest</h3>
                      <div className="space-y-3">
                        {allKnownCantrips.length > 0 && (
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Cantrips</span>
                            <div className="flex flex-wrap gap-1">
                              {allKnownCantrips.map(s => (
                                <span key={s.id} className="text-[10px] bg-purple-900/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/30">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {allKnownSpells.length > 0 && (
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">1st Level Spells</span>
                            <div className="flex flex-wrap gap-1">
                              {allKnownSpells.map(s => (
                                <span key={s.id} className="text-[10px] bg-indigo-900/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/30">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          }
        />
      </div>
    </CreationStepLayout>
  );
};

export default NameAndReview;