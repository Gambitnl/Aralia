import { describe, it, expect, vi } from 'vitest'
import { SummoningCommand } from '../effects/SummoningCommand'
import { SummoningEffect } from '@/types/spells'
import { CombatState, CombatCharacter } from '@/types/combat'
import { CommandContext } from '../base/SpellCommand'
import { CLASSES_DATA } from '@/constants'

// Mock dependencies
vi.mock('@/constants', async (importOriginal) => {
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const actual = await importOriginal() as unknown
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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        gameState: {} as unknown
    }

    const initialState: CombatState = {
        isActive: true,
        characters: [mockCaster],
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        turnState: {} as unknown,
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

    describe('SummoningCommand - Boundary Checks', () => {
        // Reuse mockCaster and helper functions adjusted for the existing describe block context if needed
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        const createMockContext = (mapData: unknown): CommandContext => ({
            spellId: 'spell-1',
            spellName: 'Summon Spell',
            castAtLevel: 1,
            caster: mockCaster,
            targets: [],
            gameState: {
                mapData: mapData
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            } as unknown
        })
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        const createMockState = (characters: CombatCharacter[] = [mockCaster], mapData?: unknown): CombatState => ({
            isActive: true,
            characters,
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            turnState: {} as unknown,
            selectedCharacterId: null,
            selectedAbilityId: null,
            actionMode: 'select',
            validTargets: [],
            validMoves: [],
            combatLog: [],
            reactiveTriggers: [],
            activeLightSources: [],
            mapData: mapData
        })

        const mockEffect: SummoningEffect = {
            type: 'SUMMONING',
            summonType: 'Creature',
            count: 1,
            duration: { type: 'rounds', value: 10 },
            trigger: { type: 'on_cast' }
        }

        it('should summon within map boundaries', () => {
            // Map is 10x10. Caster is at 0,0 (top-left corner)
            const mapData = {
                dimensions: { width: 10, height: 10 }
            }

            const casterAtCorner = { ...mockCaster, position: { x: 0, y: 0 } }
            const context = { ...createMockContext(undefined), caster: casterAtCorner }
            const command = new SummoningCommand(mockEffect, context)
            const state = createMockState([casterAtCorner], mapData)

            const newState = command.execute(state)

            // Should have summoned one character
            expect(newState.characters.length).toBe(2)
            const summoned = newState.characters.find(c => c.id.startsWith('summon_'))
            expect(summoned).toBeDefined()

            // Check position
            expect(summoned!.position.x).toBeGreaterThanOrEqual(0)
            expect(summoned!.position.x).toBeLessThan(10)
            expect(summoned!.position.y).toBeGreaterThanOrEqual(0)
            expect(summoned!.position.y).toBeLessThan(10)

            // Specifically check that it didn't spawn at negative coordinates
            expect(summoned!.position.x).not.toBe(-1)
            expect(summoned!.position.y).not.toBe(-1)
        })

        it('should respect map boundaries when caster is at bottom-right corner', () => {
            // Map is 10x10. Caster is at 9,9
            const mapData = {
                dimensions: { width: 10, height: 10 }
            }

            const casterAtCorner = { ...mockCaster, position: { x: 9, y: 9 } }
            const context = { ...createMockContext(undefined), caster: casterAtCorner }
            const command = new SummoningCommand(mockEffect, context)
            const state = createMockState([casterAtCorner], mapData)

            const newState = command.execute(state)

            const summoned = newState.characters.find(c => c.id.startsWith('summon_'))
            expect(summoned).toBeDefined()

            expect(summoned!.position.x).toBeGreaterThanOrEqual(0)
            expect(summoned!.position.x).toBeLessThan(10)
            expect(summoned!.position.y).toBeGreaterThanOrEqual(0)
            expect(summoned!.position.y).toBeLessThan(10)

            // Should not be > 9
            expect(summoned!.position.x).not.toBe(10)
            expect(summoned!.position.y).not.toBe(10)
        })

        it('should fail to summon if no space is available within boundaries', () => {
            // Tiny map 1x1, caster occupies 0,0. No space left.
            const mapData = {
                dimensions: { width: 1, height: 1 }
            }

            const casterAtCorner = { ...mockCaster, position: { x: 0, y: 0 } }
            const context = { ...createMockContext(undefined), caster: casterAtCorner }
            const command = new SummoningCommand(mockEffect, context)
            const state = createMockState([casterAtCorner], mapData)

            const newState = command.execute(state)

            // Should NOT have summoned
            expect(newState.characters.length).toBe(1)

            // Log should indicate failure
            expect(newState.combatLog.some(l => l.message.includes('No space available'))).toBe(true)
        })

        it('should handle mapData with gridSize format (backward compatibility)', () => {
             const mapData = {
                gridSize: { cols: 10, rows: 10 }
            }

            const casterAtCorner = { ...mockCaster, position: { x: 0, y: 0 } }
            const context = { ...createMockContext(mapData), caster: casterAtCorner }
            const command = new SummoningCommand(mockEffect, context)
            const state = createMockState([casterAtCorner])

            const newState = command.execute(state)

            const summoned = newState.characters.find(c => c.id.startsWith('summon_'))
            expect(summoned).toBeDefined()

            expect(summoned!.position.x).toBeGreaterThanOrEqual(0)
            expect(summoned!.position.x).toBeLessThan(10)
        })
    })
})
