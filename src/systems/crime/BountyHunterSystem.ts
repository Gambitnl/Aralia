
import {
    Bounty,
    HeatLevel,
    CrimeType
} from '../../types/crime';
import { GameState, NotorietyState } from '../../types';
import { CombatCharacter } from '../../types/combat';
import { SeededRandom } from '../../utils/seededRandom';
import { HunterProfile, HunterTier, AmbushEvent } from '../../types/crime';

export class BountyHunterSystem {

    /**
     * Determines if a bounty hunter ambush occurs based on heat and location.
     * @param noteriety The player's notoriety state.
     * @param locationId Current location ID.
     * @param seed Optional seed for deterministic rolls.
     */
    static checkForAmbush(
        noteriety: NotorietyState,
        locationId: string,
        seed?: number
    ): AmbushEvent | null {
        const rng = new SeededRandom(seed || Date.now());

        // 1. Check for active bounties
        const activeBounties = noteriety.bounties.filter(b => b.isActive);
        if (activeBounties.length === 0) return null;

        // 2. Determine highest relevant heat
        const localHeat = noteriety.localHeat[locationId] || 0;
        const globalHeat = noteriety.globalHeat;

        // Effective heat is local + 50% of global
        const effectiveHeat = localHeat + (globalHeat * 0.5);
        const heatLevel = this.getHeatLevel(effectiveHeat);

        // 3. Base chance based on Heat Level
        let ambushChance = 0;
        switch (heatLevel) {
            case HeatLevel.Unknown: ambushChance = 0; break;
            case HeatLevel.Suspected: ambushChance = 5; break; // 5%
            case HeatLevel.Wanted: ambushChance = 15; break;   // 15%
            case HeatLevel.Hunted: ambushChance = 35; break;   // 35%
        }

        // 4. Modifier based on total bounty value
        const totalBounty = activeBounties.reduce((sum, b) => sum + b.amount, 0);
        if (totalBounty > 5000) ambushChance += 10;
        else if (totalBounty > 1000) ambushChance += 5;

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
        if (heatLevel === HeatLevel.Hunted || totalBounty > 5000) return HunterTier.Elite;
        if (heatLevel === HeatLevel.Wanted || totalBounty > 1000) return HunterTier.Mercenary;
        return HunterTier.Thug;
    }

    private static generateHunterProfile(tier: HunterTier, rng: SeededRandom): HunterProfile {
        const classes = ['Fighter', 'Ranger', 'Rogue'];
        const names = ['Vos', 'Kael', 'Lyra', 'Thorn', 'Grix', 'Sable'];
        const titles = {
            [HunterTier.Thug]: ['the Breaker', 'the Rat'],
            [HunterTier.Mercenary]: ['the Hound', 'Blade'],
            [HunterTier.Elite]: ['the Shadow', 'Deathwalker']
        };

        const name = `${rng.pick(names)} ${rng.pick(titles[tier])}`;
        const className = rng.pick(classes);

        return {
            id: crypto.randomUUID(),
            name,
            tier,
            className,
            level: this.getLevelForTier(tier),
            specialAbilities: ['Net Toss', 'Mark Target'] // Placeholders
        };
    }

    private static getLevelForTier(tier: HunterTier): number {
        switch (tier) {
            case HunterTier.Thug: return 3;
            case HunterTier.Mercenary: return 6;
            case HunterTier.Elite: return 10;
            default: return 1;
        }
    }

    private static createHunterCombatCharacter(profile: HunterProfile): CombatCharacter {
        // Creates a basic CombatCharacter for the hunter
        return {
            id: profile.id,
            name: profile.name,
            hp: profile.level * 10,
            maxHp: profile.level * 10,
            ac: 12 + Math.floor(profile.level / 2),
            initiative: 0,
            abilities: [],
            conditions: [],
            statusEffects: [],
            inventory: [],
            equipped: {},
            stats: { strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
            level: profile.level,
            movement: 30,
            actionPoints: 1,
            bonusActions: 1,
            reactions: 1,
            isEnemy: true,
            isAlly: false,
            isNeutral: false,
            finalAbilityScores: { strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 }
        } as unknown as CombatCharacter;
        // Cast as unknown -> CombatCharacter because full interface is massive,
        // but this covers the combat engine requirements for generation.
        // In full impl, this would link to a CharacterFactory that pulls from NPC stats.
    }

    private static createMinion(name: string, hp: number): CombatCharacter {
        return {
            id: crypto.randomUUID(),
            name,
            hp,
            maxHp: hp,
            ac: 12,
            initiative: 0,
            abilities: [],
            conditions: [],
            statusEffects: [],
            inventory: [],
            equipped: {},
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            level: 1,
            movement: 30,
            actionPoints: 1,
            bonusActions: 1,
            reactions: 1,
            isEnemy: true,
            isAlly: false,
            isNeutral: false,
            finalAbilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
        } as unknown as CombatCharacter;
    }
}
