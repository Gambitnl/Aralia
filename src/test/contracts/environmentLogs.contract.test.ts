import { describe, it, expectTypeOf } from 'vitest';
import { WeatherState } from '@/types/environment';
import { GeminiLogEntry, OllamaLogEntry } from '@/types/state';

describe('contract: environment and logs', () => {
  it('WeatherState includes precipitation/temperature/wind/visibility', () => {
    const weather: WeatherState = {
      precipitation: 'none',
      temperature: 'temperate',
      wind: { direction: 'north', speed: 'calm' },
      visibility: 'clear',
      baseTemperature: 'temperate',
      baseVisibility: 'clear',
    };
    expectTypeOf(weather).toMatchTypeOf<WeatherState>();
  });

  it('GeminiLogEntry/OllamaLogEntry keep timestamp and text fields', () => {
    const gem: GeminiLogEntry = {
      timestamp: new Date(),
      functionName: 'generateActionOutcome',
      prompt: 'prompt',
      response: 'response',
    };
    const ollama: OllamaLogEntry = {
      timestamp: new Date(),
      model: 'llama',
      prompt: 'prompt',
      response: 'response',
    };
    expectTypeOf(gem).toMatchTypeOf<GeminiLogEntry>();
    expectTypeOf(ollama).toMatchTypeOf<OllamaLogEntry>();
  });
});
