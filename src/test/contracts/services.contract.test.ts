import { describe, it, expectTypeOf } from 'vitest';
import { generateActionOutcome, generateSocialCheckOutcome, generateWildernessLocationDescription } from '@/services/geminiService';
import { StandardizedResult, GeminiTextData, GeminiSocialCheckData } from '@/services/gemini/types';

describe('contract: gemini service envelopes', () => {
  it('generateActionOutcome returns standardized text result', () => {
    type R = Awaited<ReturnType<typeof generateActionOutcome>>;
    expectTypeOf<R>().toMatchTypeOf<StandardizedResult<GeminiTextData>>();
  });

  it('generateSocialCheckOutcome returns standardized social result', () => {
    type R = Awaited<ReturnType<typeof generateSocialCheckOutcome>>;
    expectTypeOf<R>().toMatchTypeOf<StandardizedResult<GeminiSocialCheckData>>();
  });

  it('generateWildernessLocationDescription returns standardized text result', () => {
    type R = Awaited<ReturnType<typeof generateWildernessLocationDescription>>;
    expectTypeOf<R>().toMatchTypeOf<StandardizedResult<GeminiTextData>>();
  });
});
