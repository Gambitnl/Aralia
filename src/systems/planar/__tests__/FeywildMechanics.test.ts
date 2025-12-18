
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FeywildMechanics } from '../FeywildMechanics';
import { createMockPlayerCharacter } from '../../../utils/factories';
import * as savingThrowUtils from '../../../utils/savingThrowUtils';

describe('FeywildMechanics', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fail memory check on low roll', () => {
        const char = createMockPlayerCharacter({
            name: 'Human Fighter',
            race: { name: 'Human', id: 'human', description: '', traits: [], speed: 30, size: 'Medium' }
        });

        // Mock saving throw to fail (Total 10 < DC 15)
        vi.spyOn(savingThrowUtils, 'rollSavingThrow').mockReturnValue({
            success: false,
            total: 10,
            rolls: [10],
            modifiers: {}
        });

        const result = FeywildMechanics.checkMemoryLoss(char);
        expect(result.lostMemory).toBe(true);
        expect(result.message).toContain('slipping away');
    });

    it('should succeed memory check on high roll', () => {
        const char = createMockPlayerCharacter({
            name: 'Human Fighter',
            race: { name: 'Human', id: 'human', description: '', traits: [], speed: 30, size: 'Medium' }
        });

        // Mock saving throw to succeed (Total 18 >= DC 15)
        vi.spyOn(savingThrowUtils, 'rollSavingThrow').mockReturnValue({
            success: true,
            total: 18,
            rolls: [18],
            modifiers: {}
        });

        const result = FeywildMechanics.checkMemoryLoss(char);
        expect(result.lostMemory).toBe(false);
        expect(result.message).toContain('retains their memories');
    });

    it('should give advantage to elves (natives)', () => {
        const elf = createMockPlayerCharacter({
             name: 'Elf Ranger',
             race: { name: 'Elf', id: 'elf', description: '', traits: [], speed: 30, size: 'Medium' }
        });

        // Mock first roll fail, second roll success
        const rollSpy = vi.spyOn(savingThrowUtils, 'rollSavingThrow')
            .mockReturnValueOnce({ success: false, total: 5, rolls: [5], modifiers: {} }) // First roll
            .mockReturnValueOnce({ success: true, total: 16, rolls: [16], modifiers: {} }); // Second roll (advantage)

        const result = FeywildMechanics.checkMemoryLoss(elf);

        expect(rollSpy).toHaveBeenCalledTimes(2); // Should roll twice due to native advantage
        expect(result.lostMemory).toBe(false); // Should pass eventually
    });
});
