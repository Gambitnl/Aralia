import React, { useState } from 'react';
import { HeistPlan } from '../../../types/crime';
import { WindowFrame } from '../../ui/WindowFrame';

type HeistApproach = {
    type: string;
    riskModifier: number;
    timeModifier: number;
    requiredSkills: string[];
};

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
        <WindowFrame title="Heist Planning" onClose={onClose} storageKey="heist-planning-window">
            {/* WindowFrame already exposes the named dialog. The heist planner
                only owns content layout here so assistive tech and tests do not
                encounter a hidden duplicate dialog before the visible window. */}
            <div className="flex h-full min-h-0 flex-col text-gray-200">
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <h3 className="mb-4 break-words text-xl font-bold text-amber-400">Target: {plan.targetLocationId}</h3>

                    <div className="mb-6">
                        <h4 className="mb-2 text-lg font-semibold">Select Approach</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {plan.approaches.map(approach => (
                                <button
                                    key={approach.type}
                                    onClick={() => {
                                        setSelectedType(approach.type);
                                        onSelectApproach(approach);
                                    }}
                                    className={`rounded-lg border p-4 text-left transition-colors ${
                                        selectedType === approach.type
                                            ? 'border-amber-500 bg-amber-900/50'
                                            : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                                    }`}
                                >
                                    <div className="break-words text-lg font-bold">{approach.type}</div>
                                    <div className="mt-1 text-sm text-gray-400">Risk: {approach.riskModifier > 0 ? '+' : ''}{approach.riskModifier}%</div>
                                    <div className="text-sm text-gray-400">Time: {approach.timeModifier}x</div>
                                    <div className="mt-2 break-words text-xs text-amber-300">
                                        Requires: {approach.requiredSkills.join(', ')}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6 rounded border border-gray-700 bg-gray-900 p-4">
                        <h4 className="mb-2 font-semibold text-gray-300">Intel Gathered</h4>
                        {plan.intelGathered.length === 0 ? (
                            <p className="text-gray-400 italic">No intel gathering conducted yet.</p>
                        ) : (
                            <ul className="list-inside list-disc text-sm">
                                {plan.intelGathered.map((intel, i) => (
                                    <li key={i} className="break-words">{intel.description}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div data-testid="heist-planning-footer" className="flex flex-wrap justify-end gap-2 border-t border-gray-700 bg-gray-950/60 p-4">
                    <button 
                        onClick={onClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onStartHeist}
                        disabled={!selectedType}
                        className="rounded bg-amber-600 px-6 py-2 font-bold text-white hover:bg-amber-500 disabled:bg-gray-600 disabled:text-gray-400"
                    >
                        Begin Heist
                    </button>
                </div>
            </div>
        </WindowFrame>
    );
};
