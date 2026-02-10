#!/usr/bin/env tsx
/**
 * Lists races that look like "base/parent" entries:
 * - They have at least one other race whose baseRace equals their id.
 * - Optionally they also contain "choice" fields (fiendishLegacies, elvenLineages, etc).
 *
 * This is meant to support decisions like:
 * - keep base race selectable
 * - make base race non-selectable and force variants
 * - keep base race for glossary-only, but hide from character creator
 */

import fs from "fs";
import path from "path";

type RaceInfo = {
  id: string;
  name: string;
  filename: string;
  baseRace?: string;
  choiceFields: string[];
};

const CHOICE_FIELD_KEYS = [
  "elvenLineages",
  "gnomeSubraces",
  "giantAncestryChoices",
  "fiendishLegacies",
  "dragonbornAncestryChoices",
  "dragonmarkVariants",
];

function parseRacesFromTs(): RaceInfo[] {
  const dir = path.join(process.cwd(), "src", "data", "races");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "raceGroups.ts");
  const races: RaceInfo[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const exportMatches = raw.matchAll(/export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g);
    for (const m of exportMatches) {
      const exportIndex = m.index ?? -1;
      if (exportIndex < 0) continue;
      const block = raw.slice(exportIndex);
      if (!block.includes("traits:")) continue;

      const id = block.match(/id:\s*['"]([^'"]+)['"]/i)?.[1];
      const name = block.match(/name:\s*['"]([^'"]+)['"]/i)?.[1];
      const baseRace = block.match(/baseRace:\s*['"]([^'"]+)['"]/i)?.[1];
      if (!id || !name) continue;

      const choiceFields = CHOICE_FIELD_KEYS.filter((k) => new RegExp(`\\b${k}\\s*:`).test(block));

      races.push({ id, name, filename: file, baseRace, choiceFields });
    }
  }

  return races.sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const races = parseRacesFromTs();
  const byId = new Map(races.map((r) => [r.id, r]));

  const childrenByParent = new Map<string, RaceInfo[]>();
  for (const r of races) {
    if (!r.baseRace) continue;
    const arr = childrenByParent.get(r.baseRace);
    if (arr) arr.push(r);
    else childrenByParent.set(r.baseRace, [r]);
  }

  const groupOnlyParents = Array.from(childrenByParent.entries())
    .filter(([parentId]) => !byId.has(parentId))
    .map(([parentId, kids]) => ({ parentId, childCount: kids.length }))
    .sort((a, b) => a.parentId.localeCompare(b.parentId));

  const raceParents = Array.from(childrenByParent.entries())
    .filter(([parentId]) => byId.has(parentId))
    .map(([parentId, kids]) => {
      const parent = byId.get(parentId)!;
      return {
        parentId,
        parentName: parent.name,
        parentFilename: parent.filename,
        parentChoiceFields: parent.choiceFields,
        childIds: kids.map((k) => k.id).sort(),
      };
    })
    .sort((a, b) => a.parentId.localeCompare(b.parentId));

  console.log("BaseRace Parents (two kinds)");
  console.log("===========================");

  console.log("\nGroup-only baseRace IDs (not a Race entry, used for grouping)");
  for (const g of groupOnlyParents) {
    console.log(`- ${g.parentId} (children=${g.childCount})`);
  }

  console.log("\nRace entries that act as parents (need a product decision)");
  for (const p of raceParents) {
    const choices = p.parentChoiceFields.length ? ` choiceFields=[${p.parentChoiceFields.join(", ")}]` : "";
    console.log(`\n- ${p.parentName} (${p.parentId}) file=${p.parentFilename}${choices}`);
    console.log(`  children=${p.childIds.join(", ")}`);
  }
}

main();
