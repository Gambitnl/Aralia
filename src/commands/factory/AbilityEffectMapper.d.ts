import { AbilityEffect } from '@/types/combat';
import { SpellEffect } from '@/types/spells';
export declare class AbilityEffectMapper {
    static mapToSpellEffect(abilityEffect: AbilityEffect): SpellEffect | null;
}
