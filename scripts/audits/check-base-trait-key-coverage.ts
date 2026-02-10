#!/usr/bin/env tsx
/**
 * More semantic version of base-trait coverage:
 * - compares by "trait key" (text before the first ':')
 * - treats a parent trait as covered if the child has the same key (even if wording differs)
 * - for keyless traits (no ':'), falls back to exact-string normalized match
 *
 * This answers: "If we remove/hide the base race, do subchoices still include the same trait *types*?"
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

type RaceLike = {
  id: string;
  name: string;
  baseRace?: string;
  traits: string[];
};

const ROOT = process.cwd();
const RACES_DIR = path.join(ROOT, "src", "data", "races");
const PARENTS = ["eladrin", "elf", "goliath", "half_elf", "halfling", "human", "tiefling"] as const;

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"');
}

function traitKey(t: string): string | null {
  const idx = t.indexOf(":");
  if (idx <= 0) return null;
  return norm(t.slice(0, idx)).toLowerCase();
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
      const anyV = value as any;
      if (!anyV || typeof anyV !== "object") continue;
      if (typeof anyV.id !== "string") continue;
      if (typeof anyV.name !== "string") continue;
      if (!Array.isArray(anyV.traits)) continue;
      races.push({
        id: anyV.id,
        name: anyV.name,
        baseRace: typeof anyV.baseRace === "string" ? anyV.baseRace : undefined,
        traits: anyV.traits.map((x: any) => String(x)),
      });
    }
  }

  const byId = new Map<string, RaceLike>();
  for (const r of races) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function parseTraitSet(traits: string[]) {
  const keyed = new Map<string, string[]>(); // key -> full trait strings
  const keyless = new Set<string>();
  for (const t of traits) {
    const k = traitKey(t);
    if (!k) keyless.add(norm(t));
    else {
      const arr = keyed.get(k);
      if (arr) arr.push(t);
      else keyed.set(k, [t]);
    }
  }
  return { keyed, keyless };
}

async function main() {
  const races = await loadAllRaces();
  const byId = new Map(races.map((r) => [r.id, r]));

  const report: any = { generatedAt: new Date().toISOString(), parents: {} };

  for (const parentId of PARENTS) {
    const parent = byId.get(parentId);
    if (!parent) {
      report.parents[parentId] = { error: "parent not found" };
      continue;
    }
    const children = races.filter((r) => r.baseRace === parentId);
    const pSet = parseTraitSet(parent.traits);

    const childReports = children.map((c) => {
      const cSet = parseTraitSet(c.traits);
      const missingKeys: string[] = [];
      for (const k of pSet.keyed.keys()) {
        if (!cSet.keyed.has(k)) missingKeys.push(k);
      }
      const missingKeyless: string[] = [];
      for (const t of pSet.keyless) {
        if (!cSet.keyless.has(t)) missingKeyless.push(t);
      }
      missingKeys.sort();
      missingKeyless.sort();
      return {
        id: c.id,
        name: c.name,
        missingParentTraitKeys: missingKeys,
        missingParentKeylessTraits: missingKeyless,
      };
    });

    const summary = {
      parent: { id: parent.id, name: parent.name, traitCount: parent.traits.length },
      children: {
        count: children.length,
        anyMissingKeys: childReports.some((r) => r.missingParentTraitKeys.length > 0),
        anyMissingKeyless: childReports.some((r) => r.missingParentKeylessTraits.length > 0),
      },
    };

    report.parents[parentId] = { summary, childReports };
  }

  const outPath = path.join(ROOT, "scripts", "audits", "base-trait-key-coverage.report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf-8");

  console.log("Base Trait Key Coverage");
  console.log("=======================");
  for (const parentId of PARENTS) {
    const p = report.parents[parentId];
    if (p.error) {
      console.log(`\n- ${parentId}: ERROR ${p.error}`);
      continue;
    }
    console.log(`\n- ${p.summary.parent.name} (${parentId}) children=${p.summary.children.count} anyMissingKeys=${p.summary.children.anyMissingKeys}`);
    for (const c of p.childReports) {
      if (!c.missingParentTraitKeys.length && !c.missingParentKeylessTraits.length) continue;
      const mk = c.missingParentTraitKeys.length ? `missingKeys=[${c.missingParentTraitKeys.join(", ")}]` : "";
      const mkl = c.missingParentKeylessTraits.length ? `missingKeyless=${c.missingParentKeylessTraits.length}` : "";
      console.log(`  - ${c.id}: ${[mk, mkl].filter(Boolean).join(" ")}`);
    }
  }
  console.log(`\nWrote scripts/audits/base-trait-key-coverage.report.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});

