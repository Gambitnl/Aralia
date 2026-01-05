
import { GameState, Crime, HeistActionType } from '../../types';
import { AppAction } from '../actionTypes';
import { CrimeSystem } from '../../systems/crime/CrimeSystem';
import { HeistManager } from '../../systems/crime/HeistManager';
import type { Location, HeistAction, GuildMembership } from '../../types';

const getGuildMembershipOrDefault = (guild: GameState['thievesGuild'] | undefined): GuildMembership => {
    const fallback: GuildMembership = {
        memberId: 'player',
        guildId: 'shadow_hands',
        rank: 0,
        reputation: 0,
        activeJobs: [],
        availableJobs: [],
        completedJobs: [],
        servicesUnlocked: [],
    };
    if (!guild) {
        // TODO(2026-01-03 pass 4 Codex-CLI): placeholder guild membership to satisfy type expectations; replace once thieves guild state is guaranteed before these actions.
        return fallback;
    }
    return {
        ...fallback,
        ...guild,
        memberId: guild.memberId ?? fallback.memberId,
    };
};

/**
 * Handles crime and notoriety related actions.
 */
export const crimeReducer = (state: GameState, action: AppAction): Partial<GameState> => {
    switch (action.type) {
        // --- Heist Actions ---

        case 'START_HEIST_PLANNING': {
            const { targetLocationId, leaderId, guildJobId } = action.payload;

            // HeistManager.startPlanning currently only uses the ID from the location object.
            // We pass a minimal object to avoid needing to look up the full Location entity here.
            // TODO: If startPlanning needs more location data later, fetch it from state.dynamicLocations or similar.
            // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            const targetLocation = { id: targetLocationId } as Location;
            let plan = HeistManager.startPlanning(targetLocation, leaderId);

            if (guildJobId) {
                plan = { ...plan, guildJobId };
            }

            return {
                activeHeist: plan,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Heist planning started for location: ${targetLocationId}.`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'ADD_HEIST_INTEL': {
            const { intel } = action.payload;
            if (!state.activeHeist) return {};

            const updatedPlan = HeistManager.addIntel(state.activeHeist, intel);

            return {
                activeHeist: updatedPlan,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Intel gathered: ${intel.description}`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'ADVANCE_HEIST_PHASE': {
            if (!state.activeHeist) return {};
            const updatedPlan = HeistManager.advancePhase(state.activeHeist);

            return {
                activeHeist: updatedPlan,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Heist phase advanced to: ${updatedPlan.phase}`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'PERFORM_HEIST_ACTION': {
            const { actionDifficulty, description, success, alertChange, skillCheckResult } = action.payload;
            if (!state.activeHeist) return {};

            let outcomeMessage = '';

            if (skillCheckResult) {
                outcomeMessage = `${description} - ${skillCheckResult}`;
            } else {
                // Use a default message if no skill check string provided
                // Use the calculated chance just for display if needed, but success is pre-determined
                const heistAction: HeistAction = {
                    type: HeistActionType.PickLock,
                    description,
                    difficulty: actionDifficulty,
                    risk: 0,
                    noise: 0,
                };
                const chance = HeistManager.calculateActionSuccessChance(state.activeHeist, heistAction);
                outcomeMessage = success
                    ? `${description} - Success! (Risk: ${100 - chance}%)`
                    : `${description} - Failed! (Risk: ${100 - chance}%)`;
            }

            const newAlertLevel = Math.min(100, state.activeHeist.alertLevel + alertChange);
            const turnsElapsed = state.activeHeist.turnsElapsed + 1;

            return {
                activeHeist: {
                    ...state.activeHeist,
                    alertLevel: newAlertLevel,
                    turnsElapsed
                },
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: outcomeMessage,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'ABORT_HEIST': {
            return {
                activeHeist: null,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Heist aborted.`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'COMMIT_CRIME': {
            const { type, locationId, severity, witnessed } = action.payload;

            // Normalize severity to 1-100 scale if it seems to be using 1-10
            const normalizedSeverity = severity <= 10 ? severity * 10 : severity;

            const newCrime: Crime = {
                id: crypto.randomUUID(),
                type,
                locationId,
                timestamp: state.gameTime.getTime(),
                severity: normalizedSeverity,
                witnessed,
            };

            // Use the normalized severity for heat calculations to keep balance
            // (Assuming existing 1-10 logic expected ~20 heat max for severe crimes)
            // But if we switch to 1-100, we need to adjust the heat scaling.
            // Let's adopt 1-100 as the standard.
            // Old: 10 * 2 = 20 heat. New: 100 * 0.2 = 20 heat.
            // TODO: This currently applies 0.5/0.1 multipliers on 1–100, so a witnessed severity 5 yields +25 heat instead of the expected ~10; align the units or drop normalization.
            const heatIncrease = witnessed ? normalizedSeverity * 0.5 : normalizedSeverity * 0.1;

            const currentLocalHeat = state.notoriety.localHeat[locationId] || 0;
            const newLocalHeat = Math.min(100, currentLocalHeat + heatIncrease);
            const newGlobalHeat = Math.min(100, state.notoriety.globalHeat + (heatIncrease * 0.1));

            // Generate bounty if applicable (threshold 30 severity on 1-100 scale)
            const newBounty = CrimeSystem.generateBounty(newCrime);

            const currentBounties = state.notoriety.bounties || [];

            return {
                notoriety: {
                    ...state.notoriety,
                    globalHeat: newGlobalHeat,
                    localHeat: {
                        ...state.notoriety.localHeat,
                        [locationId]: newLocalHeat,
                    },
                    knownCrimes: [...state.notoriety.knownCrimes, newCrime],
                    bounties: newBounty ? [...currentBounties, newBounty] : currentBounties
                },
                messages: [
                  ...state.messages,
                  {
                    id: Date.now(),
                    text: witnessed
                      ? `Crime witnessed! You are now wanted for ${type}.`
                      : `You committed ${type} unseen, but rumors may spread.`,
                    sender: 'system',
                    timestamp: state.gameTime
                  },
                  ...(newBounty ? [{
                    id: Date.now() + 1,
                    text: `A bounty of ${newBounty.amount} gold has been placed on your head!`,
                    sender: 'system' as const,
                    timestamp: state.gameTime
                  }] : [])
                ]
            };
        }

        case 'LOWER_HEAT': {
            const { amount, locationId } = action.payload;

            const newNotoriety = { ...state.notoriety };

            if (locationId) {
                const current = newNotoriety.localHeat[locationId] || 0;
                newNotoriety.localHeat = {
                    ...newNotoriety.localHeat,
                    [locationId]: Math.max(0, current - amount)
                };
            } else {
                newNotoriety.globalHeat = Math.max(0, newNotoriety.globalHeat - amount);
                // Also lower local heat everywhere slightly
                const updatedLocalHeat: Record<string, number> = {};
                for (const loc in newNotoriety.localHeat) {
                    updatedLocalHeat[loc] = Math.max(0, newNotoriety.localHeat[loc] - (amount * 0.5));
                }
                newNotoriety.localHeat = updatedLocalHeat;
            }

            return {
                notoriety: newNotoriety,
                 messages: [
                  ...state.messages,
                  {
                    id: Date.now(),
                    text: `Your notoriety has decreased.`,
                    sender: 'system',
                    timestamp: state.gameTime
                  }
                ]
            };
        }

        case 'JOIN_GUILD': {
            const { guildId } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);
            return {
                thievesGuild: {
                    ...guild,
                    guildId,
                    rank: 1,
                    reputation: 0,
                    memberId: state.party[0]?.id || guild.memberId
                },
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You have joined the Thieves Guild.`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'ACCEPT_GUILD_JOB': {
            const { job } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);
            // Add to active jobs
            return {
                thievesGuild: {
                    ...guild,
                    activeJobs: [...guild.activeJobs, job],
                    // Remove from available if we were tracking that separately?
                    // For now, assuming available jobs are transient or managed by UI
                },
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `Accepted job: ${job.title}`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'COMPLETE_GUILD_JOB': {
            const { jobId, success, rewardGold, rewardRep } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);
            const job = guild.activeJobs.find(j => j.id === jobId);
            if (!job) return {};

            const newActiveJobs = guild.activeJobs.filter(j => j.id !== jobId);
            const newCompletedJobs = [...guild.completedJobs, jobId];
            const newRep = guild.reputation + rewardRep;

            // Rank up logic? (Simple threshold for now)
            let newRank = guild.rank;
            let rankUpMsg = '';
            if (newRep >= 100 && newRank < 2) { newRank = 2; rankUpMsg = 'You have been promoted to Footpad!'; }
            else if (newRep >= 300 && newRank < 3) { newRank = 3; rankUpMsg = 'You have been promoted to Prowler!'; }
            else if (newRep >= 600 && newRank < 4) { newRank = 4; rankUpMsg = 'You have been promoted to Shadow!'; }
            else if (newRep >= 1000 && newRank < 5) { newRank = 5; rankUpMsg = 'You have been promoted to Master Thief!'; }

            const msgs = [
                ...state.messages,
                {
                    id: Date.now(),
                    text: success
                        ? `Job completed! Earned ${rewardGold}gp and ${rewardRep} rep.`
                        : `Job failed. Reputation change: ${rewardRep}.`,
                    sender: 'system' as const,
                    timestamp: state.gameTime
                }
            ];

            if (rankUpMsg) {
                msgs.push({
                    id: Date.now() + 1,
                    text: rankUpMsg,
                    sender: 'system' as const,
                    timestamp: state.gameTime
                });
            }

            return {
                gold: state.gold + rewardGold,
                thievesGuild: {
                    ...guild,
                    activeJobs: newActiveJobs,
                    completedJobs: newCompletedJobs,
                    reputation: newRep,
                    rank: newRank
                },
                messages: msgs
            };
        }

        case 'ABANDON_GUILD_JOB': {
            const { jobId } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);
            const newActiveJobs = guild.activeJobs.filter(j => j.id !== jobId);
            return {
                thievesGuild: {
                    ...guild,
                    activeJobs: newActiveJobs
                },
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You abandoned the job.`,
                        sender: 'system',
                        timestamp: state.gameTime
                    }
                ]
            };
        }

        case 'USE_GUILD_SERVICE': {
            const { serviceId, cost, description } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);

            if (state.gold < cost) {
                return {
                    messages: [
                        ...state.messages,
                        { id: Date.now(), text: `Not enough gold for service: ${description}`, sender: 'system', timestamp: state.gameTime }
                    ]
                };
            }

            // Apply effect based on service ID or type.
            // Simplified: Just deduct gold and add unlocked service ID to history for now.
            // Real implementation would lower heat, etc.

            const newNotoriety = { ...state.notoriety };
            let msg = `Used service: ${description}.`;

            if (serviceId === 'service_bribe') {
                // Bribe lowers heat
                newNotoriety.globalHeat = Math.max(0, newNotoriety.globalHeat - 20);
                // Lower all local heat by 50
                const updatedLocalHeat: Record<string, number> = {};
                for (const loc in newNotoriety.localHeat) {
                    updatedLocalHeat[loc] = Math.max(0, newNotoriety.localHeat[loc] - 50);
                }
                newNotoriety.localHeat = updatedLocalHeat;
                msg += " Heat reduced.";
            }

            return {
                gold: state.gold - cost,
                thievesGuild: {
                    ...guild,
                    servicesUnlocked: [...guild.servicesUnlocked, serviceId] // Track usage?
                },
                notoriety: newNotoriety,
                messages: [
                    ...state.messages,
                    { id: Date.now(), text: msg, sender: 'system', timestamp: state.gameTime }
                ]
            };
        }

        case 'SET_AVAILABLE_GUILD_JOBS': {
            const { jobs } = action.payload;
            const guild = getGuildMembershipOrDefault(state.thievesGuild);
            return {
                thievesGuild: {
                    ...guild,
                    availableJobs: jobs
                }
            };
        }

        default:
            return {};
    }
};
