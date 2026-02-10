#!/usr/bin/env tsx
/**
 * Audits race illustration assets used by the Character Creator.
 *
 * Source of truth for Character Creator images:
 *   src/data/races/*.ts -> visual.maleIllustrationPath / visual.femaleIllustrationPath
 *
 * This script:
 * - lists placeholder usages
 * - lists missing files
 * - detects duplicate image bytes by sha256 across referenced images
 * - (also) detects duplicates across all files in public/assets/images/races
 *
 * Usage:
 *   npx tsx scripts/audits/audit-race-image-bytes.ts
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const RACES_TS_DIR = path.join(ROOT, "src/data/races");
const RACE_IMAGES_DIR = path.join(ROOT, "public/assets/images/races");
const PUBLIC_DIR = path.join(ROOT, "public");
const PLACEHOLDER = "assets/images/Placeholder.jpg";

type Gender = "male" | "female";

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function resolvePublicAsset(assetPath: string): string {
  const p = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  // Character Creator paths usually look like "assets/images/races/Foo.png".
  return path.join(PUBLIC_DIR, p);
}

function parseRaceVisualPaths(tsContent: string): { id?: string; male?: string; female?: string } {
  const id = tsContent.match(/id:\s*['"]([^'"]+)['"]/i)?.[1];
  const male = tsContent.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  const female = tsContent.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  return { id, male, female };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function listAllPngLikeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .map((f) => path.join(dir, f));
}

function main() {
  const tsFiles = fs
    .readdirSync(RACES_TS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "raceGroups.ts")
    .map((f) => path.join(RACES_TS_DIR, f));

  const referenced: Array<{
    raceId: string;
    gender: Gender;
    assetPath: string;
    filePath: string;
    sha256?: string;
    exists: boolean;
    isPlaceholder: boolean;
  }> = [];

  for (const filePath of tsFiles) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseRaceVisualPaths(raw);
    if (!parsed.id) continue;

    for (const gender of ["male", "female"] as const) {
      const assetPath = gender === "male" ? parsed.male : parsed.female;
      if (!assetPath) continue;
      const abs = resolvePublicAsset(assetPath);
      const exists = fs.existsSync(abs);
      const isPlaceholder = assetPath.replaceAll("\\", "/") === PLACEHOLDER;
      const sha = exists && !isPlaceholder ? sha256File(abs) : undefined;
      referenced.push({
        raceId: parsed.id,
        gender,
        assetPath,
        filePath: abs,
        sha256: sha,
        exists,
        isPlaceholder,
      });
    }
  }

  const placeholders = referenced.filter((r) => r.isPlaceholder);
  const missing = referenced.filter((r) => !r.isPlaceholder && !r.exists);
  const hashed = referenced.filter((r) => r.sha256);
  const dupBySha = [...groupBy(hashed, (r) => r.sha256!).entries()]
    .filter(([, hits]) => hits.length > 1)
    .map(([sha, hits]) => ({ sha, hits }));

  const allFiles = listAllPngLikeFiles(RACE_IMAGES_DIR);
  const allHashed = allFiles.map((p) => ({ path: p, sha: sha256File(p) }));
  const allDupes = [...groupBy(allHashed, (x) => x.sha).entries()]
    .filter(([, hits]) => hits.length > 1)
    .map(([sha, hits]) => ({ sha, paths: hits.map((h) => h.path) }));

  const summary = {
    referencedCount: referenced.length,
    placeholderCount: placeholders.length,
    missingCount: missing.length,
    referencedDuplicateShaCount: dupBySha.length,
    folderDuplicateShaCount: allDupes.length,
  };

  console.log("Race Image Byte Audit (Character Creator)");
  console.log("========================================");
  console.log(JSON.stringify(summary, null, 2));

  if (placeholders.length) {
    console.log("\nPlaceholder References");
    for (const r of placeholders) {
      console.log(`- ${r.raceId} (${r.gender}): ${r.assetPath}`);
    }
  }

  if (missing.length) {
    console.log("\nMissing Referenced Files");
    for (const r of missing) {
      console.log(`- ${r.raceId} (${r.gender}): ${r.assetPath} -> ${r.filePath}`);
    }
  }

  if (dupBySha.length) {
    console.log("\nDuplicate Bytes Across Referenced Race Images");
    for (const group of dupBySha) {
      const labels = group.hits.map((h) => `${h.raceId}(${h.gender})`).join(", ");
      console.log(`- sha256 ${group.sha}: ${labels}`);
    }
  } else {
    console.log("\nDuplicate Bytes Across Referenced Race Images: none");
  }

  if (allDupes.length) {
    console.log("\nDuplicate Bytes In public/assets/images/races");
    for (const group of allDupes) {
      console.log(`- sha256 ${group.sha}`);
      for (const p of group.paths) console.log(`  - ${path.relative(ROOT, p)}`);
    }
  } else {
    console.log("\nDuplicate Bytes In public/assets/images/races: none");
  }

  // Also drop a machine-readable snapshot for later diffs.
  const outPath = path.join(ROOT, "scripts/audits/race-image-byte-audit.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    placeholders,
    missing,
    referencedDuplicates: dupBySha,
    folderDuplicates: allDupes,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${path.relative(ROOT, outPath)}`);
}

main();

