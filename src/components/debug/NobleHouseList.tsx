/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/debug/NobleHouseList.tsx
 * A debug component to visualize the procedural noble houses and their relationships.
 */

import React, { useState } from 'react';
import { getAllFactions } from '../../utils/factionUtils';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { NobleHouse, Heraldry } from '../../types/noble';

interface NobleHouseListProps {
    worldSeed: number;
    onClose: () => void;
}

const SIGIL_MAP: Record<string, string> = {
    wolf: '🐺',
    lion: '🦁',
    tower: '🏰',
    sword: '⚔️',
    shield: '🛡️',
    dragon: '🐉',
    ship: '⛵',
    tree: '🌲',
    sun: '☀️',
    moon: '🌙',
    star: '⭐',
    skull: '💀'
};

const HeraldryDisplay: React.FC<{ heraldry: Heraldry; size?: number }> = ({ heraldry, size = 64 }) => {
    // Basic Shield Shape Path
    const shieldPath = "M12 2C12 2 4 4 4 14C4 19 12 22 12 22C12 22 20 19 20 14C20 4 12 2 12 2Z";

    // Pattern Definitions (masked by shield)
    const renderPattern = () => {
        switch (heraldry.pattern) {
            case 'party_per_pale':
                return <rect x="12" y="0" width="12" height="24" fill={heraldry.chargeColor} />;
            case 'party_per_fess':
                return <rect x="0" y="12" width="24" height="12" fill={heraldry.chargeColor} />;
            case 'quarterly':
                return (
                    <>
                        <rect x="12" y="0" width="12" height="12" fill={heraldry.chargeColor} />
                        <rect x="0" y="12" width="12" height="12" fill={heraldry.chargeColor} />
                    </>
                );
            case 'chevron':
                return <path d="M0 24L12 12L24 24" fill={heraldry.chargeColor} stroke={heraldry.chargeColor} strokeWidth="4" />;
            case 'bend':
                return <path d="M0 0L24 24" stroke={heraldry.chargeColor} strokeWidth="8" />;
            case 'saltire':
                return (
                    <>
                        <path d="M0 0L24 24" stroke={heraldry.chargeColor} strokeWidth="4" />
                        <path d="M24 0L0 24" stroke={heraldry.chargeColor} strokeWidth="4" />
                    </>
                );
            default: // solid
                return null;
        }
    };

    return (
        <div className="relative flex items-center justify-center shrink-0 shadow-md rounded-b-xl" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg">
                <defs>
                    <clipPath id={`shield-clip-${heraldry.sigil}-${size}`}>
                        <path d={shieldPath} />
                    </clipPath>
                </defs>
                {/* Field Color */}
                <rect width="24" height="24" fill={heraldry.fieldColor} clipPath={`url(#shield-clip-${heraldry.sigil}-${size})`} />

                {/* Pattern */}
                <g clipPath={`url(#shield-clip-${heraldry.sigil}-${size})`}>
                    {renderPattern()}
                </g>

                {/* Shield Border */}
                <path d={shieldPath} fill="none" stroke="#4a5568" strokeWidth="0.5" />
            </svg>

            {/* Sigil Emoji Overlay */}
            <div className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow-md pointer-events-none" style={{ fontSize: size * 0.4 }}>
                {SIGIL_MAP[heraldry.sigil] || '🛡️'}
            </div>
        </div>
    );
};

const NobleHouseList: React.FC<NobleHouseListProps> = ({ worldSeed, onClose }) => {
    const factions = getAllFactions(worldSeed);
    // TODO(lint-intent): The type assertion '(f): f is NobleHouse' helps TS narrow Faction -> NobleHouse.
    // TODO(lint-intent): However, ensure the runtime check 'f.type === NOBLE_HOUSE' strictly matches the type definition.
    // TODO(lint-intent): If NobleHouse adds required fields (heraldry, seat), legacy saves/generators might yield incomplete objects.
    // TODO(lint-intent): consider a robust guard functions that checks for 'heraldry' existence before narrowing.
    const nobleHouses = Object.values(factions)
        .filter((f): f is NobleHouse => f.type === 'NOBLE_HOUSE');

    const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);

    return (
        <WindowFrame
            title="Noble Houses of Aralia"
            onClose={onClose}
            storageKey={WINDOW_KEYS.NOBLE_HOUSE_LIST}
        >
            <div className="h-full overflow-y-auto p-4 font-sans bg-gray-900/95">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {nobleHouses.map(house => {
                        const isExpanded = selectedHouseId === house.id;

                        // Safety checks for new fields if using old seed/data
                        const heraldry = house.heraldry || { fieldColor: '#333', chargeColor: '#666', sigil: 'shield', pattern: 'solid' };
                        const seat = house.seat || 'Unknown Seat';
                        const origin = house.origin || 'Origins lost to time.';
                        const specialty = house.specialty || 'None';

                        return (
                            <div
                                key={house.id}
                                className={`
                                    bg-gray-800 border-2 rounded-lg transition-all duration-300 overflow-hidden flex flex-col
                                    ${isExpanded ? 'ring-2 ring-amber-500/50 shadow-2xl scale-[1.02]' : 'hover:border-gray-500'}
                                `}
                                style={{ borderColor: isExpanded ? '#f59e0b' : heraldry.fieldColor }}
                                onClick={() => setSelectedHouseId(isExpanded ? null : house.id)}
                            >
                                {/* Header / Banner */}
                                <div className="p-4 flex gap-4 items-start bg-gray-800/50 relative">
                                    <HeraldryDisplay heraldry={heraldry} size={80} />

                                    <div className="flex-1 min-w-0 z-[var(--z-index-content-overlay-low)]">
                                        <h3 className="text-xl font-bold text-white font-cinzel truncate">{house.name}</h3>
                                        <p className="text-amber-200 italic font-serif text-sm opacity-90">&quot;{house.motto}&quot;</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-xs text-gray-400 font-mono uppercase tracking-wider bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                                                Seat: {seat}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono uppercase tracking-wider bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                                                Ind: {specialty}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Background Splash */}
                                    <div
                                        className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none rounded-bl-full transform translate-x-8 -translate-y-8"
                                        style={{ backgroundColor: heraldry.chargeColor }}
                                    />
                                </div>

                                {/* Quick Stats Bar */}
                                <div className="grid grid-cols-3 divide-x divide-gray-700 border-t border-b border-gray-700 bg-gray-900/30 text-xs text-gray-400 text-center py-2">
                                    <div title="Wealth">💰 {house.wealth}/10</div>
                                    <div title="Military Power">⚔️ {house.militaryPower}/10</div>
                                    <div title="Influence">👑 {house.politicalInfluence}/10</div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="p-4 bg-gray-900/50 space-y-4 border-t border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Origin</h4>
                                            <p className="text-sm text-gray-300 leading-relaxed">{origin}</p>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Key Members</h4>
                                            <div className="space-y-2">
                                                {house.members.map(member => (
                                                    <div key={member.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                                                        <div>
                                                            <div className="text-gray-200 font-medium text-sm">
                                                                {member.firstName} <span className="text-gray-500 text-xs">({member.role})</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {member.traits.slice(0, 2).join(', ')}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-right text-gray-400 font-mono">
                                                            <div>INT: {member.stats.intrigue}</div>
                                                            <div>CHM: {member.stats.charm}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Values</h4>
                                                <div className="flex flex-wrap gap-1">
                                                    {house.values.map(v => (
                                                        <span key={v} className="px-1.5 py-0.5 bg-green-900/30 border border-green-900 text-green-200 text-[10px] rounded">
                                                            {v}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Hates</h4>
                                                <div className="flex flex-wrap gap-1">
                                                    {house.hates.map(h => (
                                                        <span key={h} className="px-1.5 py-0.5 bg-red-900/30 border border-red-900 text-red-200 text-[10px] rounded">
                                                            {h}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!isExpanded && (
                                    <div className="p-2 text-center text-xs text-gray-600 hover:text-gray-400 cursor-pointer transition-colors bg-gray-900/20">
                                        Click to expanded details
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </WindowFrame>
    );
};

export default NobleHouseList;
