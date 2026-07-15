// scripts/spell-icons/cerebras-gen.mjs
//
// Model trial: generate spell-icon SVGs with Cerebras Gemma (gemma-4-31b).
// Writes to public/assets/icons/spells/{id}/c{concept}-v1.svg so the design
// preview picks them up. Text->SVG: the model writes SVG source directly.
//
// Key: Windows Credential Manager "AgentMatrix/Cerebras/CEREBRAS_API_KEY"
//      (or env CEREBRAS_API_KEY). Never printed.
//
//   node scripts/spell-icons/cerebras-gen.mjs            # 10 cantrips x 3 concepts
//   node scripts/spell-icons/cerebras-gen.mjs --spells acid-splash,light
//
// Zero deps: Node built-ins + global fetch.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWinCred } from '../../tools/groq-proxy/proxy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const API = 'https://api.cerebras.ai/v1/chat/completions';
const MODEL = 'gemma-4-31b';

const SCHOOL_HEX = {
  evocation: '#F87171', abjuration: '#60A5FA', conjuration: '#818CF8',
  divination: '#2DD4BF', enchantment: '#F0ABFC', illusion: '#C084FC',
  necromancy: '#34D399', transmutation: '#FBBF24',
};
const hexFor = (s) => SCHOOL_HEX[(s || '').toLowerCase()] || '#94A3B8';

// Three angles, to push the model toward genuinely different compositions.
const CONCEPTS = [
  { n: 1, angle: 'the spell\'s EFFECT in action — the moment it lands, strikes, or unleashes its power' },
  { n: 2, angle: 'the OBJECT, gesture, or material used to cast it — a hand, a focus, a component, a rune being drawn' },
  { n: 3, angle: 'an EMBLEM or aftermath — a bold symbolic mark that stands for the spell, framed differently from a plain circle' },
];

const DEFAULT_CANTRIPS = [
  'acid-splash', 'chill-touch', 'dancing-lights', 'eldritch-blast', 'mage-hand',
  'minor-illusion', 'poison-spray', 'produce-flame', 'ray-of-frost', 'shocking-grasp',
];

function argVal(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const SYSTEM = `You draw icons for a dark-fantasy tabletop RPG, as SVG source code.
Output ONLY one raw <svg> element. No markdown, no code fences, no words before or after.
Rules:
- Root: <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
- Self-contained: no <script>, no <image>, no external references, no fonts.
- Hardcoded hex colors only. Never use currentColor.
- Use gradients and a soft glow (feGaussianBlur) for depth; strong, readable silhouette at small size.
- Depict what the spell DOES — show the effect or subject, not a generic rune.`;

async function findSpellJson(id) {
  for (let lvl = 0; lvl <= 9; lvl++) {
    const p = path.join(REPO, 'public', 'data', 'spells', `level-${lvl}`, `${id}.json`);
    try { return JSON.parse(await readFile(p, 'utf8')); } catch { /* keep looking */ }
  }
  return null;
}

function extractSvg(text) {
  if (!text) return null;
  let t = text.replace(/```(?:svg|xml|html)?/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('<svg');
  const end = t.lastIndexOf('</svg>');
  if (start === -1 || end === -1) return null;
  const svg = t.slice(start, end + 6);
  if (/<script/i.test(svg) || /xlink:href|href="http/i.test(svg)) return null; // reject unsafe
  return svg;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(key, spell, concept) {
  const hex = hexFor(spell.school);
  const user = `Spell: ${spell.name}
School: ${spell.school} (dominant color ${hex} — shade it darker and lighter for depth)
What it does: ${(spell.description || '').slice(0, 500)}

Draw concept ${concept.n} of 3: ${concept.angle}.
Make it distinct from a plain glyph-in-a-circle. Output only the <svg>.`;

  const payload = JSON.stringify({
    model: MODEL,
    temperature: 0.9,
    max_tokens: 3000,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
  });

  // Retry transient failures (429 rate limit, 5xx, network) with backoff.
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1500 * attempt * attempt); // 0, 1.5s, 6s, 13.5s
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: payload,
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        continue; // retry
      }
      const j = await res.json();
      if (!res.ok) return { svg: null, err: `${res.status}: ${JSON.stringify(j).slice(0, 160)}` };
      return { svg: extractSvg(j.choices?.[0]?.message?.content || ''), err: null };
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { svg: null, err: lastErr };
}

async function main() {
  const key = (await readWinCred('AgentMatrix/Cerebras/CEREBRAS_API_KEY')) || process.env.CEREBRAS_API_KEY;
  if (!key) { console.error('No Cerebras key (AgentMatrix/Cerebras/CEREBRAS_API_KEY or env).'); process.exit(1); }
  console.log(`cerebras-gen — model ${MODEL}, key loaded (${key.length} chars)\n`);

  const spellsArg = argVal('--spells');
  const ids = spellsArg ? spellsArg.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_CANTRIPS;

  let ok = 0, fail = 0;
  for (const id of ids) {
    const spell = await findSpellJson(id);
    if (!spell) { console.log(`- ${id}: SKIP (no spell JSON)`); continue; }
    const dir = path.join(REPO, 'public', 'assets', 'icons', 'spells', id);
    await mkdir(dir, { recursive: true });
    const force = process.argv.includes('--force');
    const marks = [];
    for (const concept of CONCEPTS) {
      const slot = `c${concept.n}-v1`;
      const outPath = path.join(dir, `${slot}.svg`);
      if (!force) {
        try { await readFile(outPath); marks.push(`${slot}:kept`); continue; } catch { /* not there, generate */ }
      }
      const { svg, err } = await generate(key, spell, concept);
      if (svg) {
        await writeFile(outPath, svg + '\n');
        marks.push(`${slot}:ok(${svg.length})`);
        ok++;
      } else {
        marks.push(`${slot}:FAIL(${err})`);
        fail++;
      }
      await sleep(900); // gentle pacing between calls
    }
    console.log(`- ${id.padEnd(18)} [${spell.school}] ${marks.join('  ')}`);
  }
  console.log(`\ndone: ${ok} saved, ${fail} failed. Review at design.html?step=icons (filter: has icons).`);
}

main().catch((e) => { console.error('cerebras-gen failed:', e.message); process.exit(1); });
