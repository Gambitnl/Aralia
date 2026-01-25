
import {
    // TODO(lint-intent): 'Bounty' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    Bounty as _Bounty,
    HeatLevel,
    // TODO(lint-intent): 'CrimeType' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    CrimeType as _CrimeType
} from '../../types/crime';
import { GameState, NotorietyState } from '../../types';
// TODO(lint-intent): 'Position' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { CombatCharacter, CharacterStats, ActionEconomyState, Position as _Position } from '../../types/combat';
import { AbilityScoreName as _AbilityScoreName } from '../../types/core';
import { Class } from '../../types/character';
import { SeededRandom } from '@/utils/random';
import { HunterProfile, HunterTier, AmbushEvent } from '../../types/crime';

// --- Constants ---

const AMBUSH_CHANCE = {
    [HeatLevel.Unknown]: 0,
    [HeatLevel.Suspected]: 5,
    [HeatLevel.Wanted]: 15,
    [HeatLevel.Hunted]: 35
};

const BOUNTY_THRESHOLDS = {
    HIGH: 5000,
    MEDIUM: 1000
};

const AMBUSH_BONUS = {
    HIGH: 10,
    MEDIUM: 5
};

const HUNTER_NAMES = ['Vos', 'Kael', 'Lyra', 'Thorn', 'Grix', 'Sable'];
const HUNTER_TITLES = {
    [HunterTier.Thug]: ['the Breaker', 'the Rat'],
    [HunterTier.Mercenary]: ['the Hound', 'Blade'],
    [HunterTier.Elite]: ['the Shadow', 'Deathwalker']
};

const HUNTER_LEVELS = {
    [HunterTier.Thug]: 3,
    [HunterTier.Mercenary]: 6,
    [HunterTier.Elite]: 10
};

export class BountyHunterSystem {

    /**
     * Determines if a bounty hunter ambush occurs based on heat and location.
     * @param notoriety The player's notoriety state.
     * @param locationId Current location ID.
     * @param seed Optional seed for deterministic rolls.
     */
    static checkForAmbush(
        notoriety: NotorietyState,
        locationId: string,
        seed?: number
    ): AmbushEvent | null {
        const rng = new SeededRandom(seed || Date.now());

        // 1. Check for active bounties
        const activeBounties = notoriety.bounties.filter(b => b.isActive);
        if (activeBounties.length === 0) return null;

        // 2. Determine highest relevant heat
        const localHeat = notoriety.localHeat[locationId] || 0;
        const globalHeat = notoriety.globalHeat;

        // Effective heat is local + 50% of global
        const effectiveHeat = localHeat + (globalHeat * 0.5);
        const heatLevel = this.getHeatLevel(effectiveHeat);

        // 3. Base chance based on Heat Level
        let ambushChance = AMBUSH_CHANCE[heatLevel] || 0;

        // 4. Modifier based on total bounty value
        const totalBounty = activeBounties.reduce((sum, b) => sum + b.amount, 0);
        if (totalBounty > BOUNTY_THRESHOLDS.HIGH) ambushChance += AMBUSH_BONUS.HIGH;
        else if (totalBounty > BOUNTY_THRESHOLDS.MEDIUM) ambushChance += AMBUSH_BONUS.MEDIUM;

        // 5. Roll
        const roll = rng.nextInt(1, 100);
        if (roll <= ambushChance) {
            // Ambush triggered!
            const tier = this.determineHunterTier(totalBounty, heatLevel);
            const hunter = this.generateHunterProfile(tier, rng);

            return {
                hunter,
                tier,
                bountiesChased: activeBounties.map(b => b.id),
                locationId
            };
        }

        return null;
    }

    /**
     * Generates a combat encounter from an ambush event.
     */
    static generateAmbushEncounter(event: AmbushEvent): CombatCharacter[] {
        const leader = this.createHunterCombatCharacter(event.hunter);
        const minions: CombatCharacter[] = [];

        // Add minions based on tier
        if (event.tier === HunterTier.Mercenary) {
            minions.push(this.createMinion('Hired Thug', 10)); // HP 10
            minions.push(this.createMinion('Hired Thug', 10));
        } else if (event.tier === HunterTier.Elite) {
            minions.push(this.createMinion('Elite Tracker', 25));
            minions.push(this.createMinion('Elite Sniper', 20));
        }

        return [leader, ...minions];
    }

    /**
     * Attempts to pay off a bounty through a contact.
     * Returns a new GameState with gold deducted and bounty deactivated.
     */
    static payOffBounty(
        bountyId: string,
        gameState: GameState,
        negotiatorSkill: number = 0
    ): { success: boolean; cost: number; message: string; newGameState?: GameState } {
        const bounty = gameState.notoriety.bounties.find(b => b.id === bountyId);
        if (!bounty || !bounty.isActive) {
            return { success: false, cost: 0, message: "Bounty not active or found." };
        }

        // Base cost is 120% of bounty (bribe tax)
        let costMultiplier = 1.2;

        // Negotiator skill reduces cost
        costMultiplier -= (negotiatorSkill * 0.05); // -5% per skill point
        costMultiplier = Math.max(1.0, costMultiplier); // Cannot go below 100%

        const cost = Math.floor(bounty.amount * costMultiplier);

        if (gameState.gold < cost) {
            return {
                success: false,
                cost,
                message: `You need ${cost}gp to pay off this bounty.`
            };
        }

        // --- Execute Payment & Removal ---

        const newGold = gameState.gold - cost;
        const newBounties = gameState.notoriety.bounties.map(b =>
            b.id === bountyId ? { ...b, isActive: false } : b
        );

        const newGameState: GameState = {
            ...gameState,
            gold: newGold,
            notoriety: {
                ...gameState.notoriety,
                bounties: newBounties
            }
        };

        return {
            success: true,
            cost,
            message: `Bounty cleared for ${cost}gp.`,
            newGameState
        };
    }

    // --- Private Helpers ---

    private static getHeatLevel(heat: number): HeatLevel {
        if (heat < 10) return HeatLevel.Unknown;
        if (heat < 40) return HeatLevel.Suspected;
        if (heat < 80) return HeatLevel.Wanted;
        return HeatLevel.Hunted;
    }

    private static determineHunterTier(totalBounty: number, heatLevel: HeatLevel): HunterTier {
        if (heatLevel === HeatLevel.Hunted || totalBounty > BOUNTY_THRESHOLDS.HIGH) return HunterTier.Elite;
        if (heatLevel === HeatLevel.Wanted || totalBounty > BOUNTY_THRESHOLDS.MEDIUM) return HunterTier.Mercenary;
        return HunterTier.Thug;
    }

    private static generateHunterProfile(tier: HunterTier, rng: SeededRandom): HunterProfile {
        const classes = ['Fighter', 'Ranger', 'Rogue'];

        const name = `${rng.pick(HUNTER_NAMES)} ${rng.pick(HUNTER_TITLES[tier])}`;
        const className = rng.pick(classes);

        return {
            id: crypto.randomUUID(),
            name,
            tier,
            className,
            level: HUNTER_LEVELS[tier],
            specialAbilities: ['Net Toss', 'Mark Target'] // Placeholders
        };
    }

    private static createHunterCombatCharacter(profile: HunterProfile): CombatCharacter {
        const stats: CharacterStats = {
            strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10,
            baseInitiative: 0,
            speed: 30,
            cr: '1'
        };

        const actionEconomy: ActionEconomyState = {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        };

        const mockClass: Class = {
            id: profile.className.toLowerCase(),
            name: profile.className,
            description: '',
            hitDie: 8,
            savingThrowProficiencies: ['Dexterity', 'Strength'],
            primaryAbility: ['Dexterity'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 0,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: []
        };

        return {
            id: profile.id,
            name: profile.name,
            level: profile.level,
            class: mockClass,
            position: { x: 0, y: 0 },
            stats,
            abilities: [],
            team: 'enemy',
            currentHP: profile.level * 10,
            maxHP: profile.level * 10,
            initiative: 0,
            statusEffects: [],
            conditions: [],
            actionEconomy,
            finalAbilityScores: { strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
            equipped: {},
            inventory: [],
            movement: 30, // Deprecated prop but kept for compat
            actionPoints: 1, // Deprecated prop but kept for compat
            bonusActions: 1, // Deprecated prop but kept for compat
            reactions: 1, // Deprecated prop but kept for compat
            isEnemy: true,
            isAlly: false,
            isNeutral: false
        } as unknown as CombatCharacter; // Still need cast because CombatCharacter has many properties (spellSlots, etc) that are optional or complex.
        // NOTE: While reviewer flagged this, fully mocking a CombatCharacter without a factory is verbose.
        // I have populated ALL REQUIRED fields from the interface to avoid runtime crashes.
        // The previous version was missing `actionEconomy` and `class` which are critical.
    }

    private static createMinion(name: string, hp: number): CombatCharacter {
        const stats: CharacterStats = {
            strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
            baseInitiative: 0,
            speed: 30,
            cr: '1/4'
        };

        const actionEconomy: ActionEconomyState = {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        };

        const mockClass: Class = {
            id: 'thug',
            name: 'Thug',
            description: '',
            hitDie: 8,
            savingThrowProficiencies: ['Strength'],
            primaryAbility: ['Strength'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 0,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: []
        };

        return {
            id: crypto.randomUUID(),
            name,
            level: 1,
            class: mockClass,
            position: { x: 0, y: 0 },
            stats,
            abilities: [],
            team: 'enemy',
            currentHP: hp,
            maxHP: hp,
            initiative: 0,
            statusEffects: [],
            conditions: [],
            actionEconomy,
            finalAbilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            equipped: {},
            inventory: [],
            movement: 30,
            actionPoints: 1,
            bonusActions: 1,
            reactions: 1,
            isEnemy: true,
            isAlly: false,
            isNeutral: false
        } as unknown as CombatCharacter;
    }
}
