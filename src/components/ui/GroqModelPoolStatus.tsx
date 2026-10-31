/**
 * @file src/components/ui/GroqModelPoolStatus.tsx
 *
 * Shows the Groq model pool in the AI settings pane: each free-plan model,
 * which one answered last, and which ones are at their rate limit and until
 * when. Remy asked (2026-10-31) to see which model answered once the game
 * moves between models to get more requests per day.
 */

import React, { useEffect, useState } from 'react';
import { GROQ_MODEL_POOL, groqModelOrder, useGroqPoolStatus } from '../../services/ai/groqModelPool';
import { getGroqModel } from '../../services/ai/aiProviderSettings';

export const GroqModelPoolStatus: React.FC = () => {
  const { lastAnsweredBy, restingUntil } = useGroqPoolStatus();
  // Re-render each 15 s so a model whose rest has ended shows as ready again.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const order = groqModelOrder(getGroqModel());
  return (
    <div data-testid="groq-model-pool" className="mt-3 rounded border border-sky-500/30 bg-gray-900/50 p-3">
      <p className="text-xs text-gray-300 leading-snug mb-2">
        Each model has its own free daily limit. The game uses the first model until Groq stops it, then the
        next one.
      </p>
      <ul className="space-y-1">
        {order.map((model, i) => {
          const until = restingUntil[model];
          const resting = until !== undefined && until > now;
          return (
            <li key={model} data-testid={`groq-pool-model-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-mono text-gray-100">{model}</span>
              {resting ? (
                <span className="text-amber-300">at its limit until {new Date(until).toLocaleTimeString()}</span>
              ) : (
                <span className="text-emerald-300">ready</span>
              )}
              {lastAnsweredBy === model && <span className="text-sky-300">· answered last</span>}
            </li>
          );
        })}
      </ul>
      {GROQ_MODEL_POOL.every((m) => (restingUntil[m] ?? 0) > now) && (
        <p className="mt-2 text-xs text-red-300">Every model is at its limit. AI text waits until one is free again.</p>
      )}
    </div>
  );
};
