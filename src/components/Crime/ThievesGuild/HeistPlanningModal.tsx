import React, { useState } from 'react';
import { HeistPlan, HeistApproach } from '../../../types/crime';
import { WindowFrame } from '../../ui/WindowFrame';

interface HeistPlanningModalProps {
    plan: HeistPlan;
    onSelectApproach: (approach: HeistApproach) => void;
    onStartHeist: () => void;
    onClose: () => void;
}

export const HeistPlanningModal: React.FC<HeistPlanningModalProps> = ({
    plan,
    onSelectApproach,
    onStartHeist,
    onClose
}) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    return (
        <WindowFrame title="Heist Planning" onClose={onClose}>
            <div className="p-4 text-gray-200">
                <h3 className="text-xl font-bold text-amber-400 mb-4">Target: {plan.targetLocationId}</h3>
                
                <div className="mb-6">
                    <h4 className="text-lg font-semibold mb-2">Select Approach</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plan.approaches.map(approach => (
                            <button
                                key={approach.type}
                                onClick={() => {
                                    setSelectedType(approach.type);
                                    onSelectApproach(approach);
                                }}
                                className={`p-4 border rounded-lg text-left transition-colors ${
                                    selectedType === approach.type 
                                        ? 'bg-amber-900/50 border-amber-500' 
                                        : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                                }`}
                            >
                                <div className="font-bold text-lg">{approach.type}</div>
                                <div className="text-sm text-gray-400 mt-1">Risk: {approach.riskModifier > 0 ? '+' : ''}{approach.riskModifier}%</div>
                                <div className="text-sm text-gray-400">Time: {approach.timeModifier}x</div>
                                <div className="text-xs text-amber-300 mt-2">
                                    Requires: {approach.requiredSkills.join(', ')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-900 p-4 rounded border border-gray-700 mb-6">
                    <h4 className="font-semibold text-gray-300 mb-2">Intel Gathered</h4>
                    {plan.intelGathered.length === 0 ? (
                        <p className="text-gray-500 italic">No intel gathering conducted yet.</p>
                    ) : (
                        <ul className="list-disc list-inside text-sm">
                            {plan.intelGathered.map((intel, i) => (
                                <li key={i}>{intel.description}</li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onStartHeist}
                        disabled={!selectedType}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:text-gray-400 rounded text-white font-bold"
                    >
                        Begin Heist
                    </button>
                </div>
            </div>
        </WindowFrame>
    );
};
