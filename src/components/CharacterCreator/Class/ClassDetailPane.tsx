/**
 * @file ClassDetailPane.tsx
 * Detailed view of a selected class, designed for the right pane of the Split Config layout.
 */
import React from 'react';
import { Class as CharClass } from '../../../types';
import { BTN_PRIMARY } from '../../../styles/buttonStyles';

interface ClassDetailPaneProps {
  charClass: CharClass;
  onSelect: (classId: string) => void;
}

export const ClassDetailPane: React.FC<ClassDetailPaneProps> = ({ charClass, onSelect }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
        <h2 className="text-3xl font-bold text-amber-400 font-cinzel">
          {charClass.name}
        </h2>
        <div className="text-right">
          <div className="text-sm text-gray-400 uppercase font-bold tracking-wider">Hit Die</div>
          <div className="text-2xl font-mono text-sky-300">d{charClass.hitDie}</div>
        </div>
      </div>

      {/* Core Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900/40 p-3 rounded-lg border border-gray-700">
          <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Primary Ability</h4>
          <div className="text-sky-200 font-semibold">{charClass.primaryAbility.join(' / ')}</div>
        </div>
        <div className="bg-gray-900/40 p-3 rounded-lg border border-gray-700">
          <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Saving Throws</h4>
          <div className="text-sky-200 font-semibold">{charClass.savingThrowProficiencies.join(' & ')}</div>
        </div>
      </div>

      {/* Proficiencies */}
      <div className="space-y-4 mb-6">
        <div>
          <h4 className="text-sm text-amber-400 font-bold uppercase mb-1">Armor & Weapons</h4>
          <p className="text-gray-300 text-sm">
            {[
              ...charClass.armorProficiencies,
              ...charClass.weaponProficiencies
            ].join(', ')}
          </p>
        </div>
        
        {charClass.skillProficienciesAvailable.length > 0 && (
          <div>
            <h4 className="text-sm text-amber-400 font-bold uppercase mb-1">
              Skills (Choose {charClass.numberOfSkillProficiencies})
            </h4>
            <p className="text-gray-400 text-xs italic">
              {charClass.skillProficienciesAvailable.map(id => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ')).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-6 flex-grow">
        <h3 className="text-lg font-cinzel text-sky-300 mb-2">Class Overview</h3>
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
          {charClass.description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="mt-auto flex justify-end sticky bottom-0 bg-gray-800 pt-4 pb-2 border-t border-gray-700">
        <button 
          onClick={() => onSelect(charClass.id)}
          className={`${BTN_PRIMARY} px-8 py-3 text-lg rounded-xl shadow-lg`}
        >
          Confirm {charClass.name}
        </button>
      </div>
    </div>
  );
};
