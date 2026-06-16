/**
 * Render-and-eyeball capture for GAME-ENTRY-SITUATION.
 *
 * Runs the REAL generateOpeningSituation against the live local Ollama twice with
 * the SAME character + place, and writes both results. Two different openings ⇒
 * the opening is truly non-deterministic (not seed-pinned, not templated).
 *
 * Run: node .agent/game-entry-situation/capture-openings.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Import via tsx loader so the TS source is used directly.
const { OllamaClient } = await import('../../src/services/ollama/client.ts');
const { generateOpeningSituation } = await import('../../src/systems/gameEntry/generateOpeningSituation.ts');

// Point a client straight at the local Ollama (bypassing the vite proxy).
const client = new OllamaClient({ apiBase: 'http://localhost:11434/api' });

const character = { name: 'Brannoch', race: 'Tiefling', characterClass: 'Warlock', background: 'Charlatan' };
const location = { name: 'Aralia Town Center', biome: 'plains' };

function render(label, s) {
    const lines = [];
    lines.push(`=== ${label} ===`);
    lines.push(`Setting : ${s.setting.place} | ${s.setting.timeOfDay} | ${s.setting.weather}`);
    lines.push(`Predicament: ${s.predicament}`);
    lines.push('NPCs:');
    for (const n of s.npcs) lines.push(`  - ${n.name} (${n.role}) — ${n.disposition}; wants: ${n.goal}`);
    const speaker = s.npcs.find((n) => n.id === s.openingLine.speakerId);
    lines.push(`Opening line (${speaker ? speaker.name : s.openingLine.speakerId}): "${s.openingLine.text}"`);
    if (s.suggestedReplies) lines.push(`Suggested replies: ${s.suggestedReplies.map((r) => `"${r}"`).join('  ')}`);
    return lines.join('\n');
}

const a = await generateOpeningSituation(character, location, { client });
const b = await generateOpeningSituation(character, location, { client });

const out = [
    `Character: ${character.name} the ${character.race} ${character.characterClass} (${character.background})`,
    `Place: ${location.name}`,
    '',
    render('RUN A', a),
    '',
    render('RUN B', b),
    '',
    `Predicaments differ: ${a.predicament !== b.predicament}`,
].join('\n');

console.log(out);
writeFileSync(join(here, 'openings-capture.txt'), out, 'utf8');
console.log('\nWrote', join(here, 'openings-capture.txt'));
