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
/** The thirteen types of damage in D&D 5e. */
export declare const DamageType: {
    readonly Acid: "Acid";
    readonly Bludgeoning: "Bludgeoning";
    readonly Cold: "Cold";
    readonly Fire: "Fire";
    readonly Force: "Force";
    readonly Lightning: "Lightning";
    readonly Necrotic: "Necrotic";
    readonly Piercing: "Piercing";
    readonly Poison: "Poison";
    readonly Psychic: "Psychic";
    readonly Radiant: "Radiant";
    readonly Slashing: "Slashing";
    readonly Thunder: "Thunder";
};
export type DamageType = typeof DamageType[keyof typeof DamageType] | string;
/** Plain-English explanation attached to a damage type. */
export interface DamageTypeTraits {
    description: string;
}
/** Standard traits associated with each damage type. */
export declare const DamageTypeDefinitions: Record<DamageType, DamageTypeTraits>;
