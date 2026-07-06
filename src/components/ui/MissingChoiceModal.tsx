
/**
 * @file MissingChoiceModal.tsx
 * A modal that prompts the user to make a specific missing choice for a character.
 *
 * Now a thin wrapper over the shared {@link ModalDialog} blocking-dialog shell —
 * this component only supplies the choice body and the confirm/cancel button row;
 * the portal, dim backdrop, focus trap, and centered panel all live in ModalDialog.
 *
 * @component-owner Gameplay Team / Core UI
 */
import React, { useState } from 'react';
import { MissingChoice } from '../types';
import { ModalDialog } from './ModalDialog';
import { UI_ID } from '../../styles/uiIds';

interface MissingChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  missingChoice: MissingChoice | null;
  onConfirm: (choiceId: string, extraData?: unknown) => void;
}

const MissingChoiceModal: React.FC<MissingChoiceModalProps> = ({
  isOpen,
  onClose,
  characterName,
  missingChoice,
  onConfirm,
}) => {
  const [selectedOption, setSelectedOption] = useState<{
    choiceId: string;
    optionId: string;
  } | null>(null);

  if (!isOpen || !missingChoice) return null;

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

  const title = (
    <div>
      <h3 className="text-lg font-bold text-amber-400 font-cinzel">
        Incomplete Character
      </h3>
      <p className="text-sm text-amber-200/70">{characterName} is missing a vital trait or spell.</p>
    </div>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      id={UI_ID.MISSING_CHOICE_MODAL}
      testId={UI_ID.MISSING_CHOICE_MODAL}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!resolvedSelectedOptionId}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow"
          >
            Confirm
          </button>
        </>
      }
    >
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
    </ModalDialog>
  );
};

export default MissingChoiceModal;
