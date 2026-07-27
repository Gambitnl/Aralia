import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { CombatState } from '@/types/combat';
export declare class NarrativeCommand implements SpellCommand {
    readonly id: string;
    readonly metadata: CommandMetadata;
    private narrative;
    private context;
    constructor(narrative: string, context: CommandContext);
    execute(state: CombatState): CombatState;
    get description(): string;
}
