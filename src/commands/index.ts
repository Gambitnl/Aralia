import { SpellCommandFactory } from './factory/SpellCommandFactory'
import { AbilityCommandFactory } from './factory/AbilityCommandFactory'

export { SpellCommandFactory } from './factory/SpellCommandFactory'
export { AbilityCommandFactory } from './factory/AbilityCommandFactory'
export { CommandExecutor } from './base/CommandExecutor'
export type { SpellCommand, CommandContext, CommandMetadata } from './base/SpellCommand'
export { BaseEffectCommand } from './base/BaseEffectCommand'

// This registry is the dashboard-friendly catalog of command creation paths.
// Direct callers can keep using the factories, while project docs and future
// agents have one explicit list to check when adding new command producers.
export const commandFactoryRegistry = {
  spell: {
    kind: 'spell',
    source: 'src/commands/factory/SpellCommandFactory.ts',
    createCommands: SpellCommandFactory.createCommands,
  },
  ability: {
    kind: 'ability',
    source: 'src/commands/factory/AbilityCommandFactory.ts',
    createCommands: AbilityCommandFactory.createCommands,
  },
} as const

export type CommandFactoryKey = keyof typeof commandFactoryRegistry
export type CommandFactoryEntry = typeof commandFactoryRegistry[CommandFactoryKey]
