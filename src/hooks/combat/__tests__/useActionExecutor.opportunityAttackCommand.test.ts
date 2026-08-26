import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import type {
    Ability,
    BattleMapData,
    BattleMapTile,
    CombatAction,
    CombatCharacter,
    TurnState,
} from '../../../types/combat';
import {
    mockCharacter,
    mockTurnState,
    mockOnCharacterUpdate,
    mockOnLogEntry,
    mockConsumeAction,
    mockProcessTileEffects,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

/**
 * This file proves the opportunity attack applies the SAME rules as any other
 * attack, because it is the same attack: `handleOpportunityAttacks` builds a
 * WeaponAttackCommand and runs it through CommandExecutor (agora-f821.41,
 * Remy ruling q6 — the command lane owns the attack roll).
 *
 * The old inline roll applied advantage, disadvantage and a finesse rule and
 * nothing else. Each case below names one rule it could not reach:
 *   cover           — calculateCover raises the target's AC.
 *   high ground     — the G14 five-foot elevation band grants Advantage.
 *   attack riders   — an active Hunter's Mark rider adds its damage.
 *   crit threshold  — a Champion's 19 is a critical on an opportunity attack.
 *
 * Every case pins its dice through `opportunityAttackDecisions`, which is the
 * supported pinning seam: an unpinned roll comes off the audited seeded roller
 * (agora-f821.4) and cannot be steered by a Math.random spy.
 *
 * Called by: the focused combat-hook Vitest gate.
 * Depends on: useActionExecutor and the shared mounted hook fixtures.
 */

const DAGGER: Ability = {
    id: 'command-dagger',
    name: 'Command Dagger',
    description: 'A plain melee weapon used to open a command-owned attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    weapon: {
        id: 'command-dagger-item',
        name: 'Command Dagger',
        description: 'A plain dagger.',
        type: 'weapon',
        properties: [],
    } as unknown as Ability['weapon'],
    range: 1,
    effects: [{ type: 'damage', value: 0, dice: '1d6', damageType: 'slashing' }],
};

/** A reach weapon, so a square can stand between the attacker and the target. */
const REACH_SPEAR: Ability = {
    ...DAGGER,
    id: 'command-spear',
    name: 'Command Spear',
    description: 'A reach weapon used to prove cover between two squares.',
    range: 2,
};

const tileAt = (x: number, y: number, overrides: Partial<BattleMapTile> = {}): BattleMapTile => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: 'none',
    effects: [],
    ...overrides,
} as BattleMapTile);

/** A three-square column: the attacker at y=0, the mover at y=1 leaving to y=2. */
const mapWith = (overrides: Record<string, Partial<BattleMapTile>> = {}): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();
    for (let y = 0; y <= 3; y += 1) {
        tiles.set(`0-${y}`, tileAt(0, y, overrides[`0-${y}`] ?? {}));
    }
    return {
        dimensions: { width: 1, height: 4 },
        tiles,
        theme: 'grass',
        seed: 1,
    } as unknown as BattleMapData;
};

const turnFor = (characterId: string, overrides: Partial<TurnState> = {}): TurnState => ({
    ...mockTurnState,
    currentCharacterId: characterId,
    ...overrides,
});

const mover = (id: string, currentHP = 40): CombatCharacter => ({
    ...mockCharacter,
    id,
    name: id,
    team: 'enemy',
    position: { x: 0, y: 1 },
    currentHP,
    maxHP: 40,
});

const responder = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
    ...mockCharacter,
    id: 'responder',
    name: 'Responder',
    team: 'player',
    position: { x: 0, y: 0 },
    abilities: [DAGGER],
    ...overrides,
});

const leaveReach = (
    moverId: string,
    responderId: string,
    attackRoll: number,
    damageRoll = 4,
): CombatAction => ({
    id: `leave-reach-${moverId}-${attackRoll}`,
    characterId: moverId,
    type: 'move',
    targetPosition: { x: 0, y: 2 },
    cost: { type: 'movement-only', movementCost: 5 },
    timestamp: Date.now(),
    opportunityAttackDecisions: {
        [responderId]: { decision: 'accept', abilityId: DAGGER.id, attackRoll, damageRoll },
    },
});

const messages = (): string[] =>
    mockOnLogEntry.mock.calls.map(call => (call[0] as { message: string }).message);

const lastPublished = (id: string): CombatCharacter | undefined => {
    const updates = mockOnCharacterUpdate.mock.calls
        .map(call => call[0] as CombatCharacter)
        .filter(character => character.id === id);
    return updates[updates.length - 1];
};

describe('opportunity attacks run through WeaponAttackCommand', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
        mockProcessTileEffects.mockImplementation((character: CombatCharacter) => character);
    });

    it('applies cover to the target armour class', async () => {
        // Cover needs a square BETWEEN the two combatants, so this case uses a
        // reach weapon: the responder stands at y=0, the mover at y=2, and a
        // pillar occupies y=1.
        const walker = { ...mover('covered-walker'), position: { x: 0, y: 2 } };
        const guard = responder({ abilities: [REACH_SPEAR] });
        mockConsumeAction.mockReturnValue(walker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [walker, guard],
            turnState: turnFor(walker.id),
            mapData: mapWith({ '0-1': { providesCover: true, decoration: 'pillar' } }),
        }));

        // Fixture armour class is 10 and the responder's modifier is +3, so a
        // pinned 8 totals 11: it beats a bare AC 10 and loses to the AC 15 a
        // pillar's three-quarters cover produces.
        await result.current.executeAction({
            id: 'covered-leave-reach',
            characterId: walker.id,
            type: 'move',
            targetPosition: { x: 0, y: 3 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: Date.now(),
            opportunityAttackDecisions: {
                [guard.id]: {
                    decision: 'accept',
                    abilityId: REACH_SPEAR.id,
                    attackRoll: 8,
                    damageRoll: 4,
                },
            },
        });

        expect(messages().some(message => message.includes('(Cover +5)'))).toBe(true);
        expect(messages().some(message => message.includes('vs AC 15'))).toBe(true);
        expect(messages().some(message => message.includes('misses'))).toBe(true);
    });

    it('applies the G14 high-ground rule to a melee opportunity attack', async () => {
        // One elevation unit is 0.3 m, so six units clear the five-foot band the
        // rule needs. The responder presses downhill and rolls with Advantage.
        const walker = mover('downhill-walker');
        const guard = responder();
        mockConsumeAction.mockReturnValue(walker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [walker, guard],
            turnState: turnFor(walker.id),
            mapData: mapWith({ '0-0': { elevation: 6 } }),
        }));

        await result.current.executeAction(leaveReach(walker.id, guard.id, 15));

        expect(messages().some(message => message.includes('with Advantage'))).toBe(true);
    });

    it('adds an active attack rider to the opportunity attack damage', async () => {
        // Hunter's Mark is registered on the attacker as an AttackRiderSystem
        // rider. No file under src/hooks ever read that list, so the old inline
        // opportunity attack added nothing for it.
        const walker = mover('marked-walker');
        const guard = responder({
            riders: [{
                id: 'hunters-mark-rider',
                spellId: 'hunters-mark',
                casterId: 'responder',
                sourceName: "Hunter's Mark",
                targetId: 'marked-walker',
                effect: {
                    type: 'DAMAGE',
                    trigger: { type: 'immediate' },
                    condition: { type: 'hit' },
                    damage: { dice: '1d6', type: 'force' },
                },
                consumption: 'unlimited',
                attackFilter: { weaponType: 'any', attackType: 'any' },
                usedThisTurn: false,
                duration: { type: 'minutes', value: 60 },
            }],
        } as Partial<CombatCharacter>);
        mockConsumeAction.mockReturnValue(walker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [walker, guard],
            turnState: turnFor(walker.id),
            mapData: mapWith(),
        }));

        await result.current.executeAction(leaveReach(walker.id, guard.id, 19));

        // The pinned weapon die deals 4. Anything beyond that is the rider.
        const struck = lastPublished(walker.id);
        expect(struck).toBeDefined();
        expect(40 - (struck?.currentHP ?? 40)).toBeGreaterThan(4);
        expect(messages().some(message => message.includes("Hunter's Mark"))).toBe(true);
    });

    it("honours the attacker's critical threshold", async () => {
        // A Champion crits on 19. The old inline opportunity attack fixed the
        // critical at a natural 20 and could not express this at all.
        const walker = mover('champion-target');
        const champion = responder({ id: 'champion', name: 'Champion', critThreshold: 19 });
        mockConsumeAction.mockReturnValue(walker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [walker, champion],
            turnState: turnFor(walker.id),
            mapData: mapWith(),
        }));

        await result.current.executeAction(leaveReach(walker.id, champion.id, 19));

        expect(messages().some(message => message.includes('CRITICAL HIT!'))).toBe(true);
        // A critical doubles the die count, and both pinned dice show 4.
        expect(lastPublished(walker.id)?.currentHP).toBe(32);
    });

    it('leaves a non-Champion opportunity attack uncritical on the same roll', async () => {
        const walker = mover('ordinary-target');
        const guard = responder();
        mockConsumeAction.mockReturnValue(walker);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [walker, guard],
            turnState: turnFor(walker.id),
            mapData: mapWith(),
        }));

        await result.current.executeAction(leaveReach(walker.id, guard.id, 19));

        expect(messages().some(message => message.includes('CRITICAL HIT!'))).toBe(false);
        expect(lastPublished(walker.id)?.currentHP).toBe(36);
    });
});
