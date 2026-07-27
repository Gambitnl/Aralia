import { SpellCommandFactory } from './factory/SpellCommandFactory';
import { AbilityCommandFactory } from './factory/AbilityCommandFactory';
export { SpellCommandFactory } from './factory/SpellCommandFactory';
export { AbilityCommandFactory } from './factory/AbilityCommandFactory';
export { CommandExecutor } from './base/CommandExecutor';
export type { SpellCommand, CommandContext, CommandMetadata } from './base/SpellCommand';
export { BaseEffectCommand } from './base/BaseEffectCommand';
export declare const commandFactoryRegistry: {
    readonly spell: {
        readonly kind: "spell";
        readonly source: "src/commands/factory/SpellCommandFactory.ts";
        readonly createCommands: typeof SpellCommandFactory.createCommands;
    };
    readonly ability: {
        readonly kind: "ability";
        readonly source: "src/commands/factory/AbilityCommandFactory.ts";
        readonly createCommands: typeof AbilityCommandFactory.createCommands;
    };
};
export type CommandFactoryKey = keyof typeof commandFactoryRegistry;
export type CommandFactoryEntry = typeof commandFactoryRegistry[CommandFactoryKey];
