
import { describe, it, expect } from 'vitest';
import { StateTag } from '@/types/elemental';
import { applyStateToTags } from '../ElementalInteractionSystem';

describe('ElementalInteractionSystem', () => {
    describe('applyStateToTags', () => {
        it('should add a new state when no interactions exist', () => {
            const current: StateTag[] = [];
            const { newStates, result } = applyStateToTags(current, StateTag.Wet);

            expect(newStates).toContain(StateTag.Wet);
            expect(result.applied).toBe(true);
            expect(result.finalState).toBe(StateTag.Wet);
        });

        it('should handle Cold + Wet -> Frozen', () => {
            const current = [StateTag.Wet];
            const { newStates, result } = applyStateToTags(current, StateTag.Cold);

            // Result should be Frozen, Wet should be removed
            expect(newStates).toContain(StateTag.Frozen);
            expect(newStates).not.toContain(StateTag.Wet);
            expect(newStates).not.toContain(StateTag.Cold); // Cold transforms wet, so it's "consumed" into Frozen

            expect(result.interaction).toContain('wet + cold -> frozen');
        });

        it('should handle Frozen + Fire -> Wet (Melt)', () => {
             // Technically we defined 'frozen+burning' -> Wet
             // Let's assume input is Burning (fire)
             const current = [StateTag.Frozen];
             const { newStates, result } = applyStateToTags(current, StateTag.Burning);

             // Fire melts frozen to wet. Fire (Burning) is extinguished/consumed?
             // Logic says: existing (Frozen) + new (Burning) -> Result (Wet).
             // Both inputs are removed from the list, Result is added.

             expect(newStates).toContain(StateTag.Wet);
             expect(newStates).not.toContain(StateTag.Frozen);
             expect(newStates).not.toContain(StateTag.Burning);

             expect(result.finalState).toBe(StateTag.Wet);
        });

        it('should handle Wet + Fire -> Neutral (Extinguish)', () => {
            const current = [StateTag.Wet];
            const { newStates, result } = applyStateToTags(current, StateTag.Burning);

            // Wet + Burning -> null (cancellation)
            expect(newStates).not.toContain(StateTag.Wet);
            expect(newStates).not.toContain(StateTag.Burning);
            expect(newStates).toHaveLength(0);

            expect(result.finalState).toBeUndefined();
            expect(result.interaction).toContain('Neutralized');
        });

        it('should handle Oiled + Burning -> Burning (Intensify)', () => {
            const current = [StateTag.Oiled];
            const { newStates, result } = applyStateToTags(current, StateTag.Burning);

            // Oiled + Burning -> Burning
            // Oiled is removed, Burning is added.
            expect(newStates).toContain(StateTag.Burning);
            expect(newStates).not.toContain(StateTag.Oiled);

            expect(result.finalState).toBe(StateTag.Burning);
        });

        it('should respect alphabetic key ordering regardless of input order', () => {
            // Test Cold + Wet (defined as 'cold+wet')
            const current = [StateTag.Cold];
            const { newStates } = applyStateToTags(current, StateTag.Wet);
            expect(newStates).toContain(StateTag.Frozen);

            // Test Wet + Cold
            const current2 = [StateTag.Wet];
            const { newStates: newStates2 } = applyStateToTags(current2, StateTag.Cold);
            expect(newStates2).toContain(StateTag.Frozen);
        });
    });
});
