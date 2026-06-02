/**
 * @file LongRestModal.tsx
 * Long rest modal for prompting and applying racial choices during a long rest.
 * @component-owner Gameplay Team / Core UI
 */
import React, { useEffect, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { PlayerCharacter, RacialRestChoiceData } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Z_INDEX } from '../../styles/zIndex';

interface LongRestModalProps {
  isOpen: boolean;
  party: PlayerCharacter[];
  onClose: () => void;
  onConfirm: (choices: Record<string, Record<string, RacialRestChoiceData>>) => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
};

const LongRestModal: React.FC<LongRestModalProps> = ({ isOpen, party, onClose, onConfirm }) => {
  const [choices, setChoices] = useState<Record<string, Record<string, RacialRestChoiceData>>>({});

  useEffect(() => {
    if (isOpen) {
      setChoices({});
    }
  }, [isOpen]);

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const updateChoice = (charId: string, choiceId: string, data: Partial<RacialRestChoiceData>) => {
    setChoices(prev => {
      const charChoices = prev[charId] || {};
      const currentChoice = charChoices[choiceId] || {};
      return {
        ...prev,
        [charId]: {
          ...charChoices,
          [choiceId]: { ...currentChoice, ...data }
        }
      };
    });
  };

  const handleConfirm = () => {
    onConfirm(choices);
    onClose();
  };

  if (!isOpen) return null;

  const charactersNeedingChoice = party.filter(c => 
    c.race?.restChoices && c.race.restChoices.length > 0
  );

  return (
    <motion.div
      {...overlayMotion}
      className={`fixed inset-0 z-[${Z_INDEX.MODAL_INTERACTIVE}] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="long-rest-title"
    >
      <motion.div
        ref={modalRef}
        {...modalMotion}
        className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/40">
          <h2 id="long-rest-title" className="text-xl font-semibold text-amber-300">
            Long Rest
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cancel long rest"
            type="button"
          >
            x
          </button>
        </div>

        <div className="px-6 py-4 text-sm text-gray-300 border-b border-gray-700 bg-gray-900/30">
          A long rest takes 8 hours. You will recover all Hit Points, Hit Point Dice, and Spell Slots.
          {charactersNeedingChoice.length > 0 && (
             <div className="mt-2 text-amber-200">
               Some characters must make choices for their racial traits before resting.
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollable-content px-6 py-4 space-y-6">
          {charactersNeedingChoice.map((member) => {
            const charId = member.id;
            if (!charId) return null;

            return (
              <div key={charId} className="bg-gray-900/50 rounded p-4 border border-gray-700">
                <h3 className="font-semibold text-white mb-2">{member.name}'s Racial Traits</h3>
                {member.race.restChoices?.map(choice => (
                  <div key={choice.id} className="mb-4 last:mb-0">
                    <p className="text-sm text-gray-400 mb-2">{choice.traitName}</p>
                    {choice.options.map((opt, i) => (
                      <div key={i} className="mt-2">
                        <label className="block text-xs font-medium text-gray-400 mb-1 capitalize">
                          Select {opt.type} Proficiency
                        </label>
                        <select
                          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                          value={
                            (opt.type === 'skill' ? choices[charId]?.[choice.id]?.skillIds?.[0] : 
                             opt.type === 'tool' || opt.type === 'weapon' ? (choices[charId]?.[choice.id]?.toolIds?.[0] || choices[charId]?.[choice.id]?.weaponIds?.[0]) : 
                             choices[charId]?.[choice.id]?.season) || ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (opt.type === 'skill') updateChoice(charId, choice.id, { skillIds: [val] });
                            else if (opt.type === 'tool') updateChoice(charId, choice.id, { toolIds: [val] });
                            else if (opt.type === 'weapon') updateChoice(charId, choice.id, { weaponIds: [val] });
                            else if (opt.type === 'season') updateChoice(charId, choice.id, { season: val });
                          }}
                        >
                          <option value="">-- Choose --</option>
                          {opt.type === 'skill' && (
                            <>
                              <option value="Acrobatics">Acrobatics</option>
                              <option value="Animal Handling">Animal Handling</option>
                              <option value="Arcana">Arcana</option>
                              <option value="Athletics">Athletics</option>
                              <option value="Deception">Deception</option>
                              <option value="History">History</option>
                              <option value="Insight">Insight</option>
                              <option value="Intimidation">Intimidation</option>
                              <option value="Investigation">Investigation</option>
                              <option value="Medicine">Medicine</option>
                              <option value="Nature">Nature</option>
                              <option value="Perception">Perception</option>
                              <option value="Performance">Performance</option>
                              <option value="Persuasion">Persuasion</option>
                              <option value="Religion">Religion</option>
                              <option value="Sleight of Hand">Sleight of Hand</option>
                              <option value="Stealth">Stealth</option>
                              <option value="Survival">Survival</option>
                            </>
                          )}
                          {(opt.type === 'tool' || opt.type === 'weapon') && (
                            <>
                              <optgroup label="Tools">
                                <option value="Thieves' Tools">Thieves' Tools</option>
                                <option value="Smith's Tools">Smith's Tools</option>
                                <option value="Tinker's Tools">Tinker's Tools</option>
                              </optgroup>
                              <optgroup label="Weapons">
                                <option value="Longsword">Longsword</option>
                                <option value="Shortsword">Shortsword</option>
                                <option value="Greatsword">Greatsword</option>
                                <option value="Rapier">Rapier</option>
                              </optgroup>
                            </>
                          )}
                          {opt.type === 'season' && (
                            <>
                              <option value="Autumn">Autumn</option>
                              <option value="Winter">Winter</option>
                              <option value="Spring">Spring</option>
                              <option value="Summer">Summer</option>
                            </>
                          )}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
          {charactersNeedingChoice.length === 0 && (
             <div className="text-gray-400 italic">No special choices are required for this rest.</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:opacity-50"
          >
            Confirm Long Rest
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LongRestModal;