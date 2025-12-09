import { describe, it, expect, vi } from 'vitest'
import { SummoningCommand } from '../effects/SummoningCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter } from '@/types/combat'
import { CommandContext } from '../base/SpellCommand'
import { CLASSES_DATA } from '@/constants'

// Mock dependencies
vi.mock('@/constants', async (importOriginal) => {
    const actual = await importOriginal() as any
    return {
        ...actual,
        MONSTERS_DATA: {
            'goblin': {
                id: 'goblin',
                name: 'Goblin',
                baseStats: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8, baseInitiative: 2, speed: 30, cr: '1/4' },
                maxHP: 7,
                abilities: [],
                tags: ['goblinoid']
            }
        },
        CLASSES_DATA: {
            'fighter': { id: 'fighter', name: 'Fighter', hitDie: 10, primaryAbility: 'Strength', savingThrows: ['Strength', 'Constitution'], features: [] }
        }
    }
})

describe('SummoningCommand', () => {
    const mockCaster: CombatCharacter = {
        id: 'caster-1',
        name: 'Wizard',
        class: CLASSES_DATA['fighter'], // Placeholder
        position: { x: 5, y: 5 },
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
        abilities: [],
        team: 'player',
        currentHP: 20,
        maxHP: 20,
        initiative: 10,
        statusEffects: [],
        actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 }
    }

    const mockContext: CommandContext = {
        caster: mockCaster,
        targets: [],
        spellLevel: 1,
        gameState: {} as any
    }

    const initialState: CombatState = {
        isActive: true,
        characters: [mockCaster],
        turnState: {} as any,
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: []
    }

    it('should summon a creature from MONSTERS_DATA', () => {
        const effect: SummoningEffect = {
            type: 'SUMMONING',
            summonType: 'creature',
            creatureId: 'goblin',
            count: 1,
            duration: { type: 'minutes', value: 1 }
        }

        const command = new SummoningCommand(effect, mockContext)
        const newState = command.execute(initialState)

        expect(newState.characters.length).toBe(2)
        const summoned = newState.characters.find(c => c.id.startsWith('summon_goblin_'))
        expect(summoned).toBeDefined()
        expect(summoned?.name).toBe('Goblin 1')
        expect(summoned?.maxHP).toBe(7)
        expect(summoned?.team).toBe('player')

        // Should be adjacent to caster (spiral search finds x:4, y:4 or similar)
        // Caster is at 5,5.
        expect(summoned?.position).not.toEqual(mockCaster.position)
        const dx = Math.abs(summoned!.position.x - mockCaster.position.x)
        const dy = Math.abs(summoned!.position.y - mockCaster.position.y)
        expect(dx <= 1 && dy <= 1).toBe(true)
    })

    it('should handle multiple summons', () => {
        const effect: SummoningEffect = {
            type: 'SUMMONING',
            summonType: 'creature',
            creatureId: 'goblin',
            count: 2,
            duration: { type: 'minutes', value: 1 }
        }

        const command = new SummoningCommand(effect, mockContext)
        const newState = command.execute(initialState)

        expect(newState.characters.length).toBe(3) // Caster + 2 Goblins
        const goblins = newState.characters.filter(c => c.name.startsWith('Goblin'))
        expect(goblins.length).toBe(2)
        expect(goblins[0].position).not.toEqual(goblins[1].position)
    })

    it('should fallback to generic summon if creatureId not found', () => {
        const effect: SummoningEffect = {
            type: 'SUMMONING',
            summonType: 'creature',
            creatureId: 'unknown_beast',
            count: 1,
            duration: { type: 'minutes', value: 1 }
        }

        const command = new SummoningCommand(effect, mockContext)
        const newState = command.execute(initialState)

        const summoned = newState.characters.find(c => c.id.startsWith('summon_unknown_beast_'))
        expect(summoned).toBeDefined()
        expect(summoned?.name).toBe('Summoned Creature 1')
        expect(summoned?.maxHP).toBe(10) // Fallback HP
    })
})
