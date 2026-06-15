import React, { useMemo, useState } from 'react';
import { Action, Faction } from '../../../types';
import { LeverageGoal } from '../../../systems/intrigue/LeverageSystem';
import { Secret } from '../../../types/identity';

interface LeverageUIProps {
    knownSecrets: Secret[];
    factions: Record<string, Faction>;
    factionStandings: Record<string, number>;
    onAction: (action: Action) => void;
    messages: { text: string; sender: string }[];
}

const goalLabels: Record<LeverageGoal, string> = {
    blackmail: '💰 Blackmail (Gold)',
    favor: '🤝 Call in a Favor',
    information: '🔍 Demand Information',
    safe_passage: '🛡️ Safe Passage',
    forced_sale: '🏪 Forced Sale'
};

export const LeverageUI: React.FC<LeverageUIProps> = ({
    knownSecrets,
    factions,
    factionStandings,
    onAction,
    messages
}) => {
    const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
    const [selectedGoal, setSelectedGoal] = useState<LeverageGoal>('blackmail');

    const factionList = useMemo(() => Object.values(factions), [factions]);

    const selectedSecret = useMemo(() =>
        knownSecrets.find(s => s.id === selectedSecretId),
        [knownSecrets, selectedSecretId]
    );

    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    const handleApply = () => {
        if (!selectedSecretId || !selectedTargetId) return;
        onAction({
            type: 'APPLY_LEVERAGE',
            label: `Apply leverage: ${selectedGoal}`,
            payload: { secretId: selectedSecretId, targetId: selectedTargetId, goal: selectedGoal }
        } as Action);
    };

    if (knownSecrets.length === 0) {
        return (
            <div className="text-center text-gray-500 p-4">
                You know no secrets to leverage. Visit the Rumor Mill to gather intelligence.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-cinzel text-amber-400 mb-3">Apply Leverage</h3>
            <p className="text-sm text-gray-400 mb-4">
                Use a known secret to gain advantage over a faction.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-300">Choose a Secret</label>
                    <select
                        value={selectedSecretId ?? ''}
                        onChange={e => setSelectedSecretId(e.target.value || null)}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-gray-200"
                    >
                        <option value="">-- Select Secret --</option>
                        {knownSecrets.map(s => (
                            <option key={s.id} value={s.id}>
                                [{s.tags?.join(', ')}] Value {s.value} — {s.content.slice(0, 60)}...
                            </option>
                        ))}
                    </select>

                    {selectedSecret && (
                        <div className="bg-gray-800 border border-gray-700 rounded p-3 mt-2">
                            <p className="text-xs text-gray-400">Content:</p>
                            <p className="text-sm text-gray-200">{selectedSecret.content}</p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs text-purple-400">Value: {selectedSecret.value}/10</span>
                                <span className="text-xs text-cyan-400">Verified: {selectedSecret.verified ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-300">Choose a Target</label>
                    <select
                        value={selectedTargetId ?? ''}
                        onChange={e => setSelectedTargetId(e.target.value || null)}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-gray-200"
                    >
                        <option value="">-- Select Target --</option>
                        {factionList.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.name} (Standing: {factionStandings[f.id] ?? 0})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300">Choose Your Goal</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(Object.keys(goalLabels) as LeverageGoal[]).map(goal => (
                        <button
                            key={goal}
                            onClick={() => setSelectedGoal(goal)}
                            className={`p-2 rounded text-sm font-bold transition-colors ${
                                selectedGoal === goal
                                    ? 'bg-amber-700 text-white ring-2 ring-amber-400'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {goalLabels[goal]}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={handleApply}
                disabled={!selectedSecretId || !selectedTargetId}
                className={`w-full py-2 rounded font-bold transition-colors ${
                    selectedSecretId && selectedTargetId
                        ? 'bg-red-700 hover:bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
            >
                Apply Leverage
            </button>

            {lastMessage && (
                <div className="bg-gray-800 border border-gray-700 rounded p-3 mt-2">
                    <p className="text-sm text-gray-300">{lastMessage.text}</p>
                </div>
            )}
        </div>
    );
};
