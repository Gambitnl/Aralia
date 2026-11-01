/**
 * GG-480 (audit 2026-10-25): a Thieves Guild job pays once. Before the fix,
 * ACCEPT_GUILD_JOB left the job in the stored offers and never checked
 * completedJobs, so accept -> complete -> accept -> complete paid again and
 * again, and completedJobs collected duplicate ids.
 *
 * Exercises: src/state/reducers/crimeReducer.ts (ACCEPT_GUILD_JOB,
 * COMPLETE_GUILD_JOB, SET_AVAILABLE_GUILD_JOBS)
 */
import { describe, expect, it } from 'vitest';
import { crimeReducer } from '../crimeReducer';
import { initialGameState } from '../../appState';
import type { GameState } from '../../../types';
import type { AppAction } from '../../actionTypes';

const job = {
  id: 'job_1', guildId: 'g', title: 'Lift a ledger', description: '', type: 'Heist', difficulty: 2,
  requiredRank: 1, targetLocationId: 'loc', rewardGold: 100, rewardReputation: 10,
} as never;

function apply(state: GameState, action: unknown): GameState {
  return { ...state, ...crimeReducer(state, action as AppAction) } as GameState;
}

function startState(): GameState {
  const base = { ...initialGameState, gold: 0 } as GameState;
  return apply(base, { type: 'SET_AVAILABLE_GUILD_JOBS', payload: { jobs: [job] } });
}

const accept = { type: 'ACCEPT_GUILD_JOB', payload: { job } };
const complete = { type: 'COMPLETE_GUILD_JOB', payload: { jobId: 'job_1', success: true, rewardGold: 100, rewardRep: 10 } };

describe('Thieves Guild jobs pay once (GG-480)', () => {
  it('removes an accepted job from the offers', () => {
    const s = apply(startState(), accept);
    expect(s.thievesGuild!.availableJobs.map((j) => j.id)).toEqual([]);
    expect(s.thievesGuild!.activeJobs.map((j) => j.id)).toEqual(['job_1']);
  });

  it('refuses to accept a job that is already active or completed', () => {
    let s = apply(startState(), accept);
    s = apply(s, accept);
    expect(s.thievesGuild!.activeJobs).toHaveLength(1);
    s = apply(s, complete);
    s = apply(s, accept);
    s = apply(s, complete);
    expect(s.gold).toBe(100);
    expect(s.thievesGuild!.completedJobs).toEqual(['job_1']);
  });

  it('never stores a completed job as an offer again', () => {
    let s = apply(apply(startState(), accept), complete);
    s = apply(s, { type: 'SET_AVAILABLE_GUILD_JOBS', payload: { jobs: [job] } });
    expect(s.thievesGuild!.availableJobs).toEqual([]);
  });
});
