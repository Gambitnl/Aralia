/**
 * @file src/types/legacy.ts
 * Contains legacy type definitions that are being phased out but are still
 * required by parts of the system (e.g., spellAbilityFactory).
 */

export interface LegacySpellEffect {
  type: string;
  damage?: {
    dice: string;
    type: string;
  };
  healing?: {
    dice?: string;
    special?: string;
  };
  attack?: {
    type: string;
  };
  areaOfEffect?: {
    shape: string;
    size: number;
  };
  special?: string;
}

export interface LegacySpell {
  id: string;
  name: string;
  level: number;
  description: string;
  school?: string;
  castingTime?: string | { value: number; unit: string };
  range?: string | { type: string; distance?: number };
  components?: {
    verbal?: boolean;
    somatic?: boolean;
    material?: boolean;
    materialDescription?: string;
  };
  duration?: string | { value: number | null; unit: string; concentration?: boolean };
  higherLevelsDescription?: string;
  classes?: string[];
  tags?: string[];
  effects?: LegacySpellEffect[];
  areaOfEffect?: { shape: string; size: number };
}
