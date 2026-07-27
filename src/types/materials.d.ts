/**
 * @file src/types/materials.ts
 * Defines the material types and their properties used throughout the game world,
 * primarily for interactions like spell penetration (e.g., Detect Magic),
 * structural integrity, and object interactions.
 */
export type MaterialType = 'wood' | 'stone' | 'dirt' | 'metal' | 'lead' | 'glass' | 'flesh' | 'water' | 'fabric' | 'paper' | 'force';
export interface MaterialProperties {
    /**
     * The thickness (in inches) required to block standard magical sensors or divination
     * (e.g., Detect Magic).
     * A value of 0 means it blocks magic instantly (like lead).
     * undefined or Infinity means it cannot block magic regardless of thickness.
     */
    magicPenetrationLimitInches?: number;
    /**
     * Optional base armor class for objects made of this material.
     */
    baseAc?: number;
    /**
     * Optional base hit points per inch of thickness.
     */
    hpPerInch?: number;
}
export declare const MATERIAL_PROPERTIES: Record<MaterialType, MaterialProperties>;
