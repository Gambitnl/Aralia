/**
 * Honest-failure capture: with Ollama unreachable, generateOpeningSituation must
 * THROW (no canned scene). Points the client at a dead port to simulate "Ollama
 * stopped". Run: node .agent/game-entry-situation/capture-failure.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { OllamaClient } = await import('../../src/services/ollama/client.ts');
const m = await import('../../src/systems/gameEntry/generateOpeningSituation.ts');

const dead = new OllamaClient({ apiBase: 'http://127.0.0.1:59999/api' });
const character = { name: 'Brannoch', race: 'Tiefling', characterClass: 'Warlock', background: 'Charlatan' };
const location = { name: 'Aralia Town Center', biome: 'plains' };

let out;
try {
    await m.generateOpeningSituation(character, location, { client: dead });
    out = 'UNEXPECTED: a situation was returned — that would be a FALLBACK and is forbidden.';
} catch (e) {
    out = [
        'Ollama unreachable (simulated "stopped") → generator behaviour:',
        `  threw: ${e.name}`,
        `  message: ${e.message}`,
        `  instanceof OpeningSituationUnavailableError: ${e instanceof m.OpeningSituationUnavailableError}`,
        '',
        'Result: NO canned scene was produced. The entry gate turns this throw into the',
        'OllamaDependencyModal block + Retry (status=model-unavailable).',
    ].join('\n');
}
console.log(out);
writeFileSync(join(here, 'honest-failure.txt'), out, 'utf8');
