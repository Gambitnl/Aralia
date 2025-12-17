
import { describe, it, expect } from 'vitest';
import { OpportunityAttackSystem } from '../OpportunityAttackSystem';
import { CombatCharacter, Position } from '@/types/combat';

describe('OpportunityAttackSystem', () => {
    const createMockCharacter = (id: string, x: number, y: number, team: 'player' | 'enemy'): CombatCharacter => ({
        id,
        name: id,
        team,
        position: { x, y },
        abilities: [{
            id: 'sword',
            name: 'Sword',
            type: 'attack',
            range: 1, // 5ft
            cost: { type: 'action' },
            effects: [],
            targeting: 'single_enemy',
            description: 'A sword'
        }],
        statusEffects: [],
        actionEconomy: {
            reaction: { used: false, remaining: 1 },
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        },
        currentHP: 10,
        maxHP: 10,
        stats: { speed: 30, dexterity: 10 } as any,
        level: 1,
        class: { id: 'fighter', name: 'Fighter', hitDie: 'd10' } as any,
        abilities: [{
            id: 'basic_attack',
            name: 'Basic Attack',
            type: 'attack',
            cost: { type: 'action' },
            range: 1,
            targeting: 'single_enemy',
            description: 'Basic attack',
            effects: []
        }]
    });

    it('should detect opportunity attack when leaving adjacent square', () => {
        const mover = createMockCharacter('mover', 0, 0, 'player');
        const enemy = createMockCharacter('enemy', 1, 0, 'enemy'); // Adjacent East

        // Move West (Away): (0,0) -> (-1,0)
        const from = { x: 0, y: 0 };
        const to = { x: -2, y: 0 }; // Moving 2 squares away

        const results = OpportunityAttackSystem.checkForOpportunityAttacks(
            mover, from, to, [enemy]
        );

        expect(results.length).toBe(1);
        expect(results[0].attackerId).toBe('enemy');
        expect(results[0].triggerPosition).toEqual({ x: 0, y: 0 }); // Triggered at start
    });

    it('should NOT trigger if Disengage is active', () => {
        const mover = createMockCharacter('mover', 0, 0, 'player');
        mover.statusEffects.push({
            id: 'disengage', name: 'Disengaged', type: 'buff', duration: 1,
            effect: { type: 'condition' }
        });

        const enemy = createMockCharacter('enemy', 1, 0, 'enemy');
        const from = { x: 0, y: 0 };
        const to = { x: -2, y: 0 };

        const results = OpportunityAttackSystem.checkForOpportunityAttacks(
            mover, from, to, [enemy]
        );

        expect(results.length).toBe(0);
    });

    it('should NOT trigger if reaction is used', () => {
        const mover = createMockCharacter('mover', 0, 0, 'player');
        const enemy = createMockCharacter('enemy', 1, 0, 'enemy');
        enemy.actionEconomy.reaction.used = true;

        const from = { x: 0, y: 0 };
        const to = { x: -2, y: 0 };

        const results = OpportunityAttackSystem.checkForOpportunityAttacks(
            mover, from, to, [enemy]
        );

        expect(results.length).toBe(0);
    });

    it('should trigger for Reach weapon only when leaving Reach (10ft)', () => {
        const mover = createMockCharacter('mover', 0, 0, 'player');
        const enemy = createMockCharacter('enemy', 2, 0, 'enemy'); // 10ft away (Range 2)

        // Give enemy reach weapon
        enemy.abilities[0].range = 2;

        // Move from (0,0) [Dist 2] to (-1,0) [Dist 3] -> Leave Reach 2? Yes.
        const from = { x: 0, y: 0 };
        const to = { x: -1, y: 0 };

        const results = OpportunityAttackSystem.checkForOpportunityAttacks(
            mover, from, to, [enemy]
        );

        expect(results.length).toBe(1);
        expect(results[0].attackerId).toBe('enemy');
    });

    it('should NOT trigger when moving within reach', () => {
        const mover = createMockCharacter('mover', 0, 0, 'player');
        const enemy = createMockCharacter('enemy', 1, 1, 'enemy');

        // Move around enemy: (0,0) -> (0,1) -> (1,0)
        // All are within dist 1 of (1,1).
        const from = { x: 0, y: 0 };
        const to = { x: 1, y: 0 }; // Path will effectively circle the enemy

        const results = OpportunityAttackSystem.checkForOpportunityAttacks(
            mover, from, to, [enemy]
        );

        expect(results.length).toBe(0);
    });
});
