// src/components/EncounterGenerator/PartyManager.tsx

import React from 'react';
import { TempPartyMember } from '../../types';
import { AVAILABLE_CLASSES } from '../../constants';

interface PartyManagerProps {
  party: TempPartyMember[];
  onPartyChange: (newParty: TempPartyMember[]) => void;
}

export const PartyManager: React.FC<PartyManagerProps> = ({ party, onPartyChange }) => {
  const handleAddMember = () => {
    const newMember: TempPartyMember = {
      id: crypto.randomUUID(),
      level: 1,
      classId: 'fighter', // Default to fighter
    };
    onPartyChange([...party, newMember]);
  };

  const handleRemoveMember = (idToRemove: string) => {
    onPartyChange(party.filter(member => member.id !== idToRemove));
  };

  const handleUpdateMember = (idToUpdate: string, field: keyof Omit<TempPartyMember, 'id'>, value: string | number) => {
    onPartyChange(
      party.map(member =>
        member.id === idToUpdate ? { ...member, [field]: value } : member
      )
    );
  };

  return (
    <div className="p-4 border border-gray-600 rounded-lg bg-gray-900/50 my-4">
      <h3 className="text-lg font-semibold text-sky-300 mb-3">Party Composition</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto scrollable-content pr-2">
        {party.map(member => (
          <div key={member.id} className="flex items-center space-x-2 bg-gray-800 p-2 rounded">
            <label htmlFor={`class-${member.id}`} className="text-gray-400 text-sm">Class:</label>
            <select
              id={`class-${member.id}`}
              value={member.classId}
              onChange={(e) => handleUpdateMember(member.id, 'classId', e.target.value)}
              className="bg-gray-700 text-white rounded p-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            >
              {AVAILABLE_CLASSES.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>

            <label htmlFor={`level-${member.id}`} className="text-gray-400 text-sm">Level:</label>
            <input
              id={`level-${member.id}`}
              type="number"
              min="1"
              max="20"
              value={member.level}
              onChange={(e) => handleUpdateMember(member.id, 'level', parseInt(e.target.value, 10) || 1)}
              className="w-16 bg-gray-700 text-white rounded p-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />

            <button
              onClick={() => handleRemoveMember(member.id)}
              className="ml-auto px-2 py-1 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded"
              aria-label={`Remove member ${member.id}`}
            >
              Remove
            </button>
          </div>
        ))}
         {party.length === 0 && <p className="text-center text-gray-500 italic">Party is empty.</p>}
      </div>
      <button
        onClick={handleAddMember}
        className="mt-3 w-full px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md"
      >
        + Add Party Member
      </button>
    </div>
  );
};
