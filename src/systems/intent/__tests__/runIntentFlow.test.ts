/**
 * @file src/systems/intent/__tests__/runIntentFlow.test.ts
 *
 * Two jobs.
 *
 * First, it carries forward every hostile-opening route the retired
 * `runDeEscalationFlow` proved: a successful check clears the threat, a failed
 * one and an attack launch combat, and combat launches only with the mounted
 * WorldForge projection matching the threat's frozen source receipt. Missing or
 * rejected source data is forwarded WITHOUT a map so CombatView fails closed
 * instead of manufacturing procedural terrain.
 *
 * Second, it pins the new behavior: talk stays talk, and a peaceful scene can
 * turn violent.
 */
import { expect, it, vi } from 'vitest';
import { runIntentFlow, type CheckDiceRequest } from '../runIntentFlow';
import type { BattleMapData } from '../../../types/combat';

const CHARACTER = {
    level: 1, finalAbilityScores: { Dexterity: 16, Charisma: 8 },
    skills: [{ id: 'stealth', name: 'Stealth', ability: 'Dexterity' }],
    statusEffects: [],
} as any;

const THREAT = {
    hostile: true,
    enemies: [{ name: 'Bandit', quantity: 2, cr: '1/8' }],
    deEscalationDC: 12,
    tension: 't',
} as any;

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
const SOURCE_RECEIPT = {
    id: 'worldforge-opening-scene:1234',
    kind: 'opening-threat-scene' as const,
    policyVersion: 'opening-threat-scene-v1' as const,
    sourceOpeningReceiptId: OPENING_SOURCE.receiptId,
    worldSeed: 42,
    sourceCellId: 476,
    playerGroundMeters: { x: 100, z: 100 },
    approachDirection: { x: -1, z: 0 },
    entities: [1, 2].map((ordinal) => ({
        kind: 'worldforge-opening-threat' as const,
        sceneReceiptId: 'worldforge-opening-scene:1234',
        sourceOpeningReceiptId: OPENING_SOURCE.receiptId,
        entityId: `worldforge-opening-scene:1234:entity:${ordinal}`,
        monsterName: 'Bandit',
        monsterOrdinal: ordinal,
        socialRole: ordinal === 1 ? 'contact-lead' as const : 'screen-left' as const,
        worldGroundMeters: { x: 110, z: 100 + ordinal },
        sourcePatchTile: { x: 10, y: 9 + ordinal },
    })),
    ecologicalTraces: [],
};

const diceRoller = (d20: number, bonusValue = 0) =>
    vi.fn(async (_advantage: boolean, bonusDice: CheckDiceRequest[]) => ({
        d20,
        bonuses: bonusDice.map((b) => ({ source: b.source, value: bonusValue })),
    }));

/** A hostile scene: an authored threat plus the people who carry it. */
const hostileScene = {
    threat: THREAT,
    participants: [{ name: 'Rook Varn', role: 'a bandit' }],
    tension: 't',
};

/** A peaceful scene: no threat, ordinary townsfolk present. */
const peacefulScene = {
    threat: null,
    participants: [
        { name: 'Finnley Swiftfoot', role: 'a festival organizer' },
        { name: 'Mara Coldwell', role: 'a city guard' },
    ],
    tension: 'A festival argument.',
};

const skillIntent = (overrides: Record<string, unknown> = {}) => ({
    kind: 'skill' as const,
    skill: 'Stealth',
    ability: 'Dexterity' as const,
    dc: 12,
    stakes: 'moderate' as const,
    rationale: '',
    ...overrides,
});

// ---------------------------------------------------------------------------
// Carried forward from the retired hostile-opening flow
// ---------------------------------------------------------------------------

it('success avoids combat and resolves the opening', async () => {
    const dispatch = vi.fn();
    const startEncounter = vi.fn(async () => {});
    // 18 + Stealth mod(3+2=5) = 23 >= 12
    const result = await runIntentFlow({
        intent: skillIntent(), character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(18), startEncounter, ...hostileScene,
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
    expect(startEncounter).not.toHaveBeenCalled();
    expect(result.outcome).toBe('check');
    expect(result.success).toBe(true);
});

it('a check reports its mechanical outcome', async () => {
    const result = await runIntentFlow({
        intent: skillIntent(), character: CHARACTER, dispatch: vi.fn(),
        rollCheckDice: diceRoller(18), startEncounter: vi.fn(async () => {}), ...hostileScene,
    });
    expect(result.note).toBe('Stealth check: 18 + 5 = 23 vs DC 12 — success.');
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
    const result = await runIntentFlow({
        intent: skillIntent(), character: guided, dispatch, rollCheckDice, startEncounter, ...hostileScene,
    });
    expect(rollCheckDice).toHaveBeenCalledWith(false, [{ source: 'Guidance', notation: '1d4' }]);
    expect(startEncounter).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
    expect(result.note).toBe('Stealth check: 6 + 5 + 3 (Guidance) = 14 vs DC 12 — success.');
});

it('failure starts combat with the threat monsters and still clears the threat', async () => {
    const dispatch = vi.fn();
    const startEncounter = vi.fn(async () => {});
    await runIntentFlow({
        intent: skillIntent(), character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(1), startEncounter, ...hostileScene,
    });
    expect(startEncounter).toHaveBeenCalledWith(dispatch, {
        monsters: [{ name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' }],
    });
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
        receipt: SOURCE_RECEIPT,
    }));

    await runIntentFlow({
        intent: skillIntent(), character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(1), startEncounter, prepareOpeningEncounter,
        threat: SOURCE_THREAT, participants: hostileScene.participants, tension: 't',
    });

    expect(prepareOpeningEncounter).toHaveBeenCalledWith({
        source: OPENING_SOURCE,
        enemies: SOURCE_THREAT.enemies,
    });
    expect(dispatch).toHaveBeenCalledWith({
        type: 'RECORD_WORLDFORGE_ENCOUNTER',
        payload: { receipt: SOURCE_RECEIPT },
    });
    expect(startEncounter).toHaveBeenCalledWith(dispatch, {
        monsters: [expect.objectContaining({ name: 'Bandit', quantity: 2, cr: '1/8' })],
        extractedBattleMap: SOURCE_MAP,
        combatantWorldSources: SOURCE_RECEIPT.entities.map(({ sourcePatchTile: _tile, ...source }) => source),
    });
});

it('attack intent goes straight to combat, no roll, and clears the threat', async () => {
    const dispatch = vi.fn();
    const startEncounter = vi.fn(async () => {});
    const rollCheckDice = diceRoller(20);
    await runIntentFlow({
        intent: { kind: 'attack' }, character: CHARACTER, dispatch,
        rollCheckDice, startEncounter, ...hostileScene,
    });
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

    await runIntentFlow({
        intent: { kind: 'attack' }, character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(20), startEncounter, prepareOpeningEncounter,
        threat: SOURCE_THREAT, participants: hostileScene.participants, tension: 't',
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
    await runIntentFlow({
        intent: { kind: 'attack' }, character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(1), startEncounter, ...hostileScene,
    });
    expect(order.indexOf('startEncounter')).toBeLessThan(order.indexOf('SKIP_OPENING_SITUATION'));
});

// ---------------------------------------------------------------------------
// New behavior
// ---------------------------------------------------------------------------

it('talk rolls nothing, starts nothing, and reports no note', async () => {
    const dispatch = vi.fn();
    const rollCheckDice = diceRoller(1);
    const startEncounter = vi.fn(async () => {});
    const result = await runIntentFlow({
        intent: { kind: 'talk' }, character: CHARACTER, dispatch,
        rollCheckDice, startEncounter, ...peacefulScene,
    });
    expect(result).toEqual({ outcome: 'talk', note: '' });
    expect(rollCheckDice).not.toHaveBeenCalled();
    expect(startEncounter).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
});

it('a peaceful check uses the DC the reader proposed, not an authored one', async () => {
    const result = await runIntentFlow({
        intent: skillIntent({ skill: 'Stealth', dc: 20 }), character: CHARACTER,
        dispatch: vi.fn(), rollCheckDice: diceRoller(10),
        startEncounter: vi.fn(async () => {}), ...peacefulScene,
    });
    // 10 + 5 = 15 against the proposed 20.
    expect(result.note).toBe('Stealth check: 10 + 5 = 15 vs DC 20 — failure.');
    expect(result.success).toBe(false);
});

it('attacking in a peaceful scene builds a real bestiary roster from the people present', async () => {
    const dispatch = vi.fn();
    const startEncounter = vi.fn(async () => {});
    const result = await runIntentFlow({
        intent: { kind: 'attack' }, character: CHARACTER, dispatch,
        rollCheckDice: diceRoller(1), startEncounter, ...peacefulScene,
    });
    expect(result.outcome).toBe('combat');
    // The organizer is a Commoner, the guard is a Guard. Neither is spawned
    // under a person's name, which would miss the bestiary and stub the enemy.
    expect(startEncounter).toHaveBeenCalledWith(dispatch, {
        monsters: [
            expect.objectContaining({ name: 'Commoner', quantity: 1 }),
            expect.objectContaining({ name: 'Guard', quantity: 1 }),
        ],
    });
    // No opening threat existed, so none is cleared.
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'SKIP_OPENING_SITUATION' });
});

it('a hard failure on a serious provocative attempt turns a peaceful scene violent', async () => {
    const dispatch = vi.fn();
    const startEncounter = vi.fn(async () => {});
    const result = await runIntentFlow({
        intent: skillIntent({ skill: 'Stealth', dc: 20, stakes: 'serious' }),
        character: CHARACTER, dispatch, rollCheckDice: diceRoller(3),
        startEncounter, ...peacefulScene,
    });
    // 3 + 5 = 8 vs 20 is a 12-point miss.
    expect(result.outcome).toBe('combat');
    expect(result.note).toContain('the mood turns');
    expect(startEncounter).toHaveBeenCalled();
});

it('a near miss on the same attempt leaves the scene peaceful', async () => {
    const startEncounter = vi.fn(async () => {});
    const result = await runIntentFlow({
        intent: skillIntent({ skill: 'Stealth', dc: 20, stakes: 'serious' }),
        character: CHARACTER, dispatch: vi.fn(), rollCheckDice: diceRoller(12),
        startEncounter, ...peacefulScene,
    });
    // 12 + 5 = 17 vs 20 is a 3-point miss — recoverable.
    expect(result.outcome).toBe('check');
    expect(startEncounter).not.toHaveBeenCalled();
});

it('a failed non-provocative attempt never starts a fight, however badly it misses', async () => {
    const startEncounter = vi.fn(async () => {});
    const result = await runIntentFlow({
        intent: skillIntent({ skill: 'Acrobatics', ability: 'Dexterity', dc: 25, stakes: 'serious' }),
        character: CHARACTER, dispatch: vi.fn(), rollCheckDice: diceRoller(1),
        startEncounter, ...peacefulScene,
    });
    expect(result.outcome).toBe('check');
    expect(startEncounter).not.toHaveBeenCalled();
});

it('attacking with nobody present is an honest error, not an empty battle', async () => {
    await expect(runIntentFlow({
        intent: { kind: 'attack' }, character: CHARACTER, dispatch: vi.fn(),
        rollCheckDice: diceRoller(1), startEncounter: vi.fn(async () => {}),
        threat: null, participants: [], tension: '',
    })).rejects.toThrow('nobody here to fight');
});
