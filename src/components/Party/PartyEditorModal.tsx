/**
 * @file PartyEditorModal.tsx
 * A dedicated modal for editing the encounter party composition.
 */
import React, { useState, useEffect, useRef } from 'react';
import { PlayerCharacter, TempPartyMember } from '../../types';
import { PartyManager } from '../EncounterGenerator/PartyManager';
import { getDummyParty } from '../../data/dev/dummyCharacter';

interface PartyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParty: PlayerCharacter[];
  onSave: (party: TempPartyMember[]) => void;
}

const PartyEditorModal: React.FC<PartyEditorModalProps> = ({ isOpen, onClose, initialParty, onSave }) => {
  const [editableParty, setEditableParty] = useState<TempPartyMember[]>([]);
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize with a simple representation of the current party
      const initialTempParty = (initialParty.length > 0 ? initialParty : getDummyParty()).map((p, index) => ({
        id: p.id || crypto.randomUUID(),
        level: p.level || 1,
        classId: p.class?.id || 'fighter',
      }));
      setEditableParty(initialTempParty);
      firstFocusableElementRef.current?.focus();
    }
  }, [isOpen, initialParty]);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);


  if (!isOpen) {
    return null;
  }
  
  const handleSaveClick = () => {
      onSave(editableParty);
      onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="party-editor-title"
    >
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 id="party-editor-title" className="text-2xl font-bold text-amber-400 font-cinzel">
            Edit Encounter Party
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-3xl"
            aria-label="Close Party Editor"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto scrollable-content flex-grow pr-2">
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
              ref={firstFocusableElementRef}
              onClick={onClose}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
            >
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

export default PartyEditorModal;