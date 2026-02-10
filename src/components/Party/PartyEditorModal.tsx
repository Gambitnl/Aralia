/**
 * @file PartyEditorModal.tsx
 * A dedicated modal for editing the encounter party composition.
 */
import React, { useState, useEffect, useRef } from 'react';
import { PlayerCharacter, TempPartyMember } from '../../types';
import { PartyManager } from '../EncounterGenerator/PartyManager';
import { getDummyParty } from '../../data/dev/dummyCharacter';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface PartyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParty: PlayerCharacter[];
  onSave: (party: TempPartyMember[]) => void;
}

const PartyEditorModal: React.FC<PartyEditorModalProps> = ({ isOpen, onClose, initialParty, onSave }) => {
  const [editableParty, setEditableParty] = useState<TempPartyMember[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with a simple representation of the current party
      // TODO(lint-intent): 'index' is an unused parameter, which suggests a planned input for this flow.
      // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
      // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
      const initialTempParty = (initialParty.length > 0 ? initialParty : getDummyParty()).map((p, index) => ({
        id: p.id || crypto.randomUUID(),
        name: p.name || `Character ${index + 1}`,
        level: p.level || 1,
        classId: p.class?.id || 'fighter',
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditableParty(initialTempParty);
    }
  }, [isOpen, initialParty]);


  if (!isOpen) {
    return null;
  }

  const handleSaveClick = () => {
    onSave(editableParty);
    onClose();
  };

  return (
    <WindowFrame
      title="Edit Encounter Party"
      onClose={onClose}
      storageKey={WINDOW_KEYS.PARTY_EDITOR}
    >
      <div className="flex flex-col h-full bg-gray-800 p-6">
        <div className="flex-grow pr-2 h-full overflow-hidden">
          <PartyManager party={editableParty} onPartyChange={setEditableParty} />
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={handleSaveClick}
            disabled={editableParty.length === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg shadow disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Save Party
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            Cancel
          </button>
        </div>
      </div>
    </WindowFrame>
  );
};

export default PartyEditorModal;
