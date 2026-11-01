/**
 * @file bridgeContext.ts
 * Carries the already-resolved cast inputs to the special-spell families.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/spell/illusion.ts, commands/factory/spell/movement.ts, commands/factory/spell/scrying.ts, commands/factory/spell/specialSpellRegistry.ts, commands/factory/spell/terrain.ts, commands/factory/spell/utilityBridges.ts, commands/factory/spell/weaponBridges.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect } from '@/types/spells'
import { CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { CommandContext } from '../../base/SpellCommand'

export interface SpellBridgeContext {
  spell: Spell
  caster: CombatCharacter
  targets: CombatCharacter[]
  context: CommandContext
  activeEffects: SpellEffect[]
  effectiveCastLevel: number
  playerInput?: string
  selectedSpellTargets?: SelectedSpellTarget[]
}
