
/**
 * @file MissingChoiceModal.tsx
 * A modal that prompts the user to make a specific missing choice for a character.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { MissingChoice } from '../types';

interface MissingChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  missingChoice: MissingChoice | null;
  onConfirm: (choiceId: string, extraData?: unknown) => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 20, opacity: 0 },
};

const MissingChoiceModal: React.FC<MissingChoiceModalProps> = ({ 
  isOpen, 
  onClose, 
  characterName, 
  missingChoice, 
  onConfirm 
}) => {
  const [selectedOption, setSelectedOption] = useState<{
    choiceId: string;
    optionId: string;
  } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !missingChoice) return null;

  // TODO(lint-intent): If selection should persist per missing choice, store it in a map keyed by missingChoice.id.
  const selectedOptionId = selectedOption?.choiceId === missingChoice.id ? selectedOption.optionId : null;
  const autoSelectedId =
    missingChoice.options.length === 1
      ? missingChoice.options[0].id
      : null;
  const resolvedSelectedOptionId = selectedOptionId ?? autoSelectedId;

  const handleConfirm = () => {
    if (resolvedSelectedOptionId) {
        const selectedOption = missingChoice.options.find(o => o.id === resolvedSelectedOptionId);
        onConfirm(resolvedSelectedOptionId, selectedOption);
        onClose();
    }
  };

  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[80] p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        {...modalMotion}
        className="bg-gray-800 border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-amber-900/30 p-4 border-b border-amber-500/30 flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold text-amber-400 font-cinzel">Incomplete Character</h3>
                <p className="text-sm text-amber-200/70">{characterName} is missing a vital trait or spell.</p>
             </div>
             <button ref={closeButtonRef} onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto scrollable-content">
             <h4 className="text-xl font-semibold text-white mb-2">{missingChoice.label}</h4>
             <p className="text-sm text-gray-400 mb-4">{missingChoice.description}</p>
             
             <div className="space-y-2">
                {missingChoice.options.map(option => (
                    <button
                        key={option.id}
                        onClick={() => setSelectedOption({ choiceId: missingChoice.id, optionId: option.id })}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                            resolvedSelectedOptionId === option.id
                            ? 'bg-amber-600/30 border-amber-500 ring-1 ring-amber-500'
                            : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                        }`}
                    >
                        <div className="font-bold text-gray-200">{option.label}</div>
                        {option.description && <div className="text-xs text-gray-400 mt-1">{option.description}</div>}
                    </button>
                ))}
             </div>
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button
                onClick={handleConfirm}
                disabled={!resolvedSelectedOptionId}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow"
            >
                Confirm
            </button>
        </div>

      </motion.div>
    </motion.div>
  );
};

export default MissingChoiceModal;
