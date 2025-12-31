
import React, { useState, useEffect } from 'react';
import { useGameState } from '../../../state/GameContext';
import { ThievesGuildSystem } from '../../../systems/crime/ThievesGuildSystem';
import { GuildJob, GuildService } from '../../../types/crime';
import { LOCATIONS } from '../../../constants';
import FenceInterface from './FenceInterface';

const ThievesGuildInterface: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state, dispatch } = useGameState();
    const { thievesGuild } = state;
    const [availableJobs, setAvailableJobs] = useState<GuildJob[]>([]);
    const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'services'>('jobs');
    const [availableServices, setAvailableServices] = useState<GuildService[]>([]);
    const [activeService, setActiveService] = useState<GuildService | null>(null);

    useEffect(() => {
        // Use stored available jobs if they exist for this "session" or day, otherwise generate
        let jobs = thievesGuild.availableJobs;

        if (!jobs || jobs.length === 0) {
             jobs = ThievesGuildSystem.generateJobs(
                thievesGuild.guildId,
                thievesGuild.rank,
                Object.values(LOCATIONS),
                state.worldSeed + state.gameTime.getDate()
            );
            // Dispatch to store them so they persist while menu is open/closed during same day
            // (Ideally we check if the stored jobs are stale based on time, but simple for now)
            dispatch({ type: 'SET_AVAILABLE_GUILD_JOBS', payload: { jobs } });
        }

        // Filter out jobs already taken
        const takenIds = thievesGuild.activeJobs.map(j => j.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvailableJobs(jobs.filter(j => !takenIds.includes(j.id)));

        setAvailableServices(ThievesGuildSystem.getAvailableServices(thievesGuild.rank));
    }, [thievesGuild.rank, state.gameTime, thievesGuild.activeJobs, thievesGuild.guildId, state.worldSeed, thievesGuild.availableJobs, dispatch]);

    const handleUseService = (service: GuildService) => {
        if (service.type === 'Fence') {
            setActiveService(service);
            return;
        }

        dispatch({
            type: 'USE_GUILD_SERVICE',
            payload: {
                serviceId: service.id,
                cost: service.costGold,
                description: service.name
            }
        });
    };

    const handleAcceptJob = (job: GuildJob) => {
        dispatch({ type: 'ACCEPT_GUILD_JOB', payload: { job } });
    };

    const handleCompleteJob = (job: GuildJob) => {
        // Logic to verify completion would go here. For now, simulate success.
        dispatch({
            type: 'COMPLETE_GUILD_JOB',
            payload: {
                jobId: job.id,
                success: true,
                rewardGold: job.rewardGold,
                rewardRep: job.rewardReputation
            }
        });
    };

    const handleAbandonJob = (job: GuildJob) => {
        dispatch({ type: 'ABANDON_GUILD_JOB', payload: { jobId: job.id } });
    };

    if (activeService) {
        if (activeService.type === 'Fence') {
            return <FenceInterface service={activeService} onClose={() => setActiveService(null)} />;
        }
        // Future services (Forgery, etc) could go here
    }

    if (thievesGuild.rank === 0) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-900 border border-purple-900 p-6 rounded-lg max-w-md w-full shadow-2xl">
                    <h2 className="text-2xl font-bold text-purple-400 mb-4">The Shadows Watch</h2>
                    <p className="text-gray-300 mb-6">
                        You sense eyes upon you. The underworld has taken notice of your deeds, but you are not yet one of them.
                    </p>
                    <div className="flex justify-end gap-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white"
                        >
                            Leave
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'JOIN_GUILD', payload: { guildId: 'shadow_hands' } })}
                            className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white rounded border border-purple-700"
                        >
                            Seek Membership
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-purple-900 rounded-lg max-w-4xl w-full h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gray-800 p-4 border-b border-purple-900 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-purple-400">Shadow Hands Guild</h2>
                        <div className="flex gap-4 text-sm text-gray-400 mt-1">
                            <span>Rank: <span className="text-white">{getRankName(thievesGuild.rank)}</span></span>
                            <span>Reputation: <span className="text-white">{thievesGuild.reputation}</span></span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
                </div>

                {/* Navigation */}
                <div className="flex border-b border-gray-700">
                    <button
                        className={`flex-1 py-3 text-center transition-colors ${activeTab === 'jobs' ? 'bg-purple-900/30 text-purple-300 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('jobs')}
                    >
                        Available Contracts
                    </button>
                    <button
                        className={`flex-1 py-3 text-center transition-colors ${activeTab === 'active' ? 'bg-purple-900/30 text-purple-300 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Active Jobs ({thievesGuild.activeJobs.length})
                    </button>
                    <button
                        className={`flex-1 py-3 text-center transition-colors ${activeTab === 'services' ? 'bg-purple-900/30 text-purple-300 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-gray-800'}`}
                        onClick={() => setActiveTab('services')}
                    >
                        Services
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-900/90">
                    {activeTab === 'jobs' && (
                        <div className="space-y-4">
                            {availableJobs.length === 0 ? (
                                <p className="text-gray-500 text-center italic">No contracts available at this time. Come back later.</p>
                            ) : (
                                availableJobs.map(job => (
                                    <div key={job.id} className="bg-gray-800 border border-gray-700 p-4 rounded hover:border-purple-700 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-bold text-gray-200">{job.title}</h3>
                                            <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(job.difficulty)}`}>Diff: {job.difficulty}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm mb-3">{job.description}</p>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-yellow-500">Reward: {job.rewardGold} gp</span>
                                            {thievesGuild.rank >= job.requiredRank ? (
                                                <button
                                                    onClick={() => handleAcceptJob(job)}
                                                    className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm transition-colors"
                                                >
                                                    Accept Contract
                                                </button>
                                            ) : (
                                                <span className="text-red-500">Requires Rank {job.requiredRank}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'active' && (
                        <div className="space-y-4">
                             {thievesGuild.activeJobs.length === 0 ? (
                                <p className="text-gray-500 text-center italic">You have no active jobs.</p>
                            ) : (
                                thievesGuild.activeJobs.map(job => (
                                    <div key={job.id} className="bg-gray-800 border border-purple-500/50 p-4 rounded">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-bold text-purple-300">{job.title}</h3>
                                            <span className="text-xs text-gray-500 uppercase tracking-wide">{job.type}</span>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-4">{job.description}</p>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleAbandonJob(job)}
                                                className="px-3 py-1 border border-red-800 text-red-500 hover:bg-red-900/20 rounded text-sm transition-colors"
                                            >
                                                Abandon
                                            </button>
                                            <button
                                                onClick={() => handleCompleteJob(job)}
                                                className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-sm transition-colors"
                                            >
                                                Complete (Simulated)
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'services' && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableServices.map(service => (
                                <div key={service.id} className="bg-gray-800 border border-gray-700 p-4 rounded flex flex-col">
                                    <h3 className="text-lg font-bold text-gray-200 mb-1">{service.name}</h3>
                                    <p className="text-gray-400 text-sm flex-1 mb-3">{service.description}</p>
                                    <div className="flex justify-between items-center text-sm border-t border-gray-700 pt-3 mb-2">
                                        <span className="text-gray-500">{service.type}</span>
                                        <span className="text-yellow-500">{service.costGold > 0 ? `${service.costGold} gp` : 'Free'}</span>
                                    </div>
                                    <button
                                        onClick={() => handleUseService(service)}
                                        className={`w-full py-1.5 rounded text-sm transition-colors ${state.gold >= service.costGold ? 'bg-purple-900 hover:bg-purple-800 text-purple-100' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                        disabled={state.gold < service.costGold}
                                    >
                                        {state.gold >= service.costGold ? 'Purchase Service' : 'Not Enough Gold'}
                                    </button>
                                </div>
                            ))}
                            {availableServices.length === 0 && (
                                <p className="col-span-2 text-gray-500 text-center italic">No services available at your rank.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helpers
function getRankName(rank: number): string {
    switch(rank) {
        case 0: return 'Outsider';
        case 1: return 'Associate';
        case 2: return 'Footpad';
        case 3: return 'Prowler';
        case 4: return 'Shadow';
        case 5: return 'Master Thief';
        default: return 'Unknown';
    }
}

function getDifficultyColor(diff: number): string {
    if (diff <= 2) return 'bg-green-900 text-green-200';
    if (diff <= 5) return 'bg-yellow-900 text-yellow-200';
    return 'bg-red-900 text-red-200';
}

export default ThievesGuildInterface;
