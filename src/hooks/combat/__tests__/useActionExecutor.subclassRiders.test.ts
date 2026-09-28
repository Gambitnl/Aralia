import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import type { Ability, CombatAction, CombatCharacter, TurnState } from '../../../types/combat';
import { HUNTER_PREY_FEATURE_ID, HUNTER_PREY_TURN_USAGE_KEY } from '../../../utils/combat/hunterUtils';
import { bindPrimalBeast, PRIMAL_COMPANION_FEATURE_ID } from '../../../utils/combat/beastMasterUtils';
import { CUNNING_ACTION_FEATURE_ID } from '../../../utils/combat/thiefUtils';
import { ASSASSINATE_FEATURE_ID } from '../../../utils/combat/assassinUtils';
import {
    CUNNING_ACTION_ABILITY_PREFIX,
    PRIMAL_COMPANION_COMMAND_ABILITY_ID,
} from '../../../utils/combat';
import {
    mockCharacter,
    mockTurnState,
    mockOnCharacterUpdate,
    mockOnLogEntry,
    mockHandleDamage,
    mockConsumeAction,
    mockProcessTileEffects,
    mockEndTurn,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

/**
 * Proves the four subclass rider modules fire through the mounted action
 * executor rather than only in their own unit tests (agora-db71.14).
 *
 * One case per subclass:
 *   Hunter       — Colossus Slayer adds its die to a hook-owned attack.
 *   Assassin     — Assassinate turns a hit on a surprised creature critical.
 *   Thief        — a Cunning Action option spends the bonus action.
 *   Beast Master — the companion command spends the bonus action, and ending
 *                  the ranger's turn clears the per-turn command tally.
 *
 * Every attack case pins its dice through `opportunityAttackDecisions`, so the
 * only unpinned roll is the rider's own die.
 *
 * The two attack riders live inside `WeaponAttackCommand` (agora-f821.41), which
 * is the one attack-roll implementation the opportunity attack now runs through.
 * Their damage therefore lands through `DamageCommand` inside the command
 * transaction and never reaches the engine's `handleDamage` prop, so each case
 * reads the damage off the mover the movement publishes.
 */

const MELEE_WEAPON: Ability = {
    id: 'rider-blade',
    name: 'Rider Blade',
    description: 'A melee weapon used to open a hook-owned attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    weapon: {
        id: 'rider-blade-item',
        name: 'Rider Blade',
        description: 'A plain blade.',
        type: 'weapon',
        properties: [],
    } as unknown as Ability['weapon'],
    range: 1,
    effects: [{ type: 'damage', value: 0, dice: '1d6', damageType: 'slashing' }],
};

const featureAbility = (id: string, cost: Ability['cost'] = { type: 'free' }): Ability => ({
    id,
    name: id,
    description: id,
    type: 'utility',
    cost,
    targeting: 'self',
    range: 0,
    effects: [],
});

const turnFor = (characterId: string, overrides: Partial<TurnState> = {}): TurnState => ({
    ...mockTurnState,
    currentCharacterId: characterId,
    ...overrides,
});

/** A mover that will walk out of the attacker's reach and eat an opportunity attack. */
const moverAt = (id: string, currentHP: number, maxHP: number): CombatCharacter => ({
    ...mockCharacter,
    id,
    name: id,
    team: 'enemy',
    position: { x: 0, y: 1 },
    currentHP,
    maxHP,
});

const leaveReachAction = (
    moverId: string,
    attackerId: string,
    extra: Partial<CombatAction> = {},
): CombatAction => ({
    id: `leave-reach-${moverId}`,
    characterId: moverId,
    type: 'move',
    targetPosition: { x: 0, y: 2 },
    cost: { type: 'movement-only', movementCost: 5 },
    timestamp: Date.now(),
    // Pinning both dice makes the base attack deterministic: a 19 always hits
    // the fixture AC of 10 and is never a natural critical, and the base weapon
    // damage is always 4. Anything above 4 came from a rider.
    opportunityAttackDecisions: {
        [attackerId]: { decision: 'accept', abilityId: MELEE_WEAPON.id, attackRoll: 19, damageRoll: 4 },
    },
    ...extra,
});

/** The mover as the movement finally published it, after every responder. */
const lastPublishedMover = (moverId: string): CombatCharacter | undefined => {
    const updates = mockOnCharacterUpdate.mock.calls
        .map(call => call[0] as CombatCharacter)
        .filter(character => character.id === moverId);
    return updates[updates.length - 1];
};

describe('useActionExecutor subclass riders', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
        mockProcessTileEffects.mockImplementation((character: CombatCharacter) => character);
        mockHandleDamage.mockImplementation((character: CombatCharacter) => character);
    });

    it('adds Colossus Slayer damage to a Hunter opportunity attack and spends the turn ledger', async () => {
        const mover = moverAt('wounded-ogre', 12, 20);
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'hunter',
            name: 'Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'colossus_slayer',
        };
        mockConsumeAction.mockReturnValue(mover);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, hunter],
            turnState: turnFor(mover.id),
        }));

        expect(await result.current.executeAction(leaveReachAction(mover.id, hunter.id))).toBe(true);

        const colossusLog = mockOnLogEntry.mock.calls
            .map(call => call[0].message as string)
            .find(message => message.includes('Colossus Slayer'));
        expect(colossusLog).toBeDefined();

        // The pinned weapon damage is 4; Colossus Slayer adds 1d8 on top, so
        // the mover loses between 5 and 12 of its 12 hit points.
        const damagedMover = lastPublishedMover(mover.id);
        expect(damagedMover).toBeDefined();
        const dealt = 12 - (damagedMover?.currentHP ?? 12);
        expect(dealt).toBeGreaterThanOrEqual(5);
        expect(dealt).toBeLessThanOrEqual(12);

        // The once-per-turn ledger was spent on the Hunter, not on the target.
        const hunterUpdate = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .filter(character => character.id === hunter.id)
            .find(character => character.featUsageThisTurn?.includes(HUNTER_PREY_TURN_USAGE_KEY));
        expect(hunterUpdate).toBeDefined();
    });

    it('leaves the attack alone when the Hunter chose a different Hunter’s Prey option', async () => {
        const mover = moverAt('wounded-troll', 12, 20);
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'horde-hunter',
            name: 'Horde Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'horde_breaker',
        };
        mockConsumeAction.mockReturnValue(mover);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, hunter],
            turnState: turnFor(mover.id),
        }));

        await result.current.executeAction(leaveReachAction(mover.id, hunter.id));

        expect(mockOnLogEntry.mock.calls.map(call => call[0].message as string)
            .some(message => message.includes('Colossus Slayer'))).toBe(false);
        // Only the pinned weapon die lands: 12 hit points less 4.
        expect(lastPublishedMover(mover.id)?.currentHP).toBe(8);
    });

    it('makes an Assassin opportunity attack critical against a caller-reported surprised target', async () => {
        const mover = moverAt('ambushed-guard', 20, 20);
        const assassin: CombatCharacter = {
            ...mockCharacter,
            id: 'assassin',
            name: 'Assassin',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(ASSASSINATE_FEATURE_ID)],
        };
        mockConsumeAction.mockReturnValue(mover);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, assassin],
            // The target sits at index 1 and the round pointer is 0, so the
            // rider derives "has not acted this round" from the initiative order.
            turnState: turnFor(mover.id, { turnOrder: [assassin.id, mover.id], currentTurn: 0 }),
        }));

        const action = leaveReachAction(mover.id, assassin.id, {
            surprisedCharacterIds: [mover.id],
        });
        expect(await result.current.executeAction(action)).toBe(true);

        const messages = mockOnLogEntry.mock.calls.map(call => call[0].message as string);
        expect(messages.some(message => message.includes('Assassinate turns the hit'))).toBe(true);

        // A pinned 19 is not a natural critical. Assassinate made it one, so the
        // critical rule doubled the weapon's die count and both pinned dice show
        // 4: the mover loses 8 of its 20 hit points.
        expect(lastPublishedMover(mover.id)?.currentHP).toBe(12);
    });

    it('does not make the attack critical when the caller reports no surprise', async () => {
        const mover = moverAt('alert-guard', 20, 20);
        const assassin: CombatCharacter = {
            ...mockCharacter,
            id: 'assassin-2',
            name: 'Assassin',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(ASSASSINATE_FEATURE_ID)],
        };
        mockConsumeAction.mockReturnValue(mover);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, assassin],
            turnState: turnFor(mover.id, { turnOrder: [assassin.id, mover.id], currentTurn: 0 }),
        }));

        await result.current.executeAction(leaveReachAction(mover.id, assassin.id));

        // One pinned weapon die, not two: 20 hit points less 4.
        expect(lastPublishedMover(mover.id)?.currentHP).toBe(16);
    });

    it('spends the rogue bonus action through resolveCunningAction', async () => {
        const rogue: CombatCharacter = {
            ...mockCharacter,
            id: 'rogue',
            name: 'Rogue',
            abilities: [
                featureAbility(CUNNING_ACTION_FEATURE_ID),
                featureAbility(`${CUNNING_ACTION_ABILITY_PREFIX}disengage`, { type: 'bonus' }),
            ],
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [rogue],
            turnState: turnFor(rogue.id),
        }));

        const action: CombatAction = {
            id: 'cunning-disengage',
            characterId: rogue.id,
            type: 'ability',
            abilityId: `${CUNNING_ACTION_ABILITY_PREFIX}disengage`,
            cost: { type: 'bonus' },
            timestamp: Date.now(),
        };

        expect(await result.current.executeAction(action)).toBe(true);
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: rogue.id,
            actionEconomy: expect.objectContaining({
                bonusAction: expect.objectContaining({ used: true, remaining: 0 }),
            }),
        }));
        // The rider pays the bonus action itself, so the generic payer must not run.
        expect(mockConsumeAction).not.toHaveBeenCalled();
    });

    it('refuses a Fast Hands option for a rogue who is not a Thief', async () => {
        const rogue: CombatCharacter = {
            ...mockCharacter,
            id: 'plain-rogue',
            name: 'Plain Rogue',
            abilities: [featureAbility(CUNNING_ACTION_FEATURE_ID)],
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [rogue],
            turnState: turnFor(rogue.id),
        }));

        const refused = await result.current.executeAction({
            id: 'fast-hands-attempt',
            characterId: rogue.id,
            type: 'ability',
            abilityId: `${CUNNING_ACTION_ABILITY_PREFIX}use_thieves_tools`,
            cost: { type: 'bonus' },
            timestamp: Date.now(),
        });

        expect(refused).toBe(false);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ rejectedReason: 'cunning_action:requires_fast_hands' }),
        }));
    });

    it('spends the Beast Master command and clears the tally when the ranger ends their turn', async () => {
        const ranger: CombatCharacter = {
            ...mockCharacter,
            id: 'beast-master',
            name: 'Beast Master',
            abilities: [
                featureAbility(PRIMAL_COMPANION_FEATURE_ID),
                featureAbility(PRIMAL_COMPANION_COMMAND_ABILITY_ID, { type: 'bonus' }),
            ],
        };
        const beast: CombatCharacter = {
            ...mockCharacter,
            id: 'companion',
            name: 'Companion',
            isSummon: true,
            primalBeastForm: 'land',
            summonMetadata: {
                casterId: ranger.id,
                spellId: PRIMAL_COMPANION_FEATURE_ID,
                commandsPerTurn: 1,
                commandsUsedThisTurn: 0,
            } as CombatCharacter['summonMetadata'],
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [ranger, beast],
            turnState: turnFor(ranger.id),
        }));

        expect(await result.current.executeAction({
            id: 'command-beast',
            characterId: ranger.id,
            type: 'ability',
            abilityId: PRIMAL_COMPANION_COMMAND_ABILITY_ID,
            targetCharacterIds: [beast.id],
            cost: { type: 'bonus' },
            timestamp: Date.now(),
        })).toBe(true);

        const commandedBeast = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .find(character => character.id === beast.id);
        expect(commandedBeast?.summonMetadata?.commandsUsedThisTurn).toBe(1);
        expect(mockConsumeAction).not.toHaveBeenCalled();

        // Ending the ranger's turn clears the tally so the beast answers again.
        mockOnCharacterUpdate.mockClear();
        const spentBeast = commandedBeast as CombatCharacter;
        const { result: endTurnResult } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [ranger, spentBeast],
            turnState: turnFor(ranger.id),
        }));

        await endTurnResult.current.executeAction({
            id: 'ranger-end-turn',
            characterId: ranger.id,
            type: 'end_turn',
            cost: { type: 'free' },
            timestamp: Date.now(),
        });

        expect(mockEndTurn).toHaveBeenCalled();
        const resetBeast = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .find(character => character.id === beast.id);
        expect(resetBeast?.summonMetadata?.commandsUsedThisTurn).toBe(0);
    });

    it('refuses a companion command with no named companion', async () => {
        const ranger: CombatCharacter = {
            ...mockCharacter,
            id: 'lonely-ranger',
            abilities: [
                featureAbility(PRIMAL_COMPANION_FEATURE_ID),
                featureAbility(PRIMAL_COMPANION_COMMAND_ABILITY_ID, { type: 'bonus' }),
            ],
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [ranger],
            turnState: turnFor(ranger.id),
        }));

        expect(await result.current.executeAction({
            id: 'command-nobody',
            characterId: ranger.id,
            type: 'ability',
            abilityId: PRIMAL_COMPANION_COMMAND_ABILITY_ID,
            cost: { type: 'bonus' },
            timestamp: Date.now(),
        })).toBe(false);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ rejectedReason: 'primal_companion:no_target' }),
        }));
    });

    // ========================================================================
    // Rider extra strikes (agora-db71.24)
    // ========================================================================
    // Three riders grant a SECOND real attack roll. The executor fires them on
    // the reactiveEventsOnly replay, which is the first envelope carrying the
    // command-produced hit/miss of the attack that triggered them. Each case
    // below reads the extra strike off the roster the executor published, so a
    // rider that only claimed to attack would fail here.
    // ========================================================================

    /** The replay envelope useAbilityExecution sends back after an attack resolves. */
    const attackReplay = (
        attackerId: string,
        targetIds: string[],
        attackResults: NonNullable<CombatAction['attackResults']>,
    ): CombatAction => ({
        id: `attack-replay-${attackerId}`,
        characterId: attackerId,
        type: 'ability',
        abilityId: MELEE_WEAPON.id,
        targetCharacterIds: targetIds,
        attackResults,
        reactiveEventsOnly: true,
        cost: { type: 'free' },
        timestamp: Date.now(),
    });

    const enemyAt = (id: string, x: number, y: number, hp = 20): CombatCharacter => ({
        ...mockCharacter,
        id,
        name: id,
        team: 'enemy',
        position: { x, y },
        currentHP: hp,
        maxHP: hp,
        armorClass: 10,
        baseAC: 10,
    });

    const lastUpdateFor = (characterId: string): CombatCharacter | undefined => {
        const updates = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .filter(character => character.id === characterId);
        return updates[updates.length - 1];
    };

    const loggedMessages = (): string[] => mockOnLogEntry.mock.calls
        .map(call => call[0].message as string);

    /**
     * The rider's own receipt line, which carries the hit the command rolled.
     * The extra strikes below use an unpinned d20, so every hit-dependent
     * assertion reads this flag instead of assuming an outcome.
     */
    const riderReceipt = (riderName: string) => mockOnLogEntry.mock.calls
        .map(call => call[0])
        .filter(entry => typeof entry.message === 'string' && entry.message.includes(`with ${riderName}.`))
        .pop();

    const receiptHit = (riderName: string): boolean =>
        Boolean((riderReceipt(riderName)?.data as { isHit?: boolean } | undefined)?.isHit);

    it('fires Horde Breaker once per turn at a second creature within 5 feet of the first target', async () => {
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'horde-breaker-hunter',
            name: 'Horde Breaker Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'horde_breaker',
        };
        const firstTarget = enemyAt('first-goblin', 1, 0);
        const secondTarget = enemyAt('second-goblin', 2, 0);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [hunter, firstTarget, secondTarget],
            turnState: turnFor(hunter.id),
        }));

        expect(await result.current.executeAction(
            attackReplay(hunter.id, [firstTarget.id], [{ targetId: firstTarget.id, isHit: true }]),
        )).toBe(true);

        expect(riderReceipt('Horde Breaker')).toBeDefined();

        // The extra swing lands on the SECOND creature; the rider never touches
        // the original target again. Whether it drew blood is the command's
        // call, so the hit flag on the receipt decides what the roster shows.
        const struck = lastUpdateFor(secondTarget.id) ?? secondTarget;
        expect(receiptHit('Horde Breaker') ? struck.currentHP < 20 : struck.currentHP === 20).toBe(true);
        expect(lastUpdateFor(firstTarget.id)?.currentHP ?? 20).toBe(20);

        // The ledger is spent on the Hunter, so a second Attack action this turn
        // grants no further strike.
        const spentHunter = lastUpdateFor(hunter.id);
        expect(spentHunter?.featUsageThisTurn).toContain(HUNTER_PREY_TURN_USAGE_KEY);

        mockOnLogEntry.mockClear();
        const { result: again } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [spentHunter as CombatCharacter, firstTarget, struck],
            turnState: turnFor(hunter.id),
        }));
        await again.current.executeAction(
            attackReplay(hunter.id, [firstTarget.id], [{ targetId: firstTarget.id, isHit: true }]),
        );
        expect(loggedMessages().some(message => message.includes('Horde Breaker'))).toBe(false);
    });

    it('leaves Horde Breaker alone on another creature turn, which is where opportunity attacks live', async () => {
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'off-turn-hunter',
            name: 'Off Turn Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'horde_breaker',
        };
        const firstTarget = enemyAt('mover-goblin', 1, 0);
        const secondTarget = enemyAt('bystander-goblin', 2, 0);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [hunter, firstTarget, secondTarget],
            // The mover owns the turn, so this replay is an opportunity attack's.
            turnState: turnFor(firstTarget.id),
        }));

        await result.current.executeAction(
            attackReplay(hunter.id, [firstTarget.id], [{ targetId: firstTarget.id, isHit: true }]),
        );

        expect(loggedMessages().some(message => message.includes('Horde Breaker'))).toBe(false);
        expect(lastUpdateFor(secondTarget.id)?.currentHP ?? 20).toBe(20);
    });

    it('fires Giant Killer when a Large attacker misses the Hunter', async () => {
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'giant-killer-hunter',
            name: 'Giant Killer Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'giant_killer',
        };
        const ogre: CombatCharacter = {
            ...enemyAt('ogre', 1, 0, 30),
            abilities: [MELEE_WEAPON],
            stats: { ...mockCharacter.stats, size: 'Large' },
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [hunter, ogre],
            turnState: turnFor(ogre.id),
        }));

        expect(await result.current.executeAction(
            attackReplay(ogre.id, [hunter.id], [{ targetId: hunter.id, isHit: false }]),
        )).toBe(true);

        expect(loggedMessages().some(message => message.includes('Giant Killer'))).toBe(true);
        // The Hunter spent the reaction on the counterswing.
        expect(lastUpdateFor(hunter.id)?.actionEconomy.reaction.used).toBe(true);
    });

    it('does not fire Giant Killer when the Large attacker hit', async () => {
        const hunter: CombatCharacter = {
            ...mockCharacter,
            id: 'struck-hunter',
            name: 'Struck Hunter',
            team: 'player',
            position: { x: 0, y: 0 },
            abilities: [MELEE_WEAPON, featureAbility(HUNTER_PREY_FEATURE_ID)],
            hunterPreyChoice: 'giant_killer',
        };
        const ogre: CombatCharacter = {
            ...enemyAt('hitting-ogre', 1, 0, 30),
            abilities: [MELEE_WEAPON],
            stats: { ...mockCharacter.stats, size: 'Large' },
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [hunter, ogre],
            turnState: turnFor(ogre.id),
        }));

        await result.current.executeAction(
            attackReplay(ogre.id, [hunter.id], [{ targetId: hunter.id, isHit: true }]),
        );

        expect(loggedMessages().some(message => message.includes('Giant Killer'))).toBe(false);
        expect(lastUpdateFor(hunter.id)?.actionEconomy.reaction.used ?? false).toBe(false);
    });

    it('grants the commanded companion a real strike at the named creature', async () => {
        const ranger: CombatCharacter = {
            ...mockCharacter,
            id: 'striking-ranger',
            name: 'Striking Ranger',
            position: { x: 0, y: 0 },
            abilities: [
                featureAbility(PRIMAL_COMPANION_FEATURE_ID),
                featureAbility(PRIMAL_COMPANION_COMMAND_ABILITY_ID, { type: 'bonus' }),
            ],
        };
        const beast = bindPrimalBeast(
            ranger,
            {
                ...mockCharacter,
                id: 'striking-companion',
                name: 'Companion',
                team: 'player',
                position: { x: 1, y: 0 },
            },
            'land',
        );
        const quarry = enemyAt('beast-quarry', 2, 0);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [ranger, beast, quarry],
            turnState: turnFor(ranger.id),
        }));

        expect(await result.current.executeAction({
            id: 'command-and-strike',
            characterId: ranger.id,
            type: 'ability',
            abilityId: PRIMAL_COMPANION_COMMAND_ABILITY_ID,
            // The second id is the creature the ranger commands the beast to bite.
            targetCharacterIds: [beast.id, quarry.id],
            cost: { type: 'bonus' },
            timestamp: Date.now(),
        })).toBe(true);

        expect(riderReceipt("Beast's Strike")).toBeDefined();

        // The strike is a real attack roll, so it either hits or misses; on a hit
        // the quarry loses hit points and on a miss it keeps all of them.
        const quarryHp = lastUpdateFor(quarry.id)?.currentHP ?? 20;
        expect(receiptHit("Beast's Strike") ? quarryHp < 20 : quarryHp === 20).toBe(true);
    });
});
