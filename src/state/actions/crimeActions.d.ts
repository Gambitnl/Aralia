/**
 * @file src/state/actions/crimeActions.ts
 * Action creators for the Crime and Thieves Guild systems.
 */
import { AppAction } from '../actionTypes';
import { GuildJob } from '../../types/crime';
export declare const acceptJob: (job: GuildJob) => AppAction;
export declare const completeJob: (jobId: string, success: boolean, rewardGold: number, rewardRep: number) => AppAction;
export declare const joinGuild: (guildId: string) => AppAction;
export declare const abandonJob: (jobId: string) => AppAction;
