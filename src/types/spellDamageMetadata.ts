// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 13:28:34
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines spell damage type metadata.
 *
 * Damage type names are shared by spell effects, resistance rules, damage
 * interactions, and older compatibility paths. Keeping the names and their
 * plain-English descriptions here lets the main spell type file re-export the
 * same public API without carrying this reference table directly.
 *
 * Called by: `spells.ts` and any future damage-focused spell modules.
 * Depends on: no runtime data; this is a type and metadata registry.
 */

// ============================================================================
// Damage Type Names
// ============================================================================
// This section names the canonical D&D damage types used by spell damage,
// mitigation, resistance, immunity, and damage-interaction mechanics.
// ============================================================================

/** The thirteen types of damage in D&D 5e. */
export const DamageType = {
  Acid: "Acid",
  Bludgeoning: "Bludgeoning",
  Cold: "Cold",
  Fire: "Fire",
  Force: "Force",
  Lightning: "Lightning",
  Necrotic: "Necrotic",
  Piercing: "Piercing",
  Poison: "Poison",
  Psychic: "Psychic",
  Radiant: "Radiant",
  Slashing: "Slashing",
  Thunder: "Thunder",
} as const;

// Allow string for test compatibility and imported/homebrew damage labels that
// have not been normalized into the canonical table yet.
export type DamageType = typeof DamageType[keyof typeof DamageType] | string;

// ============================================================================
// Damage Type Descriptions
// ============================================================================
// These descriptions are human-facing reference text. They do not drive damage
// math, but they help UI, docs, and future agents understand what each type
// represents without opening the core spell model.
// ============================================================================

/** Plain-English explanation attached to a damage type. */
export interface DamageTypeTraits {
  description: string;
}

/** Standard traits associated with each damage type. */
export const DamageTypeDefinitions: Record<DamageType, DamageTypeTraits> = {
  [DamageType.Acid]: { description: "The corrosive spray of a black dragon or the dissolving enzymes of a black pudding." },
  [DamageType.Bludgeoning]: { description: "Blunt force attacks, such as from a hammer or a fall." },
  [DamageType.Cold]: { description: "The infernal chill radiating from an ice devil's spear or a white dragon's breath." },
  [DamageType.Fire]: { description: "The red dragon breathing fire or a spellcaster calling down a meteor swarm." },
  [DamageType.Force]: { description: "Pure magical energy focused into a damaging form." },
  [DamageType.Lightning]: { description: "A storm giant throwing a lightning bolt or a blue dragon's breath." },
  [DamageType.Necrotic]: { description: "The withering touch of a lich or the decaying magic of a vampire." },
  [DamageType.Piercing]: { description: "Puncturing attacks, such as from a spear or an arrow." },
  [DamageType.Poison]: { description: "Venomous stings and toxic gases." },
  [DamageType.Psychic]: { description: "Mental assaults that shatter the mind." },
  [DamageType.Radiant]: { description: "Searng light like that of a cleric's flame strike or an angel's weapon." },
  [DamageType.Slashing]: { description: "Cutting attacks, such as from a sword or an axe." },
  [DamageType.Thunder]: { description: "A concussive burst of sound, such as from a thunderwave spell." },
};
