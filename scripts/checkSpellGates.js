// scripts/checkSpellGates.js
// Run with: node scripts/checkSpellGates.js
//
// Purpose: Lightweight report to spot spell migration issues now that spells are V2 JSON-only
// (no spell markdown glossary cards).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANIFEST_PATH = path.join(__dirname, "../public/data/spells_manifest.json");

const loadManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

const looksLikeV2Spell = (json) => {
  if (!json || typeof json !== "object") return false;
  const required = ["id", "name", "level", "school", "classes", "castingTime", "range", "components", "duration", "targeting", "effects", "description"];
  for (const key of required) {
    if (!(key in json)) return false;
  }
  if (!Array.isArray(json.classes)) return false;
  if (!Array.isArray(json.effects)) return false;
  return true;
};

const main = () => {
  const manifest = loadManifest();

  const byLevel = new Map();
  for (const [id, entry] of Object.entries(manifest)) {
    const level = entry.level;
    if (typeof level !== "number") continue;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push({ id, ...entry });
  }

  console.log("=== SPELL GATE CHECK REPORT (JSON-only) ===\n");

  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const list = byLevel.get(level);
    const issues = [];

    for (const item of list) {
      const manifestOk = item.path.includes(`/level-${level}/`);
      const rel = item.path.startsWith("/") ? item.path.slice(1) : item.path;
      const filePath = path.join(__dirname, "../public", rel);
      const exists = fs.existsSync(filePath);

      let schemaOk = false;
      let schemaIssues = [];
      if (exists) {
        try {
          const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          schemaOk = looksLikeV2Spell(json);
          if (!schemaOk) schemaIssues = ["Missing required V2 fields"];
        } catch (e) {
          schemaIssues = [e?.message || String(e)];
        }
      }

      if (!manifestOk || !exists || !schemaOk) {
        issues.push({
          id: item.id,
          name: item.name,
          manifestOk,
          exists,
          schemaOk,
          schemaIssues,
        });
      }
    }

    const levelName = level === 0 ? "CANTRIPS" : `LEVEL ${level}`;
    console.log(`--- ${levelName} (${issues.length} with issues) ---`);
    if (issues.length === 0) {
      console.log("  ✅ All spells pass!\n");
      continue;
    }

    issues.slice(0, 50).forEach((s) => {
      console.log(`  ❌ ${s.name} (${s.id})`);
      if (!s.manifestOk) console.log("      - Manifest path not under correct level");
      if (!s.exists) console.log("      - Spell JSON missing");
      if (s.exists && !s.schemaOk) {
        console.log("      - Schema validation failed");
        s.schemaIssues.forEach((i) => console.log(`        - ${i}`));
      }
    });
    if (issues.length > 50) console.log(`  ...and ${issues.length - 50} more\n`);
    else console.log("");
  }

  console.log("=== END REPORT ===");
};

main();
