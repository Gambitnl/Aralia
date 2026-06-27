/**
 * Proves the WF-AGENTSIM behaviour layer: needs decay, need-driven decisions
 * (sleep/eat/work/socialise), wealth economy, co-location social interaction, and
 * day-to-day variation (persisted needs change behaviour). Pure + deterministic.
 */
import { describe, it, expect } from 'vitest';
import { initAgentMinds, stepAgentSim, type AgentMind } from '../agentSim';
import type { Occupant } from '../types';

const worker = (id: number, over: Partial<Occupant> = {}): Occupant => ({
  id, name: `W${id}`, ageBand: 'adult', homePlotId: 10, workPlotId: 20, occupation: 'shopkeeper', ...over,
});

const ctx = { gatheringPlotIds: [20, 30] };
const step = (minds: AgentMind[], occ: Occupant[], hour: number, dt = 1) =>
  stepAgentSim(minds, occ, { hour, dtHours: dt, context: ctx });

describe('initAgentMinds', () => {
  it('seeds each occupant with deterministic in-range needs', () => {
    const a = initAgentMinds([worker(1), worker(2)]);
    const b = initAgentMinds([worker(1), worker(2)]);
    expect(a).toEqual(b); // deterministic
    for (const m of a) {
      for (const v of Object.values(m.needs)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    // Different occupants don't start identical (per-id jitter).
    expect(a[0].needs).not.toEqual(a[1].needs);
  });
});

describe('decisions are need-driven', () => {
  it('an exhausted agent chooses to sleep even at midday', () => {
    const occ = [worker(1)];
    const minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 5, satiety: 80, social: 80, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const out = step(minds, occ, 12);
    expect(out[0].activity).toBe('sleep');
    expect(out[0].targetPlotId).toBe(10); // home
    expect(out[0].needs.energy).toBeGreaterThan(5); // recovered while sleeping
  });

  it('a hungry (but rested) agent chooses to eat, spending wealth', () => {
    const occ = [worker(1)];
    const minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 90, satiety: 5, social: 80, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const out = step(minds, occ, 12);
    expect(out[0].activity).toBe('eat');
    expect(out[0].needs.satiety).toBeGreaterThan(5); // fed
    expect(out[0].needs.wealth).toBeLessThan(50);     // paid for the meal
  });

  it('a content worker works during shift hours and earns wealth', () => {
    const occ = [worker(1)];
    const minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 90, satiety: 90, social: 90, wealth: 40 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const out = step(minds, occ, 12);
    expect(out[0].activity).toBe('work');
    expect(out[0].targetPlotId).toBe(20); // work plot
    expect(out[0].needs.wealth).toBeGreaterThan(40); // wages
  });

  it('everyone sleeps in the dead of night regardless of other needs', () => {
    const occ = [worker(1)];
    const minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 90, satiety: 90, social: 10, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    expect(step(minds, occ, 2)[0].activity).toBe('sleep');
  });
});

describe('needs decay over time', () => {
  it('an idle agent gets hungrier and less social as the clock advances', () => {
    const occ = [worker(1, { workPlotId: undefined, occupation: 'resident' })];
    let minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 90, satiety: 90, social: 90, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const before = minds[0].needs;
    minds = step(minds, occ, 11); // late morning, stays home idle
    expect(minds[0].needs.satiety).toBeLessThan(before.satiety);
    expect(minds[0].needs.social).toBeLessThan(before.social);
  });

  it('does NOT drain energy or social while sleeping (only hunger creeps up)', () => {
    const occ = [worker(1)];
    const minds: AgentMind[] = [{ occupantId: 1, needs: { energy: 20, satiety: 80, social: 40, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const out = step(minds, occ, 12); // exhausted → sleeps even at midday
    expect(out[0].activity).toBe('sleep');
    expect(out[0].needs.energy).toBeGreaterThan(20); // recovered, not drained
    expect(out[0].needs.social).toBe(40);            // social held while asleep
    expect(out[0].needs.satiety).toBeLessThan(80);   // but hunger still grows
  });
});

describe('interactions: co-located socialisers boost each other', () => {
  it('two lonely agents at the same gathering plot recover MORE social than one alone', () => {
    const lonely = { energy: 90, satiety: 90, social: 5, wealth: 50 };
    // Two agents who both route to the same gathering plot (ids chosen so id%2 matches → plot 20).
    const together = step(
      [
        { occupantId: 2, needs: { ...lonely }, activity: 'home', targetPlotId: 10, socialized: false },
        { occupantId: 4, needs: { ...lonely }, activity: 'home', targetPlotId: 10, socialized: false },
      ],
      [worker(2, { workPlotId: undefined }), worker(4, { workPlotId: undefined })],
      14,
    );
    const togetherSocializers = together.filter((m) => m.activity === 'socialize');
    expect(togetherSocializers.length).toBeGreaterThanOrEqual(2);
    expect(togetherSocializers.every((m) => m.targetPlotId === 20)).toBe(true);
    expect(togetherSocializers.every((m) => m.socialized)).toBe(true);

    // Same agent socialising ALONE (single mind) does not get the interaction flag.
    const alone = step(
      [{ occupantId: 2, needs: { ...lonely }, activity: 'home', targetPlotId: 10, socialized: false }],
      [worker(2, { workPlotId: undefined })],
      14,
    );
    expect(alone[0].activity).toBe('socialize');
    expect(alone[0].socialized).toBe(false);
    // Together recovers strictly more social than alone.
    expect(togetherSocializers[0].needs.social).toBeGreaterThan(alone[0].needs.social);
  });
});

describe('family coordination (kin act together)', () => {
  it('a child trails an out-and-about parent to the same place', () => {
    const parent = worker(1, { workPlotId: undefined });
    const child = worker(2, { ageBand: 'child', workPlotId: undefined });
    const kin = new Map([[2, { parentId: 1 }]]);
    const ctxK = { gatheringPlotIds: [30, 40], kin };
    const minds: AgentMind[] = [
      { occupantId: 1, needs: { energy: 90, satiety: 90, social: 4, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }, // parent: lonely → socialise
      { occupantId: 2, needs: { energy: 90, satiety: 90, social: 90, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }, // child: content
    ];
    const out = stepAgentSim(minds, [parent, child], { hour: 14, dtHours: 1, context: ctxK });
    const p = out.find((m) => m.occupantId === 1)!;
    const c = out.find((m) => m.occupantId === 2)!;
    expect(p.activity).toBe('socialize');
    expect(c.activity).toBe('socialize');       // followed the parent out
    expect(c.targetPlotId).toBe(p.targetPlotId); // to the very same spot
  });

  it('spouses who both go out to socialise meet at one place', () => {
    // ids 2 and 5 route to DIFFERENT gathering plots by default (id % 2); the
    // coordination pass should unify them to the lower id's choice.
    const a = worker(2, { workPlotId: undefined });
    const b = worker(5, { workPlotId: undefined });
    const kin = new Map([[2, { spouseId: 5 }], [5, { spouseId: 2 }]]);
    const lonely = { energy: 90, satiety: 90, social: 4, wealth: 50 };
    const minds: AgentMind[] = [
      { occupantId: 2, needs: { ...lonely }, activity: 'home', targetPlotId: 10, socialized: false },
      { occupantId: 5, needs: { ...lonely }, activity: 'home', targetPlotId: 10, socialized: false },
    ];
    const out = stepAgentSim(minds, [a, b], { hour: 14, dtHours: 1, context: { gatheringPlotIds: [30, 40], kin } });
    const m2 = out.find((m) => m.occupantId === 2)!;
    const m5 = out.find((m) => m.occupantId === 5)!;
    expect(m2.activity).toBe('socialize');
    expect(m5.activity).toBe('socialize');
    expect(m2.targetPlotId).toBe(m5.targetPlotId); // met up at the same place
  });
});

describe('day-to-day variation (persisted needs change behaviour)', () => {
  it('an agent who ran its needs down behaves differently than a fresh one at the same hour', () => {
    const occ = [worker(1)];
    const fresh: AgentMind[] = [{ occupantId: 1, needs: { energy: 95, satiety: 95, social: 95, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    const worn: AgentMind[] = [{ occupantId: 1, needs: { energy: 18, satiety: 95, social: 95, wealth: 50 }, activity: 'home', targetPlotId: 10, socialized: false }];
    // Same hour (work time), opposite choices driven purely by carried-over state.
    expect(step(fresh, occ, 13)[0].activity).toBe('work');
    expect(step(worn, occ, 13)[0].activity).toBe('sleep');
  });

  it('a full multi-hour run stays deterministic and in-bounds', () => {
    const occ = [worker(1), worker(2, { workPlotId: undefined }), worker(3, { ageBand: 'child', workPlotId: undefined })];
    const run = () => {
      let minds = initAgentMinds(occ);
      for (let h = 0; h < 24; h++) minds = step(minds, occ, h);
      return minds;
    };
    const a = run();
    expect(run()).toEqual(a); // deterministic across a full day
    for (const m of a) for (const v of Object.values(m.needs)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('over a full week no SURVIVAL need collapses (recovery keeps the town alive)', () => {
    // Varied roster: an earner, a jobless adult, an elder, and a child. Run 7
    // days and prove (a) every need stays in [0,100] the whole time, and (b) no
    // survival need (energy/satiety/social) is pinned at 0 for a full day — the
    // sleep/eat/socialize loop must always pull an agent back. Wealth is exempt:
    // non-earners legitimately sit broke at 0 (no income; eating still works).
    const occ = [
      worker(1),
      worker(2, { workPlotId: undefined, occupation: 'resident' }),
      worker(3, { ageBand: 'elder', workPlotId: undefined, occupation: 'resident' }),
      worker(4, { ageBand: 'child', workPlotId: undefined, occupation: 'resident' }),
    ];
    const survival = ['energy', 'satiety', 'social'] as const;
    const zeroStreak: Record<string, number> = {};
    let minds = initAgentMinds(occ);
    for (let h = 0; h < 24 * 7; h++) {
      minds = step(minds, occ, h % 24);
      for (const m of minds) {
        for (const v of Object.values(m.needs)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        for (const k of survival) {
          const key = `${m.occupantId}:${k}`;
          zeroStreak[key] = m.needs[k] <= 0.001 ? (zeroStreak[key] ?? 0) + 1 : 0;
          expect(zeroStreak[key], `${key} stuck at 0 for a full day`).toBeLessThan(24);
        }
      }
    }
  });
});
