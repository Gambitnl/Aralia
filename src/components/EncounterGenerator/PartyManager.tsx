// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:40:10
 * Dependents: PartyEditorModal.tsx
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// src/components/EncounterGenerator/PartyManager.tsx

import React from 'react';
import { TempPartyMember } from '../../types';
import { AVAILABLE_CLASSES } from '../../constants';
import { generateId } from '../../utils/core/idGenerator';

interface PartyManagerProps {
  party: TempPartyMember[];
  onPartyChange: (newParty: TempPartyMember[]) => void;
}

export const PartyManager: React.FC<PartyManagerProps> = ({ party, onPartyChange }) => {
  const handleAddMember = () => {
    const newMember: TempPartyMember = {
      id: generateId(),
      name: `New Member ${party.length + 1}`,
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
    <div className="flex flex-col h-full bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.5fr_0.5fr_auto] gap-4 p-3 bg-gray-800 border-b border-gray-700 font-semibold text-gray-300 text-sm">
        <div>Name</div>
        <div>Class</div>
        <div>Level</div>
        <div className="w-16 text-center">Actions</div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto p-2 space-y-2">
        {party.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic space-y-2">
            <p>No party members added.</p>
            <p className="text-sm">Click "Add Party Member" to start.</p>
          </div>
        ) : (
          party.map(member => (
            <div
              key={member.id}
              className="grid grid-cols-[2fr_1.5fr_0.5fr_auto] gap-4 items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
            >
              <input
                type="text"
                value={member.name}
                onChange={(e) => handleUpdateMember(member.id, 'name', e.target.value)}
                placeholder="Character Name"
                className="w-full bg-gray-900 text-white rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm transition-all"
              />

              <select
                value={member.classId}
                onChange={(e) => handleUpdateMember(member.id, 'classId', e.target.value)}
                className="w-full bg-gray-900 text-white rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm appearance-none"
              >
                {AVAILABLE_CLASSES.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                max="20"
                value={member.level}
                onChange={(e) => handleUpdateMember(member.id, 'level', Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                className="w-full bg-gray-900 text-white rounded px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm text-center"
              />

              <div className="w-16 flex justify-center">
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 hover:text-white text-xs font-medium rounded border border-red-800/50 hover:border-red-700 transition-colors duration-200"
                  aria-label={`Remove ${member.name}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <button
          onClick={handleAddMember}
          className="w-full py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <span>+ Add Party Member</span>
        </button>
      </div>
    </div>
  );
};
