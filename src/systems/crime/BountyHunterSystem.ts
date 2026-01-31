/**
 * @file src/systems/crime/BountyHunterSystem.ts
 * Logic for spawning and managing Bounty Hunters tracking the player.
 */

import { GameState, GameMessage, NotorietyState, NPC } from '../../types';
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
}