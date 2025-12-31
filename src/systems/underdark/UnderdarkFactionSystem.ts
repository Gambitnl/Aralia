/**
 * @file src/systems/underdark/UnderdarkFactionSystem.ts
 * System for handling Underdark faction logic, including depth checks,
 * hostility calculations, and mechanic application.
 */

import { UnderdarkFaction, DepthLayer, UnderdarkState, UnderdarkMechanic } from '../../types/underdark';
import { UNDERDARK_FACTIONS } from '../../data/underdarkFactions';

export class UnderdarkFactionSystem {
    /**
     * Determines which DepthLayer corresponds to a given depth in feet.
     * @param depthFeet Depth in feet below surface
     */
    static getLayerFromDepth(depthFeet: number): DepthLayer {
        if (depthFeet < 2000) return 'upper';
        if (depthFeet < 10000) return 'middle';
        if (depthFeet < 30000) return 'lower';
        return 'abyss'; // > 30,000 ft
    }

    /**
     * Returns all factions that inhabit the current depth layer.
     * @param depthFeet Depth in feet
     */
    static getFactionsAtDepth(depthFeet: number): UnderdarkFaction[] {
        const layer = this.getLayerFromDepth(depthFeet);
        return UNDERDARK_FACTIONS.filter(f => f.territoryDepth === layer);
    }

    /**
     * Calculates the effective hostility of a faction towards the player party.
     * @param faction The faction in question
     * @param playerRace The race of the lead character (e.g., 'Drow', 'Dwarf')
     * @param reputation Player's reputation with this faction (-100 to 100)
     */
    static calculateHostility(faction: UnderdarkFaction, playerRace: string, reputation: number): number {
        let hostility = faction.baseHostility;

        // Racial Modifiers
        if (faction.id === 'drow_menzoberranzan') {
            if (playerRace === 'Drow') hostility -= 40; // They tolerate their own (mostly)
            else if (playerRace === 'Elf' || playerRace === 'High Elf') hostility += 20; // Hate surface elves
        } else if (faction.id === 'duergar_gracklstugh') {
            if (playerRace === 'Duergar') hostility -= 30;
            else if (playerRace === 'Dwarf' || playerRace === 'Mountain Dwarf') hostility += 10; // Hate surface dwarves
            else if (playerRace === 'Mind Flayer') hostility = 100; // Kill on sight
        } else if (faction.id === 'svirfneblin_blingdenstone') {
            if (playerRace === 'Gnome' || playerRace === 'Deep Gnome') hostility -= 20;
        }

        // Reputation Modifier (-reputation reduces hostility)
        // If rep is 100 (Exalted), hostility drops by 50.
        // If rep is -100 (Hated), hostility increases by 50.
        hostility -= (reputation / 2);

        return Math.max(0, Math.min(100, hostility));
    }

    /**
     * Applies special faction mechanics to the Underdark state.
     * Use this when the player is in the faction's territory.
     *
     * @param state Current UnderdarkState
     * @param factionId ID of the faction whose territory we are in
     * @param minutesPassed Time elapsed for update
     */
    static applyTerritoryMechanics(state: UnderdarkState, factionId: string | undefined, minutesPassed: number): UnderdarkState {
        if (!factionId) return state;

        const faction = UNDERDARK_FACTIONS.find(f => f.id === factionId);
        if (!faction) return state;

        let newState = { ...state };

        faction.specialMechanics.forEach(mech => {
            newState = this.applyMechanic(newState, mech, minutesPassed);
        });

        return newState;
    }

    /**
     * Internal helper to apply a single mechanic.
     */
    private static applyMechanic(state: UnderdarkState, mechanic: UnderdarkMechanic, minutesPassed: number): UnderdarkState {
        // Deep copy sanity to avoid mutation
        const newState = {
            ...state,
            sanity: { ...state.sanity }
        };

        switch (mechanic.type) {
            case 'psionic_static': {
                // Drains sanity faster
                // Intensity 1-10. Each point adds 0.1 drain/hour
                // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
                // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
                // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
                const drainAmount = (mechanic.intensity * 0.1) * (minutesPassed / 60);
                newState.sanity.current = Math.max(0, newState.sanity.current - drainAmount);
                break;
            }

            case 'radiation':
                // Increases Faerzress level temporarily or permanently
                // Logic handled by FaerzressSystem mostly, but we can bump the level here
                newState.faerzressLevel = Math.min(100, newState.faerzressLevel + (mechanic.intensity * (minutesPassed / 60)));
                break;

            case 'spore_infestation':
                // Could handle disease logic here, or just flag it
                // For now, let's say spores make the air thick, reducing light slightly?
                // Or maybe they act as a weird bioluminescence
                // Let's implement a sanity *buff* actually - spores make you "happy" (compliant)
                // But only if you are already slightly mad
                if (newState.sanity.madnessLevel > 0) {
                     // The spores soothe the broken mind... terrifyingly.
                     newState.sanity.current += (mechanic.intensity * 0.2) * (minutesPassed / 60);
                }
                break;

            // Other mechanics might be checked actively during gameplay (e.g. stealth checks),
            // not in the passive state update loop.
        }

        return newState;
    }
}
