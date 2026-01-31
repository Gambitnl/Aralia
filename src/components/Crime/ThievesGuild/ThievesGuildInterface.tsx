
import React, { useState, useEffect } from 'react';
import { useGameState } from '../../../state/GameContext';
import { ThievesGuildSystem } from '../../../systems/crime/ThievesGuildSystem';
import { GuildJob, GuildMembership, GuildService } from '../../../types/crime';
import { LOCATIONS } from '../../../constants';
import FenceInterface from './FenceInterface';
import { WindowFrame } from '../../ui/WindowFrame';

const ThievesGuildInterface: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { state, dispatch } = useGameState();
    const baseGuild: GuildMembership = {
        memberId: state.party[0]?.id ?? 'player-1',
        guildId: 'shadow_hands',
        rank: 0,
        reputation: 0,
        activeJobs: [],
        availableJobs: [],
        completedJobs: [],
        servicesUnlocked: [],
    };
    const guild = state.thievesGuild ?? baseGuild;
    const [availableJobs, setAvailableJobs] = useState<GuildJob[]>([]);
    const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'services'>('jobs');
    const [availableServices, setAvailableServices] = useState<GuildService[]>([]);
    const [activeService, setActiveService] = useState<GuildService | null>(null);

    useEffect(() => {
        // Use stored available jobs if they exist for this "session" or day, otherwise generate
        let jobs = guild.availableJobs;

        if (!jobs || jobs.length === 0) {
            jobs = ThievesGuildSystem.generateJobs(
                guild.guildId,
                guild.rank,
                Object.values(LOCATIONS),
                state.worldSeed + state.gameTime.getDate()
            );
            // Dispatch to store them so they persist while menu is open/closed during same day
            // (Ideally we check if the stored jobs are stale based on time, but simple for now)
            dispatch({ type: 'SET_AVAILABLE_GUILD_JOBS', payload: { jobs } });
        }

        // Filter out jobs already taken
        const takenIds = guild.activeJobs.map(j => j.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvailableJobs(jobs.filter(j => !takenIds.includes(j.id)));

        setAvailableServices(ThievesGuildSystem.getAvailableServices(guild.rank));
    }, [guild.rank, state.gameTime, guild.activeJobs, guild.guildId, state.worldSeed, guild.availableJobs, dispatch]);

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

    if (guild.rank === 0) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[var(--z-index-modal-background)] p-4">
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

    // Helper variables for the new UI
    const guildRank = getRankName(guild.rank);
    const reputationLevel = guild.rank; // Assuming rank is used for reputation level display
    const guildReputation = guild.reputation;

    return (
        <WindowFrame
            title="Shadow Hands Guild"
            onClose={onClose}
            storageKey="thieves-guild-window"
        >
            <div className="flex flex-col h-full bg-gray-900 text-gray-200 font-sans">
                {/* Header Section */}
                <div className="bg-gray-800 p-6 border-b border-purple-900/50 flex justify-between items-center shadow-lg shrink-0">
                    <div>
                        <div className="text-xl font-bold text-purple-400">{guildRank}</div>
                        <div className="text-sm text-gray-400">Rank {guild.rank} • Reputation {guildReputation}</div>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={() => setActiveTab('jobs')} className={`px-4 py-2 rounded ${activeTab === 'jobs' ? 'bg-purple-900 text-white' : 'bg-gray-700 text-gray-400'}`}>Jobs</button>
                        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded ${activeTab === 'active' ? 'bg-purple-900 text-white' : 'bg-gray-700 text-gray-400'}`}>Active</button>
                        <button onClick={() => setActiveTab('services')} className={`px-4 py-2 rounded ${activeTab === 'services' ? 'bg-purple-900 text-white' : 'bg-gray-700 text-gray-400'}`}>Services</button>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'jobs' && (
                        <div className="grid gap-4">
                            {availableJobs.map(job => (
                                <div key={job.id} className="bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-white">{job.description}</h3>
                                        <div className={`text-xs inline-block px-2 py-1 rounded mt-1 ${getDifficultyColor(job.difficulty)}`}>Difficulty: {job.difficulty}</div>
                                        <div className="text-sm text-yellow-500 mt-1">Reward: {job.rewardGold}g • {job.rewardReputation} Rep</div>
                                    </div>
                                    <button onClick={() => handleAcceptJob(job)} className="bg-purple-700 hover:bg-purple-600 px-3 py-1 rounded text-white text-sm">Accept</button>
                                </div>
                            ))}
                            {availableJobs.length === 0 && <p className="text-gray-500 text-center italic">No new jobs available right now.</p>}
                        </div>
                    )}

                    {activeTab === 'active' && (
                        <div className="grid gap-4">
                            {guild.activeJobs.map(job => (
                                <div key={job.id} className="bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-white">{job.description}</h3>
                                        <div className="text-sm text-yellow-500">Reward: {job.rewardGold}g</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleCompleteJob(job)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-white text-sm">Complete</button>
                                        <button onClick={() => handleAbandonJob(job)} className="bg-red-900 hover:bg-red-800 px-3 py-1 rounded text-white text-sm">Abandon</button>
                                    </div>
                                </div>
                            ))}
                            {guild.activeJobs.length === 0 && <p className="text-gray-500 text-center italic">You have no active jobs.</p>}
                        </div>
                    )}

                    {activeTab === 'services' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {availableServices.map(service => (
                                <div key={service.id} className="bg-gray-800 p-4 rounded border border-gray-700">
                                    <h3 className="font-bold text-white">{service.name}</h3>
                                    <p className="text-sm text-gray-400 my-2">{service.description}</p>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-yellow-500">{service.costGold}g</span>
                                        <button onClick={() => handleUseService(service)} className="bg-purple-700 hover:bg-purple-600 px-3 py-1 rounded text-white text-sm">Use</button>
                                    </div>
                                </div>
                            ))}
                            {availableServices.length === 0 && <p className="col-span-2 text-gray-500 text-center italic">No services available at your rank.</p>}
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

// Helpers
function getRankName(rank: number): string {
    switch (rank) {
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
