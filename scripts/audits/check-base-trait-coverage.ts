#!/usr/bin/env tsx
/**
 * Checks whether "parent/base" races contain traits that are missing from their child races.
 * This is important before hiding/removing parent races from Character Creator.
 *
 * Parents checked (hardcoded to match current discussion):
 * - eladrin, elf, goliath, half_elf, halfling, human, tiefling
 *
 * Child relationship:
 * - child.baseRace === parent.id
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

type RaceLike = {
  id: string;
  name: string;
  baseRace?: string;
  traits?: string[];
  // other fields ignored
};

const ROOT = process.cwd();
const RACES_DIR = path.join(ROOT, "src", "data", "races");

const PARENTS = ["eladrin", "elf", "goliath", "half_elf", "halfling", "human", "tiefling"] as const;

function normalizeTrait(t: string): string {
  return String(t ?? "")
    .trim()
    .replace(/\s+/g, " ")
    // normalize "smart quotes" variants that sometimes leak in
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"');
}

async function loadAllRaces(): Promise<RaceLike[]> {
  const files = fs
    .readdirSync(RACES_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "raceGroups.ts");

  const races: RaceLike[] = [];

  for (const file of files) {
    const abs = path.join(RACES_DIR, file);
    const mod = await import(pathToFileURL(abs).href);
    for (const value of Object.values(mod)) {
      if (!value || typeof value !== "object") continue;
      const anyV = value as any;
      if (typeof anyV.id !== "string") continue;
      if (typeof anyV.name !== "string") continue;
      if (!Array.isArray(anyV.traits)) continue;
      races.push({
        id: anyV.id,
        name: anyV.name,
        baseRace: typeof anyV.baseRace === "string" ? anyV.baseRace : undefined,
        traits: anyV.traits,
      });
    }
  }

  // de-dupe by id (should be unique)
  const byId = new Map<string, RaceLike>();
  for (const r of races) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) if (!b.has(x)) out.push(x);
  return out.sort();
}

async function main() {
  const races = await loadAllRaces();
  const byId = new Map(races.map((r) => [r.id, r]));

  const report: any = {
    generatedAt: new Date().toISOString(),
    parents: {},
  };

  for (const parentId of PARENTS) {
    const parent = byId.get(parentId);
    if (!parent) {
      report.parents[parentId] = { error: "parent race not found" };
      continue;
    }

    const children = races.filter((r) => r.baseRace === parentId);
    const parentTraits = new Set((parent.traits || []).map(normalizeTrait).filter(Boolean));

    const childReports = children
      .map((child) => {
        const childTraits = new Set((child.traits || []).map(normalizeTrait).filter(Boolean));
        const missing = setDiff(parentTraits, childTraits);
        return {
          id: child.id,
          name: child.name,
          missingParentTraitsCount: missing.length,
          missingParentTraits: missing,
        };
      })
      .sort((a, b) => b.missingParentTraitsCount - a.missingParentTraitsCount || a.id.localeCompare(b.id));

    const anyMissing = childReports.some((c) => c.missingParentTraitsCount > 0);

    report.parents[parentId] = {
      parent: { id: parent.id, name: parent.name, parentTraitsCount: parentTraits.size },
      children: { count: children.length, anyMissing },
      childReports,
    };
  }

  const outPath = path.join(ROOT, "scripts", "audits", "base-trait-coverage.report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf-8");

  console.log("Base Trait Coverage Report");
  console.log("=========================");
  for (const parentId of PARENTS) {
    const p = report.parents[parentId];
    if (p?.error) {
      console.log(`\n- ${parentId}: ERROR ${p.error}`);
      continue;
    }
    console.log(`\n- ${p.parent.name} (${parentId}) parentTraits=${p.parent.parentTraitsCount} children=${p.children.count} anyMissing=${p.children.anyMissing}`);
    for (const c of p.childReports) {
      if (c.missingParentTraitsCount === 0) continue;
      console.log(`  - child ${c.id}: missing ${c.missingParentTraitsCount}`);
    }
  }
  console.log(`\nWrote scripts/audits/base-trait-coverage.report.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});

