/**
 * @file src/state/actions/crimeActions.ts
 * Action creators for the Crime and Thieves Guild systems.
 */
import { AppAction } from '../actionTypes';
import { GuildJob } from '../../types/crime';

export const acceptJob = (job: GuildJob): AppAction => ({
    type: 'ACCEPT_GUILD_JOB',
    payload: { job }
});

export const completeJob = (
    jobId: string, 
    success: boolean, 
    rewardGold: number, 
    rewardRep: number
): AppAction => ({
    type: 'COMPLETE_GUILD_JOB',
    payload: { jobId, success, rewardGold, rewardRep }
});

export const joinGuild = (guildId: string): AppAction => ({
    type: 'JOIN_GUILD',
    payload: { guildId }
});

export const abandonJob = (jobId: string): AppAction => ({
    type: 'ABANDON_GUILD_JOB',
    payload: { jobId }
});
