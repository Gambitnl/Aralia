#!/usr/bin/env npx tsx
/**
 * Verify Character Creator race data and Glossary race data are in sync.
 *
 * Checks:
 * - Each selectable CC race has a glossary entry.
 * - Glossary male/female image URLs match CC male/female illustration paths.
 * - Referenced image files exist under /public.
 * - Glossary race index group membership matches expected CC group (baseRace || id).
 */

import fs from "fs";
import path from "path";

interface CcRaceInfo {
  id: string;
  name: string;
  baseRace: string | null;
  malePath: string | null;
  femalePath: string | null;
  sourceFile: string;
}

interface GlossaryRaceInfo {
  id: string;
  maleImageUrl: string | null;
  femaleImageUrl: string | null;
  sourceFile: string;
}

interface Mismatch {
  id: string;
  expectedMale: string | null;
  actualMale: string | null;
  expectedFemale: string | null;
  actualFemale: string | null;
  ccFile: string;
  glossaryFile: string;
}

const ROOT = process.cwd();
const RACES_TS_DIR = path.join(ROOT, "src", "data", "races");
const GLOSSARY_RACES_DIR = path.join(ROOT, "public", "data", "glossary", "entries", "races");
const GLOSSARY_RACE_INDEX_PATH = path.join(ROOT, "public", "data", "glossary", "index", "character_races.json");
const PUBLIC_DIR = path.join(ROOT, "public");

const NON_SELECTABLE_BASE_RACE_IDS = new Set(["elf", "tiefling", "goliath", "eladrin", "dragonborn"]);

function walkJsonFiles(dirPath: string): string[] {
  const out: string[] = [];
  const stack: string[] = [dirPath];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    for (const ent of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && ent.name.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function parseCcRaces(): CcRaceInfo[] {
  const files = fs.readdirSync(RACES_TS_DIR).filter((file) => {
    return file.endsWith(".ts") && file !== "index.ts" && file !== "raceGroups.ts";
  });

  const races: CcRaceInfo[] = [];

  for (const file of files) {
    const fullPath = path.join(RACES_TS_DIR, file);
    const content = fs.readFileSync(fullPath, "utf8");

    const exportMatches = [...content.matchAll(/export\s+const\s+(\w+_DATA):\s*Race\s*=\s*\{/g)];
    if (exportMatches.length === 0) continue;

    for (let i = 0; i < exportMatches.length; i++) {
      const start = exportMatches[i].index!;
      const end = exportMatches[i + 1]?.index ?? content.length;
      const block = content.slice(start, end);

      if (!block.includes("traits:")) continue;

      const idMatch = block.match(/id:\s*['"]([^'"]+)['"]/);
      const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
      if (!idMatch || !nameMatch) continue;

      const id = idMatch[1];
      if (NON_SELECTABLE_BASE_RACE_IDS.has(id)) continue;

      const baseRaceMatch = block.match(/baseRace:\s*['"]([^'"]+)['"]/);
      const malePathMatch = block.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/);
      const femalePathMatch = block.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/);

      races.push({
        id,
        name: nameMatch[1],
        baseRace: baseRaceMatch?.[1] ?? null,
        malePath: malePathMatch?.[1] ?? null,
        femalePath: femalePathMatch?.[1] ?? null,
        sourceFile: path.relative(ROOT, fullPath).replace(/\\/g, "/"),
      });
    }
  }

  const byId = new Map<string, CcRaceInfo>();
  for (const r of races) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseGlossaryRaceEntries() {
  const entries: GlossaryRaceInfo[] = [];
  const byNormalizedId = new Map<string, GlossaryRaceInfo>();

  for (const filePath of walkJsonFiles(GLOSSARY_RACES_DIR)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : null;
    if (!id) continue;

    const entry: GlossaryRaceInfo = {
      id,
      maleImageUrl: typeof data.maleImageUrl === "string" ? data.maleImageUrl : null,
      femaleImageUrl: typeof data.femaleImageUrl === "string" ? data.femaleImageUrl : null,
      sourceFile: path.relative(ROOT, filePath).replace(/\\/g, "/"),
    };
    entries.push(entry);

    const keys = new Set<string>([id, id.replace(/-/g, "_"), id.replace(/_/g, "-")]);
    for (const k of keys) {
      if (!byNormalizedId.has(k)) byNormalizedId.set(k, entry);
    }
  }

  return { entries, byNormalizedId };
}

function readGlossaryRaceIndexGroupMembership(): Map<string, string> {
  const data = JSON.parse(fs.readFileSync(GLOSSARY_RACE_INDEX_PATH, "utf8")) as unknown;
  const groups = Array.isArray(data)
    ? data
    : (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).groups))
      ? ((data as Record<string, unknown>).groups as unknown[])
      : [];
  const raceToGroup = new Map<string, string>();

  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const rawGroupId = typeof (group as Record<string, unknown>).id === "string"
      ? ((group as Record<string, unknown>).id as string)
      : null;
    const groupId = rawGroupId?.startsWith("group_") ? rawGroupId.slice("group_".length) : rawGroupId;
    const subEntries = Array.isArray((group as Record<string, unknown>).subEntries)
      ? ((group as Record<string, unknown>).subEntries as unknown[])
      : [];

    if (!groupId) continue;
    for (const sub of subEntries) {
      if (!sub || typeof sub !== "object") continue;
      const subId = typeof (sub as Record<string, unknown>).id === "string"
        ? ((sub as Record<string, unknown>).id as string)
        : null;
      if (subId) raceToGroup.set(subId, groupId);
    }
  }

  return raceToGroup;
}

function pathExistsUnderPublic(urlOrPath: string | null): boolean {
  if (!urlOrPath) return false;
  const rel = urlOrPath.startsWith("/") ? urlOrPath.slice(1) : urlOrPath;
  return fs.existsSync(path.join(PUBLIC_DIR, rel));
}

function main() {
  const ccRaces = parseCcRaces();
  const { entries: glossaryEntries, byNormalizedId } = parseGlossaryRaceEntries();
  const raceToGroup = readGlossaryRaceIndexGroupMembership();

  const missingGlossary: string[] = [];
  const imagePathMismatches: Mismatch[] = [];
  const missingImageFiles: Array<{ id: string; path: string }> = [];
  const missingGroupMembership: Array<{ id: string; expectedGroup: string }> = [];
  const wrongGroupMembership: Array<{ id: string; expectedGroup: string; actualGroup: string }> = [];

  for (const cc of ccRaces) {
    const glossary = byNormalizedId.get(cc.id) ?? byNormalizedId.get(cc.id.replace(/_/g, "-"));

    if (!glossary) {
      missingGlossary.push(cc.id);
      continue;
    }

    const expectedMale = cc.malePath ? `/${cc.malePath}` : null;
    const expectedFemale = cc.femalePath ? `/${cc.femalePath}` : null;

    if (expectedMale !== glossary.maleImageUrl || expectedFemale !== glossary.femaleImageUrl) {
      imagePathMismatches.push({
        id: cc.id,
        expectedMale,
        actualMale: glossary.maleImageUrl,
        expectedFemale,
        actualFemale: glossary.femaleImageUrl,
        ccFile: cc.sourceFile,
        glossaryFile: glossary.sourceFile,
      });
    }

    const expectedGroup = cc.baseRace ?? cc.id;
    const actualGroup = raceToGroup.get(cc.id) ?? raceToGroup.get(cc.id.replace(/_/g, "-")) ?? null;
    if (!actualGroup) {
      missingGroupMembership.push({ id: cc.id, expectedGroup });
    } else if (actualGroup !== expectedGroup) {
      wrongGroupMembership.push({ id: cc.id, expectedGroup, actualGroup });
    }

    const candidatePaths = [cc.malePath, cc.femalePath, glossary.maleImageUrl, glossary.femaleImageUrl];
    for (const p of candidatePaths) {
      if (!p) continue;
      if (!pathExistsUnderPublic(p)) {
        const rel = p.startsWith("/") ? p : `/${p}`;
        missingImageFiles.push({ id: cc.id, path: rel });
      }
    }
  }

  const uniqueMissingImageFiles: Array<{ id: string; path: string }> = [];
  const seen = new Set<string>();
  for (const item of missingImageFiles) {
    const k = `${item.id}|${item.path}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueMissingImageFiles.push(item);
  }

  const summary = {
    characterCreatorRaceCount: ccRaces.length,
    glossaryRaceEntryCount: glossaryEntries.length,
    missingGlossaryCount: missingGlossary.length,
    imagePathMismatchCount: imagePathMismatches.length,
    missingImageFileCount: uniqueMissingImageFiles.length,
    missingGroupMembershipCount: missingGroupMembership.length,
    wrongGroupMembershipCount: wrongGroupMembership.length,
  };

  console.log(JSON.stringify({
    summary,
    missingGlossary,
    imagePathMismatches,
    missingGroupMembership,
    wrongGroupMembership,
    missingImageFiles: uniqueMissingImageFiles,
  }, null, 2));

  if (
    missingGlossary.length > 0 ||
    imagePathMismatches.length > 0 ||
    uniqueMissingImageFiles.length > 0 ||
    missingGroupMembership.length > 0 ||
    wrongGroupMembership.length > 0
  ) {
    process.exitCode = 1;
  }
}

main();
