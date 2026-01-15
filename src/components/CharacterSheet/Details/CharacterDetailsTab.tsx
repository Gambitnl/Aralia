/**
 * @file CharacterDetailsTab.tsx
 * Displays personality traits, backstory, and character details.
 * Elegant gold-themed design with corner decorations.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
import { Companion } from '../../../types/companions';

interface CharacterDetailsTabProps {
    character: PlayerCharacter;
    companion?: Companion | null;
}

const CharacterDetailsTab: React.FC<CharacterDetailsTabProps> = ({ character, companion }) => {
    const soulData = character.soul;
    const personality = companion?.personality || soulData?.personality;
    const richData = character.richNpcData;

    const identity = companion?.identity || (soulData || richData ? {
        name: soulData?.name || character.name,
        physicalDescription: soulData?.physicalDescription || richData?.physicalDescription,
        age: richData?.age || character.age,
        race: character.race?.name,
        class: character.class?.name,
    } : null);

    const goals = companion?.goals?.filter(g => !g.isSecret && g.status === 'active');

    return (
        <div className="h-full overflow-y-auto scrollable-content">
            <div className="max-w-lg mx-auto space-y-6 p-4">

                {/* Portrait & Identity Section */}
                <section className="text-center py-4">
                    <div className="relative inline-block mb-4">
                        <div className="absolute -inset-2 bg-amber-500/20 blur-xl rounded-full" />
                        <div className="relative w-24 h-24 rounded-full border-2 border-amber-500/40 bg-gray-800 shadow-2xl mx-auto flex items-center justify-center">
                            <span className="text-4xl">⚔️</span>
                        </div>
                    </div>
                    <h2 className="font-cinzel text-2xl text-amber-400 tracking-wider">
                        {identity?.name || character.name}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {character.race?.name} · {character.class?.name}
                    </p>
                    {identity?.age && (
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">
                            Age: {identity.age}
                        </p>
                    )}
                </section>

                {/* Personality Profile Panel */}
                {personality && (
                    <section className="relative p-5 rounded-xl bg-gray-900/60 border border-amber-500/20 shadow-[0_0_25px_rgba(212,175,55,0.1)]">
                        {/* Corner Decorations */}
                        <div className="absolute top-0 left-0 border-t border-l border-amber-500/30 w-4 h-4 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 border-t border-r border-amber-500/30 w-4 h-4 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 border-b border-l border-amber-500/30 w-4 h-4 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 border-b border-r border-amber-500/30 w-4 h-4 rounded-br-lg" />

                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-amber-500/60">✦</span>
                            <h3 className="text-xs font-bold tracking-[0.15em] text-amber-400 uppercase">
                                Personality Profile
                            </h3>
                        </div>

                        {/* Values */}
                        {personality.values && personality.values.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-teal-400 text-sm" style={{ textShadow: '0 0 8px currentColor' }}>◆</span>
                                    <h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Values</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {personality.values.map((value, i) => (
                                        <span key={i} className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-[11px] font-semibold tracking-wide">
                                            {value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Fears */}
                        {personality.fears && personality.fears.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-red-400 text-sm" style={{ textShadow: '0 0 8px currentColor' }}>❄</span>
                                    <h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Fears</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {personality.fears.map((fear, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[11px] font-semibold tracking-wide">
                                            {fear}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quirks */}
                        {personality.quirks && personality.quirks.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-amber-400/60 text-sm">🧠</span>
                                    <h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Quirks</h4>
                                </div>
                                <ul className="space-y-2">
                                    {personality.quirks.map((quirk, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                            <span className="text-amber-400 mt-0.5">•</span>
                                            <span>{quirk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* Physical Description Panel */}
                {identity?.physicalDescription && (
                    <section className="p-6 bg-gray-800/60 rounded-xl border border-gray-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <span className="text-8xl rotate-12">🛡️</span>
                        </div>
                        <h3 className="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-4">
                            Physical Description
                        </h3>
                        <p className="font-serif italic text-lg leading-relaxed text-gray-300">
                            "{identity.physicalDescription}"
                        </p>
                    </section>
                )}

                {/* Background */}
                {character.background && (
                    <section className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
                        <h3 className="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-2">
                            Background
                        </h3>
                        <p className="text-amber-300 font-medium capitalize">{character.background}</p>
                    </section>
                )}

                {/* Reaction Style */}
                {soulData?.reactionStyle && (
                    <section className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
                        <h3 className="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-2">
                            Reaction Style
                        </h3>
                        <span className="px-3 py-1.5 bg-purple-900/40 text-purple-300 text-sm rounded-lg border border-purple-700/50 capitalize font-medium">
                            {soulData.reactionStyle}
                        </span>
                    </section>
                )}

                {/* Active Goals */}
                {((soulData?.goals && soulData.goals.length > 0) || (goals && goals.length > 0)) && (
                    <section>
                        <h3 className="text-xs font-bold tracking-[0.15em] text-amber-400 uppercase mb-3 px-1 flex items-center gap-2">
                            <span>🚩</span>
                            Active Goals
                        </h3>
                        <div className="space-y-2">
                            {(soulData?.goals?.filter(g => !g.isSecret) || []).map((goal, i) => (
                                <div key={i} className="p-4 bg-amber-500/5 border-l-2 border-amber-500 rounded-r-lg">
                                    <p className="text-sm font-medium text-gray-200">{goal.description}</p>
                                </div>
                            ))}
                            {(goals || []).map(goal => (
                                <div key={goal.id} className="p-4 bg-amber-500/5 border-l-2 border-amber-500 rounded-r-lg">
                                    <p className="text-sm font-medium text-gray-200">{goal.description}</p>
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
                    </section>
                )}

                {/* Fallback for no personality */}
                {!personality && !identity?.physicalDescription && (
                    <div className="text-gray-500 text-sm italic text-center py-12">
                        No personality data available for this character.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CharacterDetailsTab;
