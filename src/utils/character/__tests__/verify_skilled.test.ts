import { describe, it, expect, vi } from 'vitest';
import { applyFeatToCharacter } from '../characterUtils';
import { createMockPlayerCharacter } from '../../core/factories';
import { Feat } from '../../../types';

// Mock SKILLS_DATA implicitly used by applyFeatToCharacter via characterUtils import
// But characterUtils likely imports SKILLS_DATA directly.
// In the integration test environment, it should use the real one or we mock the data module.
// Let's rely on the real one since it's just data.

describe('Skilled Feat Implementation', () => {
    it('should add selected skills to the character', () => {
        const character = createMockPlayerCharacter({
            skills: []
        });

        // Mock a "Skilled" feat definition
        const skilledFeat: Feat = {
            id: 'skilled',
            name: 'Skilled',
            description: '...',
            benefits: {
                selectableSkillCount: 3,
                skillProficiencies: []
            }
        };

        const result = applyFeatToCharacter(character, skilledFeat, {
            selectedSkills: ['acrobatics', 'arcana', 'stealth']
        });

        const skillIds = result.skills.map(s => s.id);
        expect(skillIds).toContain('acrobatics');
        expect(skillIds).toContain('arcana');
        expect(skillIds).toContain('stealth');
        expect(result.skills.length).toBe(3);
    });

    it('should merge selected skills with existing skills', () => {
        const character = createMockPlayerCharacter({
            skills: [
                { id: 'athletics', name: 'Athletics', ability: 'Strength' }
            ]
        });

        const skilledFeat: Feat = {
            id: 'skilled',
            name: 'Skilled',
            description: '...',
            benefits: {
                selectableSkillCount: 3
            }
        };

        const result = applyFeatToCharacter(character, skilledFeat, {
            selectedSkills: ['history']
        });

        const skillIds = result.skills.map(s => s.id);
        expect(skillIds).toContain('athletics');
        expect(skillIds).toContain('history');
        expect(result.skills.length).toBe(2);
    });
});
