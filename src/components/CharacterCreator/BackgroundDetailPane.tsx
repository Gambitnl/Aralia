/**
 * @file BackgroundDetailPane.tsx
 * Detailed view of a selected background, designed for the right pane of the Split Config layout.
 */
import React from 'react';
import { Background } from '../../data/backgrounds';
import { BTN_PRIMARY } from '../../styles/buttonStyles';

interface BackgroundDetailPaneProps {
  background: Background;
  onSelect: () => void;
}

export const BackgroundDetailPane: React.FC<BackgroundDetailPaneProps> = ({ background, onSelect }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
        <h2 className="text-3xl font-bold text-green-400 font-cinzel">
          {background.name}
        </h2>
      </div>

      <div className="space-y-6 flex-grow">
        
        {/* Description */}
        <p className="text-gray-300 text-sm italic border-l-2 border-green-500/50 pl-3">
          {background.description}
        </p>

        {/* Feature */}
        <div className="bg-gray-900/40 p-4 rounded-lg border border-gray-700">
          <h3 className="text-lg font-cinzel text-green-300 mb-1">Feature: {background.feature.name}</h3>
          <p className="text-sm text-gray-400">{background.feature.description}</p>
        </div>

        {/* Proficiencies Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Skill Proficiencies</h4>
            <div className="text-gray-200 text-sm">
              {background.skillProficiencies.map(s => s.replace(/_/g, ' ')).join(', ')}
            </div>
          </div>
          
          {(background.toolProficiencies || background.languages) && (
            <div>
              {background.toolProficiencies && (
                <div className="mb-2">
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Tool Proficiencies</h4>
                  <div className="text-gray-200 text-sm">
                    {background.toolProficiencies.map(t => t.replace(/_/g, ' ')).join(', ')}
                  </div>
                </div>
              )}
              {background.languages && (
                <div>
                  <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Languages</h4>
                  <div className="text-gray-200 text-sm">
                    {background.languages.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Equipment */}
        <div>
          <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Starting Equipment</h4>
          <p className="text-gray-300 text-sm">
            {background.equipment.map(e => e.replace(/_/g, ' ')).join(', ')}
          </p>
        </div>

        {/* Characteristics Preview */}
        {background.suggestedCharacteristics && (
          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm text-green-400 font-bold uppercase mb-2">Suggested Characteristics</h4>
            <div className="space-y-2">
              <div className="text-xs text-gray-400">
                <strong className="text-gray-300">Personality:</strong> &quot;{background.suggestedCharacteristics.personalityTraits[0]}&quot;
              </div>
              <div className="text-xs text-gray-400">
                <strong className="text-gray-300">Ideal:</strong> &quot;{background.suggestedCharacteristics.ideals[0]}&quot;
              </div>
              <div className="text-xs text-gray-400">
                <strong className="text-gray-300">Bond:</strong> &quot;{background.suggestedCharacteristics.bonds[0]}&quot;
              </div>
              <div className="text-xs text-gray-400">
                <strong className="text-gray-300">Flaw:</strong> &quot;{background.suggestedCharacteristics.flaws[0]}&quot;
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-8 flex justify-end sticky bottom-0 bg-gray-800 pt-4 pb-2 border-t border-gray-700">
        <button 
          onClick={onSelect}
          className={`${BTN_PRIMARY} px-8 py-3 text-lg rounded-xl shadow-lg`}
        >
          Confirm Background
        </button>
      </div>
    </div>
  );
};
