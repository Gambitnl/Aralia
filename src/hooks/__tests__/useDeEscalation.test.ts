/**
 * These tests prove every hostile-opening resolution route: successful checks
 * clear the threat, while attacks and failed checks launch combat only with the
 * mounted WorldForge projection matching the threat's frozen source receipt.
 * Missing or rejected source data is deliberately forwarded without a map so
 * CombatView can fail closed instead of manufacturing procedural terrain.
 */
import { describe, expect, it, vi } from 'vitest';
import { runDeEscalationFlow, type CheckDiceRequest } from '../useDeEscalation';
import type { BattleMapData } from '../../types/combat';

const CHARACTER = {
  level: 1, finalAbilityScores: { Dexterity: 16, Charisma: 8 },
  skills: [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }],
  statusEffects: [],
} as any;

const THREAT = { hostile: true, enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }], deEscalationDC: 12, tension: 't' } as any;

const OPENING_SOURCE = {
  kind: 'worldforge-opening-location' as const,
  receiptId: 'opening:42:cell:476',
  worldSeed: 42,
  cellId: 476,
  locationLabel: 'Legium',
};

const SOURCE_THREAT = { ...THREAT, battlefieldSource: OPENING_SOURCE };
const SOURCE_MAP = {
  dimensions: { width: 1, height: 1 },
  tiles: new Map(),
  theme: 'forest',
  seed: 42,
  provenance: {
    kind: 'worldforge',
    worldSeed: 42,
    anchorCellId: 476,
    anchorWorldMeters: { x: 100, z: 100 },
    generationPath: ['WorldForge', 'GroundWorld', 'Tactical crop'],
  },
} as BattleMapData;

const diceRoller = (d20: number, bonusValue = 0) =>
  vi.fn(async (_advantage: boolean, bonusDice: CheckDiceRequest[]) => ({
    d20,
    bonuses: bonusDice.map((b) => ({ source: b.source, value: bonusValue })),
  }));

it('success avoids combat and resolves the opening', async () => {
  const dispatch = vi.fn();
  const rollCheckDice = diceRoller(18); // 18 + Stealth mod(3+2=5) = 23 >= 12
  const startEncounter = vi.fn(async () => {});
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER, threat: THREAT, dispatch, rollCheckDice, startEncounter,
  });
  expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
  expect(startEncounter).not.toHaveBeenCalled();
});

it('a check surfaces its mechanical outcome in the conversation', async () => {
  const dispatch = vi.fn();
  const rollCheckDice = diceRoller(18);
  const startEncounter = vi.fn(async () => {});
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER, threat: THREAT, dispatch, rollCheckDice, startEncounter,
  });
  const msg = dispatch.mock.calls.find(([a]) => a.type === 'ADD_CONVERSATION_MESSAGE')?.[0];
  expect(msg).toBeDefined();
  expect(msg.payload.speakerId).toBe('narrator');
  expect(msg.payload.text).toBe('Stealth check: 18 + 5 = 23 vs DC 12 — success.');
});

it('rolls active bonus dice (Guidance) and folds them into the total and message', async () => {
  const dispatch = vi.fn();
  const startEncounter = vi.fn(async () => {});
  // d20 6 + mod 5 = 11 < DC 12 alone — the Guidance 1d4 rolling a 3 turns it.
  const rollCheckDice = diceRoller(6, 3);
  const guided = {
    ...CHARACTER,
    statusEffects: [{
      id: 'se1', name: 'Guidance (Stealth)', type: 'buff', duration: 10, source: 'Guidance',
      modifiers: { skill: 'Stealth' },
      abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4', skillSelection: 'chosen_skill' },
    }],
  };
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: guided, threat: THREAT, dispatch, rollCheckDice, startEncounter,
  });
  // The roller was asked for the Guidance die…
  expect(rollCheckDice).toHaveBeenCalledWith(false, [{ source: 'Guidance', notation: '1d4' }]);
  // …and its 3 makes the check pass.
  expect(startEncounter).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
  const msg = dispatch.mock.calls.find(([a]) => a.type === 'ADD_CONVERSATION_MESSAGE')?.[0];
  expect(msg.payload.text).toBe('Stealth check: 6 + 5 + 3 (Guidance) = 14 vs DC 12 — success.');
});

it('failure starts combat with the threat monsters and still clears the threat', async () => {
  const dispatch = vi.fn();
  const startEncounter = vi.fn(async () => {});
  const rollCheckDice = diceRoller(1); // 1 + 5 = 6 < 12
  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER, threat: THREAT, dispatch, rollCheckDice, startEncounter,
  });
  expect(startEncounter).toHaveBeenCalledWith(dispatch, { monsters: [{ name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' }] });
  // The standoff is resolved by the fight; leaving the threat active let the
  // conversation re-trigger the SAME battle afterwards (live-verified loop).
  expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
});

it('failed de-escalation carries the validated live WorldForge map into combat', async () => {
  const dispatch = vi.fn();
  const startEncounter = vi.fn(async () => {});
  const prepareOpeningEncounter = vi.fn(async () => ({
    status: 'ready' as const,
    detail: 'Opening location validated.',
    mapData: SOURCE_MAP,
  }));

  await runDeEscalationFlow({
    intent: { kind: 'skill', skill: 'Stealth', ability: 'Dexterity', rationale: '' },
    character: CHARACTER,
    threat: SOURCE_THREAT,
    dispatch,
    rollCheckDice: diceRoller(1),
    startEncounter,
    prepareOpeningEncounter,
  });

  expect(prepareOpeningEncounter).toHaveBeenCalledWith({ source: OPENING_SOURCE });
  expect(startEncounter).toHaveBeenCalledWith(dispatch, {
    monsters: [expect.objectContaining({ name: 'Bandit', quantity: 2, cr: '1/8' })],
    extractedBattleMap: SOURCE_MAP,
  });
});

it('attack intent goes straight to combat, no roll, and clears the threat', async () => {
  const dispatch = vi.fn();
  const startEncounter = vi.fn(async () => {});
  const rollCheckDice = diceRoller(20);
  await runDeEscalationFlow({ intent: { kind: 'attack' }, character: CHARACTER, threat: THREAT, dispatch, rollCheckDice, startEncounter });
  expect(rollCheckDice).not.toHaveBeenCalled();
  expect(startEncounter).toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
});

it('attack preserves fail-closed behavior when the mounted world rejects the receipt', async () => {
  const dispatch = vi.fn();
  const startEncounter = vi.fn(async () => {});
  const prepareOpeningEncounter = vi.fn(async () => ({
    status: 'source-gap' as const,
    detail: 'The mounted cell does not match.',
  }));

  await runDeEscalationFlow({
    intent: { kind: 'attack' },
    character: CHARACTER,
    threat: SOURCE_THREAT,
    dispatch,
    rollCheckDice: diceRoller(20),
    startEncounter,
    prepareOpeningEncounter,
  });

  // No extracted map means the global CombatView boundary displays a source
  // gap. The old procedural arena cannot enter through this refusal path.
  expect(startEncounter).toHaveBeenCalledWith(dispatch, {
    monsters: [expect.objectContaining({ name: 'Bandit', quantity: 2, cr: '1/8' })],
  });
});

it('clears the threat only after the encounter has launched', async () => {
  const order: string[] = [];
  const dispatch = vi.fn((a) => order.push(a.type));
  const startEncounter = vi.fn(async () => { order.push('startEncounter'); });
  await runDeEscalationFlow({ intent: { kind: 'attack' }, character: CHARACTER, threat: THREAT, dispatch, rollCheckDice: diceRoller(1), startEncounter });
  expect(order.indexOf('startEncounter')).toBeLessThan(order.indexOf('SKIP_OPENING_SITUATION'));
});
