import { Spell } from '../../../types/spells'
import { CombatCharacter, CombatState } from '../../../types/combat'
import { GameState } from '../../../types'
import { generateText } from '../../../services/geminiService'
import { Position } from '../../../types/world'
import { MaterialTagService } from './MaterialTagService'
import { sanitizeAIInput, detectSuspiciousInput, cleanAIJSON, safeJSONParse } from '../../../utils/securityUtils'
import { logger } from '../../../utils/logger'

export interface ArbitrationRequest {
    spell: Spell
    caster: CombatCharacter
    targets: CombatCharacter[]
    combatState: CombatState
    gameState: GameState
    playerInput?: string // For Tier 3 spells requiring player description
}

export interface SimplifiedSpellEffect {
    type: 'DAMAGE' | 'HEALING' | 'STATUS_CONDITION';
    damage?: { dice: string, type: string };
    healing?: { dice: string };
    statusCondition?: { name: string, duration: { type: 'rounds', value: number } };
    target?: string;
}

export interface ArbitrationResult {
    allowed: boolean
    reason?: string
    mechanicalEffects?: SimplifiedSpellEffect[] // Override or supplement spell effects
    narrativeOutcome?: string // For combat log
    stateChanges?: Partial<GameState> // Direct state modifications
}

const EFFECT_SCHEMA = `
{
  "allowed": boolean,
  "reason": string,
  "narrativeOutcome": string,
  "mechanicalEffects": [
    {
      "type": "DAMAGE",
      "damage": { "dice": string, "type": string },
      "target": string
    },
    {
      "type": "HEALING",
      "healing": { "dice": string },
      "target": string
    },
    {
      "type": "STATUS_CONDITION",
      "statusCondition": { "name": string, "duration": { "type": "rounds", "value": number } },
      "target": string
    }
  ]
}
`

class AISpellArbitrator {
    /**
     * Main arbitration entry point
     */
    async arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult> {
        const { spell, caster, combatState, gameState, playerInput, targets } = request

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
            return await this.aiDMAdjudication(spell, caster, targets, combatState, gameState, playerInput)
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
                logger.error('AI validation failed', { error: result.error })
                return {
                    allowed: false,
                    reason: 'AI validation service unavailable'
                }
            }

            const cleanedText = cleanAIJSON(result.data.text);
            const responseData = safeJSONParse<{ valid: boolean; reason?: string; flavorText?: string }>(cleanedText);

            if (!responseData) {
                return {
                    allowed: false,
                    reason: 'Failed to parse AI response'
                };
            }

            return {
                allowed: responseData.valid === true,
                reason: responseData.reason,
                narrativeOutcome: responseData.flavorText
            }
        } catch (error) {
            logger.error('AI validation failed', { error })
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
        targets: CombatCharacter[],
        combatState: CombatState,
        gameState: GameState,
        playerInput?: string
    ): Promise<ArbitrationResult> {
        if (!spell.aiContext?.prompt) {
            return { allowed: false, reason: 'No AI DM prompt defined' }
        }

        // 🔒 SECURITY: Detect suspicious input first
        const rawInput = playerInput || 'N/A';
        if (detectSuspiciousInput(rawInput)) {
             return {
                allowed: false,
                reason: 'Input rejected by security filter.'
            }
        }

        // 🔒 SECURITY: Sanitize user input before injecting into prompt
        const safeInput = sanitizeAIInput(rawInput, 500);

        const context = this.buildGameStateContext(caster, combatState, gameState)
        const targetNames = targets.map(t => t.name).join(', ') || 'None';

        const promptWithInput = spell.aiContext.prompt
            .replace('{target}', targetNames)
            .replace('{playerInput}', safeInput)
            .replace('{spellDC}', this.calculateSpellDC(caster).toString())

        try {
            const result = await generateText(
                `${promptWithInput}\n\nContext:\n${context}`,
                `You are a D&D 5e Dungeon Master adjudicating spell effects. Be fair but follow the rules. Be concise.
                Respond with valid JSON matching this schema:
                ${EFFECT_SCHEMA}`,
                true, // expectJson
                'AISpellArbitrator.aiDMAdjudication'
            )

            if (result.error || !result.data) {
                return {
                    allowed: false,
                    reason: 'AI DM service unavailable'
                }
            }

            const cleanedText = cleanAIJSON(result.data.text);
            // TODO(lint-intent): The any on this value hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            const responseData = safeJSONParse<{ allowed?: boolean; reason?: string; narrativeOutcome?: string; mechanicalEffects?: SimplifiedSpellEffect[] }>(cleanedText) || {};

            if (!responseData) {
                return {
                    allowed: false,
                    reason: 'Failed to parse AI response'
                };
            }

            return {
                allowed: responseData.allowed !== false, // Default to true if missing
                reason: responseData.reason,
                narrativeOutcome: responseData.narrativeOutcome,
                mechanicalEffects: responseData.mechanicalEffects
            }
        } catch (error) {
            logger.error('AI DM adjudication failed', { error })
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
- Time of Day: ${(gameState as GameState & { timeOfDay?: string }).timeOfDay || 'Unknown'}
- Weather: ${(gameState as GameState & { weather?: string }).weather || 'Unknown'}
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
