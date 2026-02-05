/**
 * @file src/systems/crime/BountyHunterSystem.ts
 * Logic for spawning and managing Bounty Hunters tracking the player.
 */

import { GameState, GameMessage, NotorietyState, NPC } from '../../types';
import { AmbushEvent, HunterProfile, HunterTier } from '../../types/crime';
import { SeededRandom } from '@/utils/random';
import { createEnemyFromMonster } from '../../utils/combatUtils';
import { MONSTERS_DATA } from '../../data/monsters';

export class BountyHunterSystem {

    /**
     * Checks if a bounty hunter should spawn based on current heat.
     * @returns The generated Bounty Hunter NPC or null.
     */
    static checkForHunterSpawn(
        state: GameState, 
        rng: SeededRandom
    ): { npc: NPC, message: string } | null {
        const heat = state.notoriety.globalHeat;
        if (heat < 50) return null; // No hunters below 50 heat

        // Chance = (Heat - 40) / 200 per check
        // At 50 heat = 5% chance
        // At 100 heat = 30% chance
        const spawnChance = (heat - 40) / 200;
        
        if (rng.next() > spawnChance) return null;

        // Determine hunter tier
        let tier = 'novice';
        if (heat > 80) tier = 'elite';
        else if (heat > 65) tier = 'veteran';

        const hunter = this.generateBountyHunter(tier, rng);
        const message = this.getSpawnMessage(tier);

        return { npc: hunter, message };
    }

    private static generateBountyHunter(tier: string, rng: SeededRandom): NPC {
        const id = `bounty_hunter_${Date.now()}`;
        const names = ['Kael', 'Vorn', 'Silas', 'Mara', 'Jinx'];
        const name = `${rng.pick(names)} the ${tier === 'elite' ? 'Relentless' : 'Tracker'}`;

        return {
            id,
            name,
            baseDescription: `A ${tier} bounty hunter sent to collect the price on your head.`,
            role: 'guard', // Aggressive role
            initialPersonalityPrompt: 'You are a bounty hunter. You want the gold.',
            faction: 'law_enforcement'
        };
    }

    private static getSpawnMessage(tier: string): string {
        switch (tier) {
            case 'elite': return "You feel a cold gaze. An elite hunter has found you.";
            case 'veteran': return "A seasoned bounty hunter steps from the shadows.";
            default: return "Someone is watching you. A bounty hunter approaches.";
        }
    }

    /**
     * Checks if a bounty hunter ambush should occur based on notoriety.
     */
    static checkForAmbush(
        notoriety: NotorietyState,
        locationId: string,
        seed: number = Date.now()
    ): AmbushEvent | null {
        const activeBounties = notoriety.bounties.filter(bounty => bounty.isActive);
        if (activeBounties.length === 0) return null;

        const globalHeat = notoriety.globalHeat;
        const localHeat = notoriety.localHeat[locationId] ?? 0;

        if (globalHeat < 50 && localHeat < 25) return null;

        const maxBounty = Math.max(...activeBounties.map(bounty => bounty.amount));
        const tier =
            maxBounty >= 10000 || globalHeat >= 90
                ? HunterTier.Elite
                : globalHeat >= 70
                    ? HunterTier.Mercenary
                    : HunterTier.Thug;

        const rng = new SeededRandom(seed);
        const names = ['Kael', 'Vorn', 'Silas', 'Mara', 'Jinx'];
        const hunter: HunterProfile = {
            id: `bounty_hunter_${seed}`,
            name: `${rng.pick(names)} the ${tier === HunterTier.Elite ? 'Relentless' : 'Tracker'}`,
            tier,
            className: tier === HunterTier.Elite ? 'Rogue' : tier === HunterTier.Mercenary ? 'Fighter' : 'Ranger',
            level: tier === HunterTier.Elite ? 8 : tier === HunterTier.Mercenary ? 5 : 2,
            specialAbilities: []
        };

        return {
            hunter,
            tier,
            bountiesChased: activeBounties.map(bounty => bounty.id),
            locationId
        };
    }

    /**
     * Generates a simple NPC encounter from an ambush event.
     */
    static generateAmbushEncounter(event: AmbushEvent): NPC[] {
        const leader: NPC = {
            id: event.hunter.id,
            name: event.hunter.name,
            baseDescription: `A ${event.tier.toLowerCase()} bounty hunter leading an ambush.`,
            initialPersonalityPrompt: 'You are a bounty hunter. You want the gold.',
            role: 'guard',
            faction: 'law_enforcement'
        };

        const minionCount = event.tier === HunterTier.Elite ? 2 : 1;
        const minions: NPC[] = Array.from({ length: minionCount }, (_, index) => ({
            id: `${event.hunter.id}_minion_${index + 1}`,
            name: `${event.hunter.name}\'s Tracker ${index + 1}`,
            baseDescription: 'A hired tracker assisting the bounty hunter.',
            initialPersonalityPrompt: 'You are a bounty hunter henchman.',
            role: 'guard',
            faction: 'law_enforcement'
        }));

        return [leader, ...minions];
    }

    /**
     * Attempts to pay off a bounty and returns the outcome.
     */
    static payOffBounty(
        bountyId: string,
        state: GameState
    ): { success: boolean; message: string; cost?: number } {
        const bounty = state.notoriety.bounties.find(entry => entry.id === bountyId && entry.isActive);
        if (!bounty) {
            return { success: false, message: 'No active bounty found.' };
        }

        const cost = Math.ceil(bounty.amount * 1.25);
        if (state.gold < cost) {
            return { success: false, message: `You need ${cost} gold to pay off this bounty.`, cost };
        }

        return { success: true, message: 'Bounty paid off.', cost };
    }
}
