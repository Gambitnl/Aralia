import { Spell } from '../../../types/spells'
import { CombatCharacter, CombatState } from '../../../types/combat'
import { GameState } from '../../../types'
import { generateText } from '../../../services/geminiService'
import { Position } from '../../../types/map'
import { MaterialTagService } from './MaterialTagService'

export interface ArbitrationRequest {
    spell: Spell
    caster: CombatCharacter
    targets: CombatCharacter[]
    combatState: CombatState
    gameState: GameState
    playerInput?: string // For Tier 3 spells requiring player description
}

export interface ArbitrationResult {
    allowed: boolean
    reason?: string
    mechanicalEffects?: any[] // Override or supplement spell effects
    narrativeOutcome?: string // For combat log
    stateChanges?: Partial<GameState> // Direct state modifications
}

class AISpellArbitrator {
    /**
     * Main arbitration entry point
     */
    async arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult> {
        const { spell, caster, combatState, gameState, playerInput } = request

        // Tier 1: Mechanical (no AI needed)
        if (!spell.arbitrationType || spell.arbitrationType === 'mechanical') {
            return { allowed: true }
        }

        // Tier 2: AI-Assisted Validation
        if (spell.arbitrationType === 'ai_assisted') {
            return await this.validateContext(spell, caster, combatState, gameState)
        }

        // Tier 3: Full AI DM Adjudication
        if (spell.arbitrationType === 'ai_dm') {
            if (!playerInput && spell.aiContext?.playerInputRequired) {
                return {
                    allowed: false,
                    reason: 'Player input required for this spell'
                }
            }
            return await this.aiDMAdjudication(spell, caster, combatState, gameState, playerInput)
        }

        return { allowed: false, reason: 'Unknown arbitration type' }
    }

    /**
     * Tier 2: Validate context (e.g., "is there stone nearby?")
     */
    private async validateContext(
        spell: Spell,
        caster: CombatCharacter,
        combatState: CombatState,
        gameState: GameState
    ): Promise<ArbitrationResult> {
        if (!spell.aiContext?.prompt) {
            return { allowed: false, reason: 'No AI validation prompt defined' }
        }

        const context = this.buildGameStateContext(caster, combatState, gameState)

        try {
            const result = await generateText(
                `${spell.aiContext.prompt}\n\nContext:\n${context}`,
                'You are a D&D 5e DM validating spell prerequisites. Respond with valid JSON only.',
                true, // expectJson
                'AISpellArbitrator.validateContext'
            )

            if (result.error || !result.data) {
                console.error('AI validation failed:', result.error)
                return {
                    allowed: false,
                    reason: 'AI validation service unavailable'
                }
            }

            const responseData = JSON.parse(result.data.text.replace(/```json\n|```/g, '').trim())

            return {
                allowed: responseData.valid === true,
                reason: responseData.reason,
                narrativeOutcome: responseData.flavorText
            }
        } catch (error) {
            console.error('AI validation failed:', error)
            return {
                allowed: false,
                reason: 'AI validation service unavailable'
            }
        }
    }

    /**
     * Tier 3: Full AI DM adjudication (e.g., Suggestion, Prestidigitation)
     */
    private async aiDMAdjudication(
        spell: Spell,
        caster: CombatCharacter,
        combatState: CombatState,
        gameState: GameState,
        playerInput?: string
    ): Promise<ArbitrationResult> {
        if (!spell.aiContext?.prompt) {
            return { allowed: false, reason: 'No AI DM prompt defined' }
        }

        const context = this.buildGameStateContext(caster, combatState, gameState)
        const targetNames = request.targets.map(t => t.name).join(', ') || 'None';
        const promptWithInput = spell.aiContext.prompt
            .replace('{target}', targetNames)
            .replace('{playerInput}', playerInput || 'N/A')
            .replace('{spellDC}', this.calculateSpellDC(caster).toString())

        try {
            const result = await generateText(
                `${promptWithInput}\n\nContext:\n${context}`,
                'You are a D&D 5e Dungeon Master adjudicating spell effects. Be fair but follow the rules. Be concise.',
                false, // expectJson
                'AISpellArbitrator.aiDMAdjudication'
            )

            if (result.error || !result.data) {
                return {
                    allowed: false,
                    reason: 'AI DM service unavailable'
                }
            }

            return {
                allowed: true,
                narrativeOutcome: result.data.text,
                // TODO: Parse AI response for mechanical effects if needed
            }
        } catch (error) {
            console.error('AI DM adjudication failed:', error)
            return {
                allowed: false,
                reason: 'AI DM service unavailable'
            }
        }
    }

    /**
     * Build context string for AI
     */
    private buildGameStateContext(
        caster: CombatCharacter,
        combatState: CombatState,
        gameState: GameState
    ): string {
        return `
Character: ${caster.name} at position (${caster.position.x}, ${caster.position.y})

Nearby Creatures (within 30 feet):
${this.describeNearbyCreatures(caster, combatState)}

Nearby Terrain:
${this.describeNearbyTerrain(caster, gameState)}

Current Conditions:
- Combat Round: ${combatState.turnState.currentTurn}
- Time of Day: ${gameState.timeOfDay || 'Unknown'}
- Weather: ${gameState.weather || 'Unknown'}
    `.trim()
    }

    private describeNearbyCreatures(
        caster: CombatCharacter,
        combatState: CombatState
    ): string {
        const nearby = combatState.characters.filter(char => {
            if (char.id === caster.id) return false
            const distance = this.getDistance(caster.position, char.position)
            return distance <= 6 // 30 feet = 6 tiles
        })

        if (nearby.length === 0) return 'None within range'

        return nearby.map(char =>
            `- ${char.name} (${char.team}): ${char.currentHP}/${char.maxHP} HP, ${this.getDistance(caster.position, char.position) * 5}ft away`
        ).join('\n')
    }

    private describeNearbyTerrain(
        caster: CombatCharacter,
        gameState: GameState
    ): string {
        return MaterialTagService.describeNearbyMaterials(caster.position, gameState);
    }

    private getDistance(pos1: Position, pos2: Position): number {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
        )
    }

    private calculateSpellDC(caster: CombatCharacter): number {
        const level = caster.level || 1
        const proficiencyBonus = 2 + Math.floor(Math.max(0, level - 1) / 4)

        // Identify spellcasting ability from class, default to Intelligence if unknown
        const abilityName = caster.class?.spellcasting?.ability || 'Intelligence'
        const score = (caster.stats[abilityName.toLowerCase() as keyof typeof caster.stats] || 10) as number
        const spellcastingMod = Math.floor((score - 10) / 2)

        return 8 + proficiencyBonus + spellcastingMod
    }
}

// Singleton instance
export const aiSpellArbitrator = new AISpellArbitrator()
