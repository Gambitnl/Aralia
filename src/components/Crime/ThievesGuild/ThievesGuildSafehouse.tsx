import React from 'react';
import { GuildMembership } from '../../../types/crime';
import { WindowFrame } from '../../ui/WindowFrame';
import { ThievesGuildSystem } from '../../../systems/crime/ThievesGuildSystem';

interface ThievesGuildSafehouseProps {
    membership: GuildMembership;
    onUseService: (serviceId: string, cost: number, description: string) => void;
    onClose: () => void;
}

export const ThievesGuildSafehouse: React.FC<ThievesGuildSafehouseProps> = ({
    membership,
    onUseService,
    onClose
}) => {
    const availableServices = ThievesGuildSystem.getAvailableServices(membership.rank);

    return (
        <WindowFrame title="Shadow Hands Safehouse" onClose={onClose}>
            <div className="p-6 bg-gray-900 text-gray-200">
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-purple-400">The Undercroft</h2>
                        <p className="text-gray-400 text-sm">Sanctuary for the initiated.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase text-gray-400">Rank</div>
                        <div className="text-xl font-bold text-white">Rank {membership.rank}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableServices.map(service => {
                        const isLocked = membership.rank < service.requiredRank;
                        return (
                            <button
                                key={service.id}
                                disabled={isLocked}
                                onClick={() => onUseService(service.id, service.costGold, service.name)}
                                className={`p-4 rounded border text-left transition-all ${
                                    isLocked 
                                        ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed'
                                        : 'bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-purple-500'
                                }`}
                            >
                                <div className="flex justify-between">
                                    <span className="font-bold text-purple-300">{service.name}</span>
                                    <span className="text-amber-400 text-sm">{service.costGold > 0 ? `${service.costGold}gp` : 'Free'}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1">{service.description}</p>
                                {isLocked && (
                                    <div className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                        🔒 Requires Rank {service.requiredRank}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </WindowFrame>
    );
};
