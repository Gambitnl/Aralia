/**
 * @file specialSpellRegistry.ts
 * Selects an existing special-spell family without changing generic fallback.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellCommand } from '../../base/SpellCommand'
import { buildScryingCommands } from './scrying'
import { buildUtilityBridgesCommands } from './utilityBridges'
import { buildIllusionCommands } from './illusion'
import { buildTerrainCommands } from './terrain'
import { buildWeaponBridgesCommands } from './weaponBridges'
import { buildMovementCommands } from './movement'
import { SpellBridgeContext } from './bridgeContext'

// Each spell has one exclusive bridge. An absent result deliberately falls back
// to ordinary effect routing; an empty command array still counts as handled.
const specialSpellBuilders: Readonly<Record<string, (input: SpellBridgeContext) => SpellCommand[] | undefined>> = {
  'scrying': buildScryingCommands,
  'elemental-bane': buildUtilityBridgesCommands,
  'grasping-vine': buildUtilityBridgesCommands,
  'seeming': buildIllusionCommands,
  'bones-of-the-earth': buildTerrainCommands,
  'booming-blade': buildWeaponBridgesCommands,
  'green-flame-blade': buildWeaponBridgesCommands,
  'true-strike': buildWeaponBridgesCommands,
  'lightning-lure': buildMovementCommands,
  'thunderwave': buildMovementCommands
}

export function createSpecialSpellCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  return Object.hasOwn(specialSpellBuilders, input.spell.id)
    ? specialSpellBuilders[input.spell.id](input)
    : undefined
}
