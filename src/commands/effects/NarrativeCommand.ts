import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { CombatState } from '@/types/combat';
import { generateId } from '../../utils/idGenerator';

export class NarrativeCommand implements SpellCommand {
    public readonly id: string;
    public readonly metadata: CommandMetadata;
    private narrative: string;
    private context: CommandContext;

    constructor(narrative: string, context: CommandContext) {
        this.narrative = narrative;
        this.context = context;
        this.id = generateId();
        this.metadata = {
            spellId: context.spellId,
            spellName: context.spellName,
            casterId: context.caster.id,
            casterName: context.caster.name,
            targetIds: context.targets.map(t => t.id),
            effectType: 'NARRATIVE',
            timestamp: Date.now()
        };
    }

    execute(state: CombatState): CombatState {
        // Log the narrative to the combat log
        return {
            ...state,
            combatLog: [
                ...state.combatLog,
                {
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'info',
                    message: `[DM]: ${this.narrative}`,
                    characterId: this.context.caster.id
                }
            ]
        };
    }

    get description(): string {
        return `Narrative outcome: ${this.narrative.substring(0, 50)}...`;
    }
}
