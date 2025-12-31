
import { describe, it, expect } from 'vitest';
import { UnderdarkMechanics } from '../UnderdarkMechanics';
import { GameState, UnderdarkState } from '../../../types';
// TODO(lint-intent): 'UNDERDARK_BIOMES' is unused in this test; use it in the assertion path or remove it.
import { UNDERDARK_BIOMES as _UNDERDARK_BIOMES } from '../../../data/underdark/biomes';

describe('Underdark Biome Mechanics', () => {
    // Mock State Factory
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const createMockState = (biomeId: unknown, lightLevel: unknown = 'darkness'): GameState => ({
        gameTime: new Date(),
        underdark: {
            currentDepth: 5000,
            currentBiomeId: biomeId,
            lightLevel: lightLevel,
            activeLightSources: [],
            sanity: { current: 100, max: 100, madnessLevel: 0 },
            faerzressLevel: 0,
            wildMagicChance: 0
        } as UnderdarkState
    } as GameState);

    it('should set light level to dim in Fungal Forest even without sources', () => {
        const state = createMockState('fungal_forest');
        const { underdark } = UnderdarkMechanics.processTime(state, 60);

        expect(underdark.lightLevel).toBe('dim');
    });

    it('should maintain darkness in Standard Cavern without sources', () => {
        const state = createMockState('cavern_standard');
        const { underdark } = UnderdarkMechanics.processTime(state, 60);

        expect(underdark.lightLevel).toBe('darkness');
    });

    it('should accelerate sanity decay in Shadowfell Rift', () => {
        const state = createMockState('shadowfell_rift');
        // Shadowfell has sanityModifier 3.0
        // Base loss is 1 per 30 mins (2 per hour)
        // Magical darkness multiplies decayMultiplier by 2.
        // So modifier becomes 3.0 * 2 = 6.0
        // Total change = 2 (base units) * 6.0 = 12 points lost per hour.
        // Expected: 100 - 12 = 88.

        const { underdark } = UnderdarkMechanics.processTime(state, 3600);
        expect(underdark.sanity.current).toBe(88);
    });

    it('should halt sanity decay in Fungal Forest (Safe Biome) when lit', () => {
        const state = createMockState('fungal_forest', 'dim');
        // Fungal forest is 'dim' naturally.
        // Logic: if lightLevel != darkness, and modifier < 1, it allows recovery (-1 multiplier)

        // Start with some damage
        state.underdark.sanity.current = 90;

        const { underdark } = UnderdarkMechanics.processTime(state, 3600); // 1 hour

        // 1 hour = 2 base units (30 mins each)
        // Multiplier is -1 (recovery)
        // Change = 2 * -1 = -2
        // Current = 90 - (-2) = 92
        expect(underdark.sanity.current).toBe(92);
    });

    it('should NOT recover sanity in Bone Orchard (Scary Biome) even when lit', () => {
        const state = createMockState('bone_orchard');
        // Simulate a torch making it bright
        state.underdark.activeLightSources = [{
            id: '1', type: 'torch', name: 'Torch',
            radius: 20, durationRemaining: 60, isActive: true
        }];

        // Initial process will set light to bright
        const step1 = UnderdarkMechanics.processTime(state, 0).underdark;
        expect(step1.lightLevel).toBe('bright');

        // Now process time
        // Bone Orchard modifier is 2.0 (> 1.0)
        // Logic: if lightLevel != darkness and modifier > 1, decayMultiplier = 0 (Halt)
        // BUT wait, looking at my code logic:
        // if (decayMultiplier > 1.0) { decayMultiplier = 0; }
        // const totalChange = baseChange * decayMultiplier;
        // if (totalChange > 0) decay...
        // if (totalChange < 0) recover...

        // If decayMultiplier is 0, totalChange is 0.
        // No decay, no recovery.

        // The failure was: expected 86 to be 90.
        // It lost 4 points?
        // Why?
        // Ah, maybe the light source duration expired?
        // durationRemaining: 60 mins. processTime(3600 sec) -> 60 mins passed.
        // In processTime:
        // 1. Process Light Sources. Duration 60 -> 0. Message: "flickers and dies".
        //    remainingSources might be empty if logic removes them?
        //    Logic: if duration <= 0, message pushed, BUT:
        //    if (source.isActive) ... else { remainingSources.push(source) }
        //    It seems the logic for "expired" sources doesn't push them to remainingSources?
        //    "if (source.durationRemaining <= 0) { ... } else ... { remainingSources.push(source) }"
        //    Yes, expired sources are removed.

        // So light sources become empty.
        // Then step 2: Recalculate Light Level.
        // Active sources empty. Bone Orchard base light is 'darkness'.
        // So lightLevel becomes 'darkness'.
        // Then step 3: Sanity Decay.
        // In darkness, standard decay applies.
        // Bone Orchard modifier 2.0.
        // Base change (60 mins) = 2 units.
        // Total change = 2 * 2.0 = 4.0.
        // 90 - 4 = 86.
        // So the test failed because the light died!

        // Fix: Give the torch more fuel.
        state.underdark.activeLightSources[0].durationRemaining = 120;

        state.underdark.sanity.current = 90;
        const { underdark } = UnderdarkMechanics.processTime(state, 3600);

        expect(underdark.sanity.current).toBe(90); // No change
    });
});
