import { SpellCommand, CommandContext } from '../base/SpellCommand';

export class NarrativeCommand extends SpellCommand {
    private narrative: string;

    constructor(narrative: string, context: CommandContext) {
        super(context);
        this.narrative = narrative;
    }

    async execute(): Promise<void> {
        // Log the narrative to the combat log
        this.context.combatState.combatLog.push(
            `[DM]: ${this.narrative}`
        );

        // TODO: In the future, this could trigger a Notification or a Modal
        console.log(`[NarrativeCommand] Executing: ${this.narrative}`);
    }
}
