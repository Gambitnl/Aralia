/**
 * @file FamilyTreeTab.tsx
 * Displays the character's family tree with visual relationship indicators.
 */
import React from 'react';
import { PlayerCharacter } from '../../types';
import { FamilyMember } from '../../types/world';

interface FamilyTreeTabProps {
    character: PlayerCharacter;
}

const getRelationIcon = (relation: string): string => {
    switch (relation) {
        case 'parent': return '👤';
        case 'spouse': return '💍';
        case 'child': return '👶';
        case 'sibling': return '🤝';
        default: return '👥';
    }
};

const getRelationColor = (relation: string): string => {
    switch (relation) {
        case 'parent': return 'border-blue-600/50 bg-blue-900/30';
        case 'spouse': return 'border-pink-600/50 bg-pink-900/30';
        case 'child': return 'border-green-600/50 bg-green-900/30';
        case 'sibling': return 'border-yellow-600/50 bg-yellow-900/30';
        default: return 'border-gray-600/50 bg-gray-800/30';
    }
};

const FamilyTreeTab: React.FC<FamilyTreeTabProps> = ({ character }) => {
    const family = character.richNpcData?.family || [];

    // Group family by relation type
    const parents = family.filter(m => m.relation === 'parent');
    const spouse = family.filter(m => m.relation === 'spouse');
    const children = family.filter(m => m.relation === 'child');
    const siblings = family.filter(m => m.relation === 'sibling');

    const renderMember = (member: FamilyMember) => (
        <div
            key={member.id}
            className={`rounded-lg border p-4 ${getRelationColor(member.relation)} transition-all hover:scale-[1.02]`}
        >
            <div className="flex items-start gap-3">
                <span className="text-2xl">{getRelationIcon(member.relation)}</span>
                <div className="flex-grow">
                    <h4 className="text-amber-300 font-medium">{member.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className="capitalize">{member.relation}</span>
                        {member.age && <span>· Age {member.age}</span>}
                        {!member.isAlive && (
                            <span className="text-red-400">· Deceased ✝</span>
                        )}
                    </div>
                </div>
                {member.isAlive ? (
                    <span className="text-green-400 text-xs px-2 py-0.5 bg-green-900/30 rounded-full border border-green-700/50">
                        Living
                    </span>
                ) : (
                    <span className="text-red-400 text-xs px-2 py-0.5 bg-red-900/30 rounded-full border border-red-700/50">
                        Deceased
                    </span>
                )}
            </div>
        </div>
    );

    const renderSection = (title: string, members: FamilyMember[], icon: string) => {
        if (members.length === 0) return null;
        return (
            <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                    <span>{icon}</span>
                    <span>{title}</span>
                    <span className="text-gray-500">({members.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {members.map(renderMember)}
                </div>
            </div>
        );
    };

    if (family.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center py-12">
                    <span className="text-6xl opacity-30">👤</span>
                    <p className="text-gray-500 mt-4">No family information available.</p>
                    <p className="text-gray-600 text-sm mt-1">
                        Family details are generated for companions created via Quick Start.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto scrollable-content p-4">
            {/* Character as the center of the tree */}
            <div className="mb-6 text-center">
                <div className="inline-block bg-amber-900/40 border-2 border-amber-500/50 rounded-xl p-4">
                    <span className="text-3xl">⭐</span>
                    <h3 className="text-xl font-cinzel text-amber-400 mt-2">{character.name}</h3>
                    <p className="text-gray-400 text-sm">
                        {character.race?.name} {character.class?.name}
                        {character.richNpcData?.age && ` · Age ${character.richNpcData.age}`}
                    </p>
                </div>
            </div>

            {/* Family sections */}
            <div className="max-w-3xl mx-auto">
                {renderSection('Parents', parents, '👤')}
                {renderSection('Spouse', spouse, '💍')}
                {renderSection('Siblings', siblings, '🤝')}
                {renderSection('Children', children, '👶')}
            </div>

            {/* Summary */}
            <div className="mt-8 pt-4 border-t border-gray-700 text-center">
                <p className="text-gray-500 text-xs">
                    Family of {family.length} members ·
                    {' '}{family.filter(m => m.isAlive).length} living ·
                    {' '}{family.filter(m => !m.isAlive).length} deceased
                </p>
            </div>
        </div>
    );
};

export default FamilyTreeTab;
