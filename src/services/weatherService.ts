import { WeatherState, WeatherEffect } from '../types/weather';
import { Spell } from '../types/spells';
import { GameState } from '../types/index';

/**
 * Calculates active weather effects based on current state
 */
export const getWeatherEffects = (weather: WeatherState): WeatherEffect[] => {
  const effects: WeatherEffect[] = [];

  // Precipitation effects
  if (weather.precipitation === 'heavy_rain' || weather.precipitation === 'storm') {
    effects.push({
      type: 'visibility',
      value: -1, // lightly obscured
      description: 'Heavy rain obscures vision'
    });
    effects.push({
      type: 'damage_modifier',
      value: 0.5,
      condition: 'fire',
      description: 'Fire damage is halved in heavy rain'
    });
  }

  // Wind effects
  if (weather.wind.speed === 'strong' || weather.wind.speed === 'gale') {
    effects.push({
      type: 'attack_penalty',
      value: -2,
      condition: 'ranged',
      description: 'Strong winds make ranged attacks difficult'
    });
  }

  // Temperature effects
  if (weather.temperature === 'scorching') {
     effects.push({
      type: 'movement_cost',
      value: 2, // Double cost for exhaustion risk? Simplified for now.
      description: 'Extreme heat makes travel difficult'
    });
  }

  return effects;
};

/**
 * Applies weather modifiers to a spell.
 * @param spell The spell being cast
 * @param weather The current weather state
 * @returns Array of modifiers or null if no effects
 */
export function getSpellWeatherModifiers(spell: Spell, weather: WeatherState): { type: string, value: number, reason: string }[] {
    const activeEffects = getWeatherEffects(weather);
    const modifiers: { type: string, value: number, reason: string }[] = [];

    activeEffects.forEach(effect => {
        if (effect.type === 'damage_modifier' && effect.condition && spell.effects.some(e => e.damage?.type === effect.condition)) {
            modifiers.push({
                type: 'damage_multiplier',
                value: effect.value,
                reason: effect.description
            });
        }

        // Attack roll penalties for ranged spells in high wind
        if (effect.type === 'attack_penalty' && effect.condition === 'ranged' && spell.range.type === 'ranged') {
             modifiers.push({
                type: 'attack_roll',
                value: effect.value,
                reason: effect.description
            });
        }
    });

    return modifiers;
}

// TODO(Ecologist): Integrate getSpellWeatherModifiers into the combat engine's damage calculation flow.
