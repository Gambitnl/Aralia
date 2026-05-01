/**
 * Classifies public/data/spells JSON by DAMAGE effects and damage.type tokens.
 * Output: docs/tasks/spells/damage-type/SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md
 *
 * Run: node scripts/inventory-spell-damage-runtime.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPELLS_DIR = path.join(ROOT, "public", "data", "spells");
const OUT = path.join(
  ROOT,
  "docs",
  "tasks",
  "spells",
  "damage-type",
  "SPELL_DAMAGE_TYPE_RUNTIME_INVENTORY.md",
);

/** PHB-style damage energy + weapon types (PascalCase as used in JSON). */
const KNOWN_SINGLE_DAMAGE_TYPE = new Set([
  "Acid",
  "Bludgeoning",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Thunder",
]);

function listSpellJsonFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name.startsWith("level-")) out.push(...listSpellJsonFiles(p));
    } else if (name.isFile() && name.name.endsWith(".json")) {
      out.push(p);
    }
  }
  return out.sort();
}

function normType(t) {
  if (t === null || t === undefined) return "";
  return String(t).trim();
}

function collectDamageEffects(spell) {
  const effects = Array.isArray(spell.effects) ? spell.effects : [];
  return effects
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e && e.type === "DAMAGE");
}

function classifySpell(spell) {
  const damageRows = collectDamageEffects(spell);
  if (damageRows.length === 0) {
    return { bucket: "no_damage_effect", damageRows: [], samples: [] };
  }

  const samples = [];
  let hasEmpty = false;
  let hasUnknown = false;

  for (const { e, i } of damageRows) {
    const d = e.damage || {};
    const t = normType(d.type);
    samples.push({ effectIndex: i, type: t, dice: normType(d.dice) });
    if (!t) hasEmpty = true;
    else if (!KNOWN_SINGLE_DAMAGE_TYPE.has(t)) hasUnknown = true;
  }

  if (hasEmpty || hasUnknown) {
    return { bucket: "damage_effect_type_needs_attention", damageRows, samples };
  }
  return { bucket: "damage_effect_all_single_known_type", damageRows, samples };
}

function main() {
  const files = listSpellJsonFiles(SPELLS_DIR);
  const byBucket = {
    no_damage_effect: [],
    damage_effect_all_single_known_type: [],
    damage_effect_type_needs_attention: [],
  };

  for (const file of files) {
    let spell;
    try {
      spell = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (!spell.id) continue;
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const c = classifySpell(spell);
    byBucket[c.bucket].push({
      id: spell.id,
      name: spell.name || spell.id,
      level: spell.level,
      file: rel,
      samples: c.samples,
    });
  }

  for (const k of Object.keys(byBucket)) {
    byBucket[k].sort((a, b) => a.id.localeCompare(b.id));
  }

  const nNo = byBucket.no_damage_effect.length;
  const nClean = byBucket.damage_effect_all_single_known_type.length;
  const nFocus = byBucket.damage_effect_type_needs_attention.length;
  const nTotal = nNo + nClean + nFocus;

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const lines = [];
  lines.push("# Runtime spell damage inventory (DAMAGE effects)");
  lines.push("");
  lines.push(`Generated: ${today} (\`scripts/inventory-spell-damage-runtime.mjs\`).`);
  lines.push("");
  lines.push("## Definitions");
  lines.push("");
  lines.push("- **Mechanical damage spell**: spell JSON has ≥1 **top-level effect** with \`effect.type === \"DAMAGE\"\`.");
  lines.push("- **Single known damage type**: for every such row, non-empty \`effect.damage.type\` that matches PHB-like PascalCase tokens: "
    + [...KNOWN_SINGLE_DAMAGE_TYPE].sort().join(', ') + '.');
  lines.push('- **Summon / STATUS / Terrain / etc.** with stray `damage` blobs are ignored unless there is an actual DAMAGE effect.');
  lines.push('');
  lines.push('**Caveat:** Spells whose damage appears only in `description`/summons (`elemental-bane`) have **zero** DAMAGE effects until modeled — they appear under *no_damage_effect*.');
  lines.push('');
  lines.push('## Funnel counts');
  lines.push('');
  lines.push('| Stage | Count | Notes |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| All spell JSON files under \`public/data/spells/level-*\` | ${nTotal} | |`);
  lines.push(`| **No** DAMAGE effect | ${nNo} | Not in mechanical damage-type pipeline for this bucket |`);
  lines.push(`| DAMAGE + every row single known type | ${nClean} | **Filtered out** — no composite / empty type on DAMAGE rows |`);
  lines.push(`| **Remainder** (needs attention) | ${nFocus} | Empty or non-standard \`damage.type\` on at least one DAMAGE row |`);
  lines.push('');
  lines.push('## Remainder — spells to focus on');
  lines.push('');
  lines.push('Each line: `id` — per-DAMAGE-effect `(effectIndex) type="..." dice="..."`.');
  lines.push('');
  for (const row of byBucket.damage_effect_type_needs_attention) {
    const parts = row.samples.map(
      (s) => `(${s.effectIndex}) type="${s.type}" dice="${s.dice}"`,
    );
    lines.push(`- **${row.id}** — ${parts.join('; ')}`);
  }
  lines.push('');
  lines.push('## Reference — no DAMAGE effect (full list)');
  lines.push('');
  lines.push(`Total: **${nNo}** spells. Collapsed for size; use search in editor or re-run script.`);
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand spell ids</summary>');
  lines.push('');
  lines.push('');
  for (const row of byBucket.no_damage_effect) {
    lines.push(`- \`${row.id}\` (${row.file})`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push('## Reference — clean DAMAGE rows (filtered out)');
  lines.push('');
  lines.push(`Total: **${nClean}** spells — each DAMAGE effect uses one known token only.`);
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand spell ids</summary>');
  lines.push('');
  for (const row of byBucket.damage_effect_all_single_known_type) {
    lines.push(`- \`${row.id}\``);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`no DAMAGE: ${nNo}, clean: ${nClean}, needs attention: ${nFocus}`);
}

main();
