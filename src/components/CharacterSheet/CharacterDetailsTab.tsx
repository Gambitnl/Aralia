/**
 * @file CharacterDetailsTab.tsx
 * Displays personality traits, backstory, and character details using Split Config Style.
 */
import React from 'react';
import { PlayerCharacter } from '../../types';
import { Companion } from '../../types/companions';

interface CharacterDetailsTabProps {
    character: PlayerCharacter;
    companion?: Companion | null;
}

const CharacterDetailsTab: React.FC<CharacterDetailsTabProps> = ({ character, companion }) => {
    const personality = companion?.personality;
    const identity = companion?.identity;
    const goals = companion?.goals?.filter(g => !g.isSecret && g.status === 'active');

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full p-2">
            {/* Left Panel: Personality Details */}
            <div className="w-full md:w-1/3 bg-black/40 border border-gray-700 rounded-xl p-6 overflow-y-auto scrollable-content">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Personality Profile</h3>

                {/* Values */}
                {personality?.values && personality.values.length > 0 && (
                    <div className="mb-5">
                        <label className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2 block">Values</label>
                        <div className="flex flex-wrap gap-2">
                            {personality.values.map((value, i) => (
                                <span key={i} className="px-3 py-1 bg-emerald-900/40 text-emerald-300 text-xs rounded-full border border-emerald-700/50">
                                    {value}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fears */}
                {personality?.fears && personality.fears.length > 0 && (
                    <div className="mb-5">
                        <label className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2 block">Fears</label>
                        <div className="flex flex-wrap gap-2">
                            {personality.fears.map((fear, i) => (
                                <span key={i} className="px-3 py-1 bg-red-900/40 text-red-300 text-xs rounded-full border border-red-700/50">
                                    {fear}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quirks */}
                {personality?.quirks && personality.quirks.length > 0 && (
                    <div className="mb-5">
                        <label className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-2 block">Quirks</label>
                        <ul className="space-y-1.5">
                            {personality.quirks.map((quirk, i) => (
                                <li key={i} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-sky-400 mr-2 flex-shrink-0">•</span>
                                    <span>{quirk}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Personal Goals */}
                {goals && goals.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-700">
                        <label className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3 block">Active Goals</label>
                        <div className="space-y-2">
                            {goals.map(goal => (
                                <div key={goal.id} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <p className="text-gray-200 text-sm">{goal.description}</p>
                                    {goal.progress > 0 && (
                                        <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all"
                                                style={{ width: `${goal.progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback */}
                {!personality && (
                    <div className="text-gray-500 text-sm italic text-center py-8">
                        No personality data available.
                    </div>
                )}
            </div>

            {/* Right Panel: Portrait & Description */}
            <div className="w-full md:w-2/3 bg-gray-800 rounded-xl border border-gray-700 flex flex-col p-6 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <span className="text-6xl font-cinzel text-gray-600 font-bold">PORTRAIT</span>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                    {/* Character Identity */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-cinzel text-amber-400 mb-1">{identity?.name || character.name}</h2>
                        <div className="text-gray-400 text-sm">
                            {identity?.sex && <span>{identity.sex} </span>}
                            {identity?.race || character.race?.name}
                            {(identity?.class || character.class?.name) && <span> · {identity?.class || character.class?.name}</span>}
                        </div>
                        {identity?.age && (
                            <div className="text-gray-500 text-xs mt-1">Age: {identity.age}</div>
                        )}
                    </div>

                    {/* Physical Description */}
                    <div className="flex-grow bg-black/30 rounded-lg p-4 border border-gray-700/50">
                        <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 block">Physical Description</label>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {identity?.physicalDescription || character.visualDescription || 'No description available.'}
                        </p>
                    </div>

                    {/* Background */}
                    {character.background && (
                        <div className="mt-4 bg-black/30 rounded-lg p-4 border border-gray-700/50">
                            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 block">Background</label>
                            <p className="text-amber-300 font-medium">{character.background}</p>
                        </div>
                    )}

                    {/* Trait Spectrum */}
                    {personality && (
                        <div className="mt-4 bg-black/30 rounded-lg p-4 border border-gray-700/50">
                            <label className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 block">Trait Spectrum</label>
                            <div className="space-y-2.5">
                                {[
                                    { name: 'Openness', value: personality.openness, low: 'Traditional', high: 'Adventurous' },
                                    { name: 'Conscientiousness', value: personality.conscientiousness, low: 'Impulsive', high: 'Disciplined' },
                                    { name: 'Extraversion', value: personality.extraversion, low: 'Reserved', high: 'Outgoing' },
                                    { name: 'Agreeableness', value: personality.agreeableness, low: 'Competitive', high: 'Cooperative' },
                                    { name: 'Neuroticism', value: personality.neuroticism, low: 'Confident', high: 'Sensitive' },
                                ].map(trait => (
                                    <div key={trait.name} className="flex items-center text-xs">
                                        <span className="w-20 text-gray-500 text-right pr-2 flex-shrink-0">{trait.low}</span>
                                        <div className="flex-grow h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                                                style={{ width: `${trait.value}%` }}
                                            />
                                        </div>
                                        <span className="w-20 text-gray-500 text-left pl-2 flex-shrink-0">{trait.high}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CharacterDetailsTab;
