#!/usr/bin/env tsx
/**
 * Compares Character Creator races (src/data/races/*.ts) with glossary race entry files
 * under public/data/glossary/entries/races/ (recursive).
 *
 * This is a raw ID comparison (no aliasing rules): useful for finding entries that exist
 * in only one system.
 */

import fs from "fs";
import path from "path";

function listRaceIdsFromTs(): string[] {
  const dir = path.join(process.cwd(), "src", "data", "races");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "raceGroups.ts");
  const ids: string[] = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf-8");
    // Only consider actual Race exports in this file.
    // This avoids picking up helper bundles (e.g., FIENDISH_LEGACIES_DATA) that also contain "id:".
    const exportMatches = raw.matchAll(/export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g);
    for (const m of exportMatches) {
      const exportIndex = m.index ?? -1;
      if (exportIndex < 0) continue;
      const block = raw.slice(exportIndex);
      // Race blocks must have traits.
      if (!block.includes("traits:")) continue;
      const id = block.match(/id:\s*['"]([^'"]+)['"]/i)?.[1];
      if (id) ids.push(id);
    }
  }
  return Array.from(new Set(ids)).sort();
}

function listRaceIdsFromGlossary(): string[] {
  const root = path.join(process.cwd(), "public", "data", "glossary", "entries", "races");
  const ids: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith(".json")) {
        try {
          const json = JSON.parse(fs.readFileSync(full, "utf-8"));
          if (json && typeof json.id === "string") ids.push(json.id);
        } catch {
          // ignore
        }
      }
    }
  };
  walk(root);
  return Array.from(new Set(ids)).sort();
}

function main() {
  const ts = listRaceIdsFromTs();
  const gl = listRaceIdsFromGlossary();

  const tsSet = new Set(ts);
  const glSet = new Set(gl);

  const onlyTs = ts.filter((id) => !glSet.has(id));
  const onlyGl = gl.filter((id) => !tsSet.has(id));

  console.log("Race ID Diff (raw IDs, no aliasing)");
  console.log("===================================");
  console.log(JSON.stringify({ characterCreator: ts.length, glossary: gl.length, onlyCharacterCreator: onlyTs.length, onlyGlossary: onlyGl.length }, null, 2));

  if (onlyTs.length) {
    console.log("\nOnly In Character Creator (src/data/races/*.ts)");
    for (const id of onlyTs) console.log(`- ${id}`);
  }

  if (onlyGl.length) {
    console.log("\nOnly In Glossary (public/data/glossary/entries/races/**/*.json)");
    for (const id of onlyGl) console.log(`- ${id}`);
  }
}

main();
