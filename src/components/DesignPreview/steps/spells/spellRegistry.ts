// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 12:21:39
 * Dependents: components/DesignPreview/steps/spells/SpellsDomainShell.tsx, components/DesignPreview/steps/spells/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SpellScenarioRegistry } from './types';
import CureWoundsScenario from './cureWoundsScenario';
import FireBoltScenario from './fireBoltScenario';
import ShieldScenario from './shieldScenario';
import ThunderwaveScenario from './thunderwaveScenario';

/**
 * This file lists the first four spell scenarios that the Tactical Sandbox
 * shell can present to the Rules host.
 *
 * The starter set is intentionally small and source-backed: Fire Bolt proves
 * an attack roll, Thunderwave proves a saving throw with an area rider, Cure
 * Wounds proves healing, and Shield proves a returned when-hit reaction
 * arbitration. Each entry names the existing catalog and resolver evidence
 * behind its scenario.
 *
 * Called by: SpellsDomainShell.tsx and the Rules integration surface.
 * Depends on: the local spell scenario types; mechanics remain in production
 * command and resolver modules named in each entry.
 */

// ============================================================================
// Starter Registry
// ============================================================================
// This set spans materially different canonical paths. The rationale is kept
// beside each entry so future leaves can extend the registry with the same
// evidence bar without moving mechanics into the shell.
// ============================================================================

export const SPELL_SCENARIO_REGISTRY = [
  {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    kind: 'attack-roll',
    summary: 'Ranged spell attack with hit-conditioned fire damage and cantrip scaling.',
    availability: 'available',
    scenarioComponent: FireBoltScenario,
    canonicalEvidence: {
      catalogPaths: [
        'src/data/spells/level-0/fire-bolt.json',
        'src/data/spells_manifest.json',
      ],
      resolverPaths: [
        'src/commands/factory/SpellCommandFactory.ts',
        'src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts',
      ],
      rationale: 'Representative attack-roll starter: this leaf proves the record\'s ranged creature attack and hit-conditioned damage through production helpers; the authored object-ignition rider remains outside this supported receipt.',
    },
  },
  {
    id: 'thunderwave',
    name: 'Thunderwave',
    level: 1,
    kind: 'saving-throw',
    summary: 'Constitution save for half damage, with a truthful forced-movement boundary.',
    availability: 'available',
    scenarioComponent: ThunderwaveScenario,
    canonicalEvidence: {
      catalogPaths: [
        'src/data/spells/level-1/thunderwave.json',
        'src/data/spells_manifest.json',
      ],
      resolverPaths: [
        'src/systems/spells/mechanics/directDamageSpellCastResolution.ts',
        'src/commands/factory/SpellCommandFactory.ts',
        'src/utils/character/savingThrowUtils.ts',
        'src/commands/__tests__/SpellCommandFactory.thunderwave.test.ts',
      ],
      rationale: 'Representative saving-throw starter: the deterministic leaf uses the atomic damage transaction for save, half damage, area targeting, HP, Action, and slot payment; the canonical SpellCommandFactory push remains an explicit boundary because the atomic receipt does not return movement.',
    },
  },
  {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    kind: 'healing',
    summary: 'Touch healing that restores hit points and scales by slot level.',
    availability: 'available',
    scenarioComponent: CureWoundsScenario,
    canonicalEvidence: {
      catalogPaths: [
        'src/data/spells/level-1/cure-wounds.json',
        'src/data/spells_manifest.json',
      ],
      resolverPaths: [
        'src/systems/spells/mechanics/healingTemporaryHitPointResolution.ts',
        'src/commands/effects/HealingCommand.ts',
        'src/commands/__tests__/HealingCommand.test.ts',
        'src/systems/spells/mechanics/__tests__/healingTemporaryHitPointResolution.test.ts',
      ],
      rationale: 'Representative healing starter: the deterministic leaf derives 2d8 plus the spellcasting modifier and routes targeting, HP restoration, downed cleanup, Action, and slot payment through the atomic production resolver.',
    },
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    kind: 'reaction-defense',
    summary: 'When-hit reaction that raises AC before the attack becomes damage.',
    availability: 'available',
    scenarioComponent: ShieldScenario,
    canonicalEvidence: {
      catalogPaths: [
        'src/data/spells/level-1/shield.json',
        'src/data/spells_manifest.json',
      ],
      resolverPaths: [
        'src/commands/factory/AbilityCommandFactory.ts',
        'src/commands/effects/DefensiveCommand.ts',
        'src/commands/factory/__tests__/AbilityCommandFactory.reactionArbitration.test.ts',
        'src/commands/__tests__/DefensiveCommand.test.ts',
      ],
      rationale: 'Representative reaction-defense starter: the canonical when-hit arbitration applies the AC change before deciding whether the attack still hits.',
    },
  },
] satisfies SpellScenarioRegistry;

// ============================================================================
// Registry Lookup
// ============================================================================
// The lookup returns the first entry when an integration sends an unknown or
// stale selection. That safe default keeps the shell renderable during host
// migration and makes Reset deterministic.
// ============================================================================

export function getSpellScenario(
  registry: SpellScenarioRegistry,
  spellId: string | undefined,
): SpellScenarioRegistry[number] {
  return registry.find(spell => spell.id === spellId) ?? registry[0];
}
