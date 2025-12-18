/**
 * @file src/systems/environment/WeatherSystem.ts
 *
 * System for managing dynamic weather and its mechanical effects on gameplay.
 * Handles generation of weather based on biome and calculation of modifiers.
 */

import { WeatherState, EnvironmentModifier } from '../../types/environment/weather';
import { Spell } from '../../types/spells';

// Default weather state
const DEFAULT_WEATHER: WeatherState = {
  precipitation: 'none',
  wind: { speed: 'calm', direction: 'N' },
  visibility: 'clear',
  temperature: 'temperate'
};

export class WeatherSystem {
  /**
   * Generates a random weather state appropriate for the given biome.
   * @param biomeId The biome identifier (e.g., 'forest', 'desert')
   */
  static generateWeatherForBiome(biomeId: string): WeatherState {
    const weather: WeatherState = { ...DEFAULT_WEATHER };

    // Simple random generation logic based on biome characteristics
    // In a full implementation, this could use Perlin noise or seasons

    // Temperature
    if (biomeId.includes('desert')) {
      weather.temperature = Math.random() > 0.5 ? 'scorching' : 'hot';
    } else if (biomeId.includes('snow') || biomeId.includes('ice') || biomeId.includes('tundra')) {
        weather.temperature = Math.random() > 0.7 ? 'freezing' : 'cold';
    } else {
        weather.temperature = 'temperate';
    }

    // Precipitation
    const precipRoll = Math.random();
    if (biomeId.includes('desert')) {
        // Rare rain in desert
        if (precipRoll > 0.95) weather.precipitation = 'light_rain';
    } else if (biomeId.includes('rainforest') || biomeId.includes('swamp')) {
        if (precipRoll > 0.7) weather.precipitation = 'heavy_rain';
        else if (precipRoll > 0.4) weather.precipitation = 'light_rain';
    } else {
        // Standard biomes
        if (precipRoll > 0.9) weather.precipitation = 'storm';
        else if (precipRoll > 0.7) weather.precipitation = 'heavy_rain';
        else if (precipRoll > 0.5) weather.precipitation = 'light_rain';
    }

    // Snow override if freezing
    if (weather.temperature === 'freezing' && weather.precipitation !== 'none') {
        weather.precipitation = weather.precipitation === 'storm' ? 'blizzard' : 'snow';
    }

    // Wind
    const windRoll = Math.random();
    if (weather.precipitation === 'storm' || weather.precipitation === 'blizzard') {
        weather.wind.speed = windRoll > 0.5 ? 'gale' : 'strong';
    } else if (biomeId.includes('mountain') || biomeId.includes('plain')) {
        weather.wind.speed = windRoll > 0.8 ? 'strong' : (windRoll > 0.4 ? 'moderate' : 'light');
    } else {
        weather.wind.speed = windRoll > 0.9 ? 'strong' : (windRoll > 0.6 ? 'moderate' : 'light');
    }

    // Visibility
    if (weather.precipitation === 'blizzard' || weather.precipitation === 'storm') {
        weather.visibility = 'heavily_obscured';
    } else if (weather.precipitation === 'heavy_rain' || weather.precipitation === 'snow') {
        weather.visibility = 'lightly_obscured';
    }

    return weather;
  }

  /**
   * Calculates mechanical modifiers applied by the current weather.
   * @param weather The current weather state
   */
  static getEnvironmentModifiers(weather: WeatherState): EnvironmentModifier {
    const modifier: EnvironmentModifier = {
      description: []
    };

    // Movement Costs
    if (weather.precipitation === 'storm' || weather.precipitation === 'blizzard') {
      modifier.movementCostMultiplier = 2.0; // Difficult terrain everywhere
      modifier.description.push('Movement slowed by storm');
    } else if (weather.precipitation === 'heavy_rain' || weather.precipitation === 'snow') {
        modifier.movementCostMultiplier = 1.5;
        modifier.description.push('Movement slowed by heavy precipitation');
    }

    // Attack Penalties (Wind)
    if (weather.wind.speed === 'gale') {
        modifier.attackModifier = { type: 'ranged', value: -4 }; // Disadvantage approximation
        modifier.description.push('Gale force winds make ranged attacks nearly impossible');
    } else if (weather.wind.speed === 'strong') {
        modifier.attackModifier = { type: 'ranged', value: -2 };
        modifier.description.push('Strong winds hamper ranged attacks');
    }

    // Visibility
    if (weather.visibility === 'heavily_obscured') {
        modifier.description.push('Heavily obscured area (blindness beyond short range)');
    }

    // Damage Modifiers
    const damageMods = [];

    // Rain/Water vs Fire
    if (['light_rain', 'heavy_rain', 'storm'].includes(weather.precipitation)) {
        damageMods.push({ type: 'fire', value: 0.5 });
        modifier.description.push('Fire damage dampened by rain');
    }

    // Rain vs Lightning (Conductor) - Optional D&D homebrew, but ecologically sound
    if (['heavy_rain', 'storm'].includes(weather.precipitation)) {
         // Maybe lightning is dangerous to caster? Or just more effective?
         // Sticking to "resistance/vulnerability" logic.
         // Let's say cold damage is more effective if wet? (Freezing water)
         if (weather.temperature === 'freezing') {
             // Already snow/blizzard usually, but if raining + freezing...
         }
    }

    if (damageMods.length > 0) {
        modifier.damageMultiplier = damageMods;
    }

    return modifier;
  }

  /**
   * Determines if a specific spell is affected by the weather.
   * Returns specific modifiers for that spell instance.
   */
  static getSpellModifiers(weather: WeatherState, spell: Spell): EnvironmentModifier | null {
    const globalMods = this.getEnvironmentModifiers(weather);
    const specificMods: EnvironmentModifier = { description: [] };

    // Check Damage Type
    // The Spell interface is complex, we need to check effects.
    // Simplifying: Assuming caller extracts damage type or we iterate effects.
    // For this implementation, we will look at the first damage effect found.

    // Note: This relies on the new Spell structure where 'effects' is an array.
    const damageEffect = spell.effects?.find(e => e.type === 'DAMAGE');

    if (damageEffect && damageEffect.damage) {
       const damageType = damageEffect.damage.type.toLowerCase();

       // Fire suppression
       if (damageType === 'fire' && ['light_rain', 'heavy_rain', 'storm'].includes(weather.precipitation)) {
           specificMods.damageMultiplier = [{ type: 'fire', value: 0.5 }];
           specificMods.description.push('Fire spell dampened by rain');
       }

       // Cold boost in blizzards (Thematic)
       if (damageType === 'cold' && weather.precipitation === 'blizzard') {
            // Maybe not damage boost, but certainly not dampened.
       }
    }

    // Check Ranged Attacks (Ranged Spell Attacks)
    // If spell requires an attack roll and is ranged
    // The V2 spell schema doesn't always explicitly state "ranged spell attack" in a simple field,
    // often it's implied by 'range' not being self/touch and having a damage effect.
    // But let's check range.
    const isRanged = spell.range.type !== 'self' && spell.range.type !== 'touch' && (spell.range.distance ?? 0) > 0;

    // If it's a projectile (like Firebolt) wind affects it.
    // If it's instantaneous point-summon (like Sacred Flame), wind might not.
    // We'll assume all ranged attack rolls are affected for now.

    if (isRanged && globalMods.attackModifier && globalMods.attackModifier.type === 'ranged') {
        // Only if the spell actually involves an attack roll.
        // Currently 'requiresAttackRoll' might be on the spell or effect.
        const requiresAttack = spell.effects?.some(() =>
             // Logic to determine if attack roll is needed.
             // In V2, often 'attackType': 'ranged' | 'melee' exists on effect?
             // Checking Spell interface...
             // Usually it's implied or stated.
             true // Placeholder: assuming all ranged spells are projectiles for this system prototype
        );

        if (requiresAttack) {
             specificMods.attackModifier = { ...globalMods.attackModifier, type: 'spell' };
             specificMods.description.push('Strong wind affects spell trajectory');
        }
    }

    if (specificMods.description.length > 0) {
        return specificMods;
    }

    return null;
  }
}
