/**
 * @file src/components/ui/OllamaModelPicker.tsx
 * One Ollama model and explicit processing choice per task category.
 * Lists the models the local Ollama server reports plus the catalog; the
 * choice persists through aiProviderSettings. No fallback: a chosen model that
 * is not installed is shown with a warning, and the runtime reports it as an
 * error instead of quietly using another model.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:00:50
 * Dependents: components/ui/OllamaDependencyModal.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useState } from 'react';
import {
  OLLAMA_MODEL_CATEGORIES,
  getOllamaModelChoices,
  getOllamaComputeMode,
  setOllamaComputeMode,
  type OllamaComputeMode,
  setOllamaModelChoice,
  type OllamaModelCategory,
} from '../../services/ai/aiProviderSettings';
import {
  OLLAMA_CATEGORY_DEFAULT_MODEL,
  OLLAMA_MODEL_CATALOG,
  OLLAMA_MODEL_CATEGORY_LABEL,
} from '../../config/llmProviderConfig';
import { OllamaClient } from '../../services/ollama/client';

export interface OllamaModelPickerProps {
  /** Injected for tests; defaults to a real client. */
  listInstalled?: () => Promise<string[] | null>;
}

const defaultListInstalled = async (): Promise<string[] | null> => {
  const models = await new OllamaClient().listModels();
  return models ? models.map((m) => m.name) : null;
};

export const OllamaModelPicker: React.FC<OllamaModelPickerProps> = ({ listInstalled = defaultListInstalled }) => {
  const [installed, setInstalled] = useState<string[] | null | 'loading'>('loading');
  const [choices, setChoices] = useState(() => getOllamaModelChoices());
  const [computeModes, setComputeModes] = useState(() => Object.fromEntries(
    OLLAMA_MODEL_CATEGORIES.map(category => [category, getOllamaComputeMode(category)]),
  ) as Record<OllamaModelCategory, OllamaComputeMode>);

  useEffect(() => {
    let alive = true;
    listInstalled().then((list) => { if (alive) setInstalled(list); }).catch(() => { if (alive) setInstalled(null); });
    return () => { alive = false; };
  }, [listInstalled]);

  const options = useMemo(() => {
    const set = new Set<string>(OLLAMA_MODEL_CATALOG);
    if (Array.isArray(installed)) for (const m of installed) set.add(m);
    return [...set].sort();
  }, [installed]);

  const isInstalled = (model: string): boolean | null => {
    if (!Array.isArray(installed)) return null;
    return installed.some((m) => m === model || m.startsWith(model + ':') || m === model + ':latest');
  };

  const onPick = (category: OllamaModelCategory, value: string) => {
    setOllamaModelChoice(category, value === '__default__' ? null : value);
    setChoices(getOllamaModelChoices());
  };

  const onComputePick = (category: OllamaModelCategory, mode: OllamaComputeMode) => {
    setOllamaComputeMode(category, mode);
    setComputeModes(current => ({ ...current, [category]: getOllamaComputeMode(category) }));
  };

  return (
    <div data-testid="ollama-model-picker" className="rounded-md border border-amber-500/30 bg-gray-900/60 p-3">
      <h3 className="text-amber-200 font-semibold mb-1">Which model does each job?</h3>
      <p className="text-xs text-gray-300 mb-2">
        One model per job. Nothing is swapped in behind your back: if the model you pick is not installed, that job fails and says so.
        {installed === 'loading' && ' Checking installed models…'}
        {installed === null && ' Ollama did not answer, so only the catalog is listed.'}
      </p>
      <p className="mb-2 text-xs text-gray-300">CPU only uses system memory instead of graphics memory and can be slower.</p>
      <ul className="space-y-1.5">
        {OLLAMA_MODEL_CATEGORIES.map((category) => {
          const { chosen, resolved } = choices[category];
          const state = isInstalled(resolved);
          return (
            <li key={category} className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`ollama-model-${category}`} className="w-56 shrink-0 text-gray-200">
                {OLLAMA_MODEL_CATEGORY_LABEL[category]}
              </label>
              <select
                id={`ollama-model-${category}`}
                data-testid={`ollama-model-${category}`}
                className="min-w-[14rem] rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-100"
                value={chosen ?? '__default__'}
                onChange={(e) => onPick(category, e.target.value)}
              >
                <option value="__default__">Default · {OLLAMA_CATEGORY_DEFAULT_MODEL[category]}</option>
                {options.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <span>Run on</span>
                <select
                  aria-label={`${OLLAMA_MODEL_CATEGORY_LABEL[category]} processing`}
                  data-testid={`ollama-compute-${category}`}
                  className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-100"
                  value={computeModes[category]}
                  onChange={event => onComputePick(category, event.target.value as OllamaComputeMode)}
                >
                  <option value="auto">Automatic</option>
                  <option value="cpu">CPU only</option>
                </select>
              </label>
              <span
                className={`text-xs ${state === false ? 'text-rose-300' : state === true ? 'text-emerald-300' : 'text-gray-400'}`}
                title={resolved}
              >
                {state === false ? `not installed · ollama pull ${resolved}` : state === true ? 'installed' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default OllamaModelPicker;
