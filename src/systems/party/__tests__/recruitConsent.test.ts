/**
 * Unit tests for the disposition-gated recruit consent verdict (P5).
 *
 * Validates that evaluateRecruitOffer:
 *   - auto-accepts when opts.autoAccept is set (rescue short-circuit).
 *   - gates an already-met companion on relationship LEVEL (friend+ joins).
 *   - declines an active party member ("already with you").
 *   - gates a first-time recruit on NPC disposition (>= threshold joins).
 *   - never mutates the inputs and always returns a human-readable reason.
 *
 * Runs on: vitest.
 * Depends on: recruitConsent (pure module) + RelationshipManager thresholds.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRecruitOffer,
  DISPOSITION_JOIN_THRESHOLD,
  DISPOSITION_HIRE_THRESHOLD,
  RELATIONSHIP_JOIN_THRESHOLD,
  LEVEL_WEIGHT,
} from '../recruitConsent';

// Minimal stand-ins. The module only reads npc.id/name and
// state.companions / state.npcMemory, so we avoid full fixtures and cast.
const makeNpc = (id: string, name = 'Test NPC') => ({ id, name }) as any;

const makeState = (over: { companions?: any; npcMemory?: any } = {}) =>
  ({
    companions: over.companions ?? {},
    npcMemory: over.npcMemory ?? {},
  }) as any;

// Build a companion record with a player relationship at a given approval.
const makeCompanion = (id: string, approval: number, inParty = false) =>
  ({
    id,
    inParty,
    relationships: {
      player: { targetId: 'player', level: 'stranger', approval, history: [], unlocks: [] },
    },
  }) as any;

describe('evaluateRecruitOffer', () => {
  describe('autoAccept short-circuit (rescue)', () => {
    it('always joins regardless of disposition or relationship', () => {
      const npc = makeNpc('rescuee', 'Mira');
      // Hostile disposition that would otherwise decline.
      const state = makeState({ npcMemory: { rescuee: { disposition: -100 } } });
      const v = evaluateRecruitOffer(npc, state, { autoAccept: true });
      expect(v.willJoin).toBe(true);
      expect(v.reason).toMatch(/Mira/);
    });
  });

  describe('already-met companion (relationship-level gate)', () => {
    it('joins when relationship is at the friend threshold', () => {
      const npc = makeNpc('kaelen', 'Kaelen');
      // 200 approval == 'friend'.
      const state = makeState({ companions: { kaelen: makeCompanion('kaelen', 200) } });
      const v = evaluateRecruitOffer(npc, state);
      expect(v.willJoin).toBe(true);
      expect(v.reason).toMatch(/Kaelen/);
    });

    it('joins when relationship is above the threshold (devoted)', () => {
      const npc = makeNpc('elara', 'Elara');
      const state = makeState({ companions: { elara: makeCompanion('elara', 450) } });
      expect(evaluateRecruitOffer(npc, state).willJoin).toBe(true);
    });

    it('declines when relationship is below the threshold (acquaintance)', () => {
      const npc = makeNpc('kaelen', 'Kaelen');
      // 150 approval == 'acquaintance', below 'friend'.
      const state = makeState({ companions: { kaelen: makeCompanion('kaelen', 150) } });
      const v = evaluateRecruitOffer(npc, state);
      expect(v.willJoin).toBe(false);
      // Surfaces how much approval is still needed to reach friend (200).
      expect(v.requiresApproval).toBe(50);
    });

    it('declines an NPC who is already an active party member', () => {
      const npc = makeNpc('kaelen', 'Kaelen');
      const state = makeState({ companions: { kaelen: makeCompanion('kaelen', 400, true) } });
      const v = evaluateRecruitOffer(npc, state);
      expect(v.willJoin).toBe(false);
      expect(v.reason).toMatch(/already/i);
    });
  });

  describe('first-time recruit (disposition gate)', () => {
    it('joins when disposition is at the threshold', () => {
      const npc = makeNpc('stranger', 'Bren');
      const state = makeState({
        npcMemory: { stranger: { disposition: DISPOSITION_JOIN_THRESHOLD } },
      });
      expect(evaluateRecruitOffer(npc, state).willJoin).toBe(true);
    });

    it('joins when disposition is well above the threshold', () => {
      const npc = makeNpc('stranger', 'Bren');
      const state = makeState({ npcMemory: { stranger: { disposition: 90 } } });
      expect(evaluateRecruitOffer(npc, state).willJoin).toBe(true);
    });

    it('declines when disposition is below the threshold', () => {
      const npc = makeNpc('stranger', 'Bren');
      const state = makeState({ npcMemory: { stranger: { disposition: 20 } } });
      const v = evaluateRecruitOffer(npc, state);
      expect(v.willJoin).toBe(false);
      expect(v.reason).toMatch(/Bren/);
    });

    it('declines a never-met NPC (no memory record → neutral 0)', () => {
      const npc = makeNpc('ghost', 'Vex');
      const state = makeState();
      expect(evaluateRecruitOffer(npc, state).willJoin).toBe(false);
    });

    it('REFUSES a neutral stranger at the default disposition of 50 (2026-07-04 tuning)', () => {
      // Live-play regression: an NpcMemory record defaults to disposition 50,
      // so a complete stranger auto-joined for free. 50 must now decline.
      const npc = makeNpc('stranger', 'Bren');
      const state = makeState({ npcMemory: { stranger: { disposition: 50 } } });
      const v = evaluateRecruitOffer(npc, state);
      expect(v.willJoin).toBe(false);
      expect(v.reason).toMatch(/Bren/);
    });

    it('accepts a warmed-up acquaintance at disposition 70 (above earned threshold)', () => {
      const npc = makeNpc('stranger', 'Bren');
      const state = makeState({ npcMemory: { stranger: { disposition: 70 } } });
      expect(evaluateRecruitOffer(npc, state).willJoin).toBe(true);
    });
  });

  describe('paid hire (tavern surface, opts.hire)', () => {
    it('accepts a neutral stranger (disposition 50) when the player is paying', () => {
      const npc = makeNpc('barkeep', 'Tam');
      const state = makeState({ npcMemory: { barkeep: { disposition: DISPOSITION_HIRE_THRESHOLD } } });
      const v = evaluateRecruitOffer(npc, state, { hire: true });
      expect(v.willJoin).toBe(true);
      expect(v.reason).toMatch(/coin/i);
    });

    it('still refuses a hire from an NPC who dislikes you', () => {
      const npc = makeNpc('barkeep', 'Tam');
      const state = makeState({ npcMemory: { barkeep: { disposition: 20 } } });
      expect(evaluateRecruitOffer(npc, state, { hire: true }).willJoin).toBe(false);
    });

    it('free-join threshold is strictly above the hire threshold and the neutral default', () => {
      expect(DISPOSITION_JOIN_THRESHOLD).toBeGreaterThan(DISPOSITION_HIRE_THRESHOLD);
      expect(DISPOSITION_JOIN_THRESHOLD).toBeGreaterThan(50);
    });
  });

  describe('purity + invariants', () => {
    it('does not mutate the npc or state', () => {
      const npc = makeNpc('kaelen', 'Kaelen');
      const companions = { kaelen: makeCompanion('kaelen', 200) };
      const state = makeState({ companions });
      const npcSnap = JSON.stringify(npc);
      const stateSnap = JSON.stringify(state);
      evaluateRecruitOffer(npc, state);
      expect(JSON.stringify(npc)).toBe(npcSnap);
      expect(JSON.stringify(state)).toBe(stateSnap);
    });

    it('always returns a non-empty reason string', () => {
      const cases: Array<ReturnType<typeof evaluateRecruitOffer>> = [
        evaluateRecruitOffer(makeNpc('a'), makeState(), { autoAccept: true }),
        evaluateRecruitOffer(makeNpc('b'), makeState({ companions: { b: makeCompanion('b', 200) } })),
        evaluateRecruitOffer(makeNpc('c'), makeState({ npcMemory: { c: { disposition: 0 } } })),
      ];
      for (const v of cases) {
        expect(typeof v.reason).toBe('string');
        expect(v.reason.length).toBeGreaterThan(0);
      }
    });

    it('threshold level weight ordering is internally consistent', () => {
      // The friend threshold must outrank acquaintance and be below devoted.
      expect(LEVEL_WEIGHT[RELATIONSHIP_JOIN_THRESHOLD]).toBeGreaterThan(LEVEL_WEIGHT.acquaintance);
      expect(LEVEL_WEIGHT[RELATIONSHIP_JOIN_THRESHOLD]).toBeLessThan(LEVEL_WEIGHT.devoted);
    });
  });
});
