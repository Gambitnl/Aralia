import React from 'react';
import { GlossaryEntry } from '../../types';

export const GlossaryItemStatBlock: React.FC<{ metadata: NonNullable<GlossaryEntry['itemMetadata']> }> = ({ metadata }) => {
    // The ingest pipeline uses "None" as a placeholder rarity for mundane items.
    // Hide that sentinel here so the card reads like a real item card instead of
    // surfacing the placeholder back to the player.
    const displayRarity = metadata.rarity && metadata.rarity !== 'None' ? metadata.rarity : undefined;

    // Rarity Color Mapping
    const rarityColors: Record<string, string> = {
        'Common': 'from-gray-500/20 to-gray-600/10 border-gray-500/50 text-gray-300',
        'Uncommon': 'from-green-500/20 to-green-600/10 border-green-500/50 text-green-400',
        'Rare': 'from-blue-500/20 to-blue-600/10 border-blue-500/50 text-blue-400',
        'Very Rare': 'from-purple-500/20 to-purple-600/10 border-purple-500/50 text-purple-400',
        'Legendary': 'from-orange-500/20 to-orange-600/10 border-orange-500/50 text-orange-400',
        'Artifact': 'from-red-500/20 to-red-600/10 border-red-500/50 text-red-400',
        'Unknown': 'from-sky-500/20 to-sky-600/10 border-sky-500/50 text-sky-400'
    };

    const rarityKey = displayRarity || 'Unknown';
    const colorClasses = rarityColors[rarityKey] || rarityColors['Unknown'];

    return (
        <div className={`mb-6 rounded-lg border bg-gradient-to-br backdrop-blur-md p-4 shadow-lg ${colorClasses}`}>
            {/* Header Row: Type and Rarity */}
            <div className="flex flex-wrap justify-between items-center mb-3 pb-2 border-b border-current/20">
                <div className="font-semibold tracking-wider uppercase text-sm">
                    {metadata.type || 'Item'}
                </div>
                {displayRarity && (
                    <div className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-black/40 shadow-inner">
                        {displayRarity}
                        {metadata.tier ? ` (${metadata.tier})` : ''}
                    </div>
                )}
            </div>

            {/* Attunement requirement */}
            {metadata.reqAttune && (
                <div className="mb-4 text-sm italic opacity-90">
                    <span className="font-semibold not-italic">Attunement:</span> {metadata.reqAttune}
                </div>
            )}

            {/* Grid Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
                {metadata.cost !== undefined && (
                    <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Cost</span>
                        <span className="font-medium text-white">{metadata.cost} gp</span>
                    </div>
                )}
                {metadata.weight !== undefined && (
                    <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Weight</span>
                        <span className="font-medium text-white">{metadata.weight} lb.</span>
                    </div>
                )}
                {metadata.ac !== undefined && (
                    <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Armor Class</span>
                        <span className="font-medium text-white">{metadata.ac}</span>
                    </div>
                )}
                {metadata.damage && (
                    <div className="flex flex-col col-span-2 sm:col-span-3">
                        <span className="text-xs uppercase opacity-70 font-semibold tracking-wider">Damage</span>
                        <span className="font-medium text-white text-base">{metadata.damage}</span>
                    </div>
                )}
            </div>

            {/* Properties Pills */}
            {metadata.properties && metadata.properties.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-current/20">
                    {metadata.properties.map((prop, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs font-medium bg-black/30 rounded border border-current/30 hover:bg-black/50 transition-colors cursor-default">
                            {prop}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};
