/**
 * @file src/types/materials.ts
 * Defines the material types and their properties used throughout the game world,
 * primarily for interactions like spell penetration (e.g., Detect Magic),
 * structural integrity, and object interactions.
 */

export type MaterialType =
  | 'wood'
  | 'stone'
  | 'dirt'
  | 'metal'
  | 'lead'
  | 'glass'
  | 'flesh'
  | 'water'
  | 'fabric'
  | 'paper'
  | 'force'; // magical force

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

export const MATERIAL_PROPERTIES: Record<MaterialType, MaterialProperties> = {
  wood: {
    magicPenetrationLimitInches: 36, // 3 feet of wood
    baseAc: 15,
    hpPerInch: 3,
  },
  stone: {
    magicPenetrationLimitInches: 12, // 1 foot of stone
    baseAc: 17,
    hpPerInch: 5,
  },
  dirt: {
    magicPenetrationLimitInches: 36, // 3 feet of dirt
    baseAc: 10,
    hpPerInch: 1,
  },
  metal: {
    magicPenetrationLimitInches: 1, // 1 inch of metal
    baseAc: 19,
    hpPerInch: 10,
  },
  lead: {
    magicPenetrationLimitInches: 0, // Lead blocks magic instantly
    baseAc: 19,
    hpPerInch: 10,
  },
  glass: {
    magicPenetrationLimitInches: undefined, // Usually doesn't block divination
    baseAc: 13,
    hpPerInch: 1,
  },
  flesh: {
    magicPenetrationLimitInches: undefined,
    baseAc: 10,
    hpPerInch: 2,
  },
  water: {
    magicPenetrationLimitInches: undefined,
    baseAc: 10,
    hpPerInch: 1,
  },
  fabric: {
    magicPenetrationLimitInches: undefined,
    baseAc: 11,
    hpPerInch: 1,
  },
  paper: {
    magicPenetrationLimitInches: undefined,
    baseAc: 11,
    hpPerInch: 1,
  },
  force: {
    magicPenetrationLimitInches: undefined, // Usually blocks physical, but divination passes unless specified
    baseAc: 20,
    hpPerInch: Infinity,
  }
};
