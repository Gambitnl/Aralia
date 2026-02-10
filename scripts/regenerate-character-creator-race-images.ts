#!/usr/bin/env tsx
/**
 * Regenerate Character Creator race illustration assets that are:
 * - missing from disk, or
 * - byte-identical duplicates of other referenced race images.
 *
 * This uses the Gemini browser automation (Playwright) via scripts/image-gen-mcp.ts
 * and records sha/status entries into:
 *   public/assets/images/races/race-image-status.json
 *
 * Recommended (Windows):
 *   1) npm run mcp:chrome
 *   2) Log in / clear consent in that Chrome window (profile: .chrome-gemini-profile)
 *   3) cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/regenerate-character-creator-race-images.ts --mode missing"
 *   4) cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/regenerate-character-creator-race-images.ts --mode duplicates"
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateImage, downloadImage, cleanup } from "./image-gen-mcp.ts";

type Gender = "male" | "female";
type Mode = "missing" | "duplicates" | "all";

const ROOT = process.cwd();
const RACES_TS_DIR = path.join(ROOT, "src/data/races");
const GLOSSARY_RACES_DIR = path.join(ROOT, "public/data/glossary/entries/races");
const PUBLIC_DIR = path.join(ROOT, "public");

const STYLE_GUIDELINES = [
  "Full body view, head-to-toe (critical).",
  "Common villager or worker (not an adventurer/hero).",
  "Slice-of-life setting (mundane, not combat).",
  "High-quality D&D 5e canon illustration style.",
  "No text, no UI elements, no watermark.",
];

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function resolvePublicAsset(assetPath: string): string {
  const p = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return path.join(PUBLIC_DIR, p);
}

function parseRaceVisualPaths(tsContent: string): { id?: string; name?: string; description?: string; male?: string; female?: string } {
  const id = tsContent.match(/id:\s*['"]([^'"]+)['"]/i)?.[1];
  const name = tsContent.match(/name:\s*['"]([^'"]+)['"]/i)?.[1];
  const description = tsContent.match(/description:\s*\n?\s*['"]([\s\S]*?)['"],\s*\n/i)?.[1]?.replace(/\s+/g, " ").trim();
  const male = tsContent.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  const female = tsContent.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/i)?.[1];
  return { id, name, description, male, female };
}

function stableHash(input: string): number {
  // Small deterministic hash for stable prompt variation.
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function loadGlossaryIndex(): Map<string, any> {
  const index = new Map<string, any>();
  if (!fs.existsSync(GLOSSARY_RACES_DIR)) return index;

  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith(".json")) {
        try {
          const raw = fs.readFileSync(full, "utf-8");
          const json = JSON.parse(raw);
          if (json && typeof json.id === "string") index.set(json.id, json);
        } catch {
          // ignore invalid json
        }
      }
    }
  };

  walk(GLOSSARY_RACES_DIR);
  return index;
}

function buildPrompt(input: {
  raceId: string;
  gender: Gender;
  raceNameFallback?: string;
  descriptionFallback?: string;
  glossary?: any;
}): string {
  const { raceId, gender, glossary } = input;
  const title = (glossary?.title as string | undefined) || input.raceNameFallback || raceId;
  const lore = glossary?.lore || {};
  const physicalAppearance = typeof lore.physicalAppearance === "string" ? lore.physicalAppearance : "";
  const attire = typeof lore.typicalAttire === "string" ? lore.typicalAttire : "";
  const env = typeof lore.typicalEnvironment === "string" ? lore.typicalEnvironment : "";
  const dwelling = typeof lore.typicalDwelling === "string" ? lore.typicalDwelling : "";
  const assoc = typeof lore.typicalAssociation === "string" ? lore.typicalAssociation : "";
  const society = typeof lore.societyType === "string" ? lore.societyType : "";
  const loreFallback = typeof glossary?.entryLore === "string" ? glossary.entryLore : (input.descriptionFallback || "");

  const seed = stableHash(`${raceId}:${gender}`);
  const activities = [
    "working at a market stall, weighing produce and speaking with customers",
    "repairing a fishing net on a dock, with practical tools laid out nearby",
    "carrying water and supplies along a village path, calm and focused",
    "tending a small workshop bench, crafting or mending everyday items",
    "sweeping a courtyard or temple steps, quiet routine and grounded mood",
    "writing or organizing records at a humble desk, everyday administration",
    "harvesting herbs or mushrooms, carefully sorting bundles into a satchel",
    "loading crates at a caravan stop, practical labor and travel-worn clothes",
  ];
  const lighting = ["soft overcast daylight", "late afternoon sun", "cool morning light", "warm lantern light near dusk"];
  const camera = ["full-body, three-quarter view", "full-body, straight-on", "full-body, slight low-angle", "full-body, candid mid-action pose"];

  const activity = pick(activities, seed);
  const light = pick(lighting, seed >>> 1);
  const cam = pick(camera, seed >>> 2);

  const constraints = STYLE_GUIDELINES.join(" ");
  const details = [
    physicalAppearance && `Physical appearance: ${physicalAppearance}`,
    attire && `Attire: ${attire}`,
    (dwelling || env) && `Setting: ${[env, dwelling].filter(Boolean).join(" ")}`,
    society && `Society/culture: ${society}`,
    assoc && `Vibe: ${assoc}`,
  ].filter(Boolean);

  const loreLine = loreFallback ? `Lore context: ${String(loreFallback).slice(0, 420).trim()}` : "";

  return [
    // Gemini can respond with text unless the intent is explicit.
    `Generate ONE image.`,
    `High-quality fantasy RPG character illustration (D&D 5e canon).`,
    `Subject: a ${gender} ${title}.`,
    constraints,
    `Composition: ${cam}. Lighting: ${light}.`,
    `Slice-of-life action: ${activity}.`,
    loreLine,
    ...details,
    `No text. No UI. No watermark.`,
  ].filter(Boolean).join("\n");
}

function parseArgs(argv: string[]) {
  const out: { mode: Mode; limit: number | null; dryRun: boolean; cooldownMs: number } = {
    mode: "all",
    limit: null,
    dryRun: false,
    cooldownMs: 12_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--mode" && argv[i + 1]) out.mode = argv[++i] as Mode;
    else if (a.startsWith("--mode=")) out.mode = a.split("=", 2)[1] as Mode;
    else if (a === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=", 2)[1]);
    else if (a === "--cooldown-ms" && argv[i + 1]) out.cooldownMs = Number(argv[++i]);
    else if (a.startsWith("--cooldown-ms=")) out.cooldownMs = Number(a.split("=", 2)[1]);
  }

  if (!["missing", "duplicates", "all"].includes(out.mode)) {
    throw new Error(`Invalid --mode: ${out.mode}`);
  }
  if (out.limit !== null && (!Number.isFinite(out.limit) || out.limit <= 0)) {
    throw new Error(`Invalid --limit: ${String(out.limit)}`);
  }
  if (!Number.isFinite(out.cooldownMs) || out.cooldownMs < 0) {
    throw new Error(`Invalid --cooldown-ms: ${String(out.cooldownMs)}`);
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const glossaryIndex = loadGlossaryIndex();

  const tsFiles = fs
    .readdirSync(RACES_TS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "raceGroups.ts")
    .map((f) => path.join(RACES_TS_DIR, f));

  const refs: Array<{
    raceId: string;
    raceNameFallback?: string;
    descriptionFallback?: string;
    gender: Gender;
    assetPath: string;
    absPath: string;
    exists: boolean;
    sha?: string;
  }> = [];

  for (const p of tsFiles) {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = parseRaceVisualPaths(raw);
    if (!parsed.id) continue;

    for (const gender of ["male", "female"] as const) {
      const assetPath = gender === "male" ? parsed.male : parsed.female;
      if (!assetPath) continue;
      const abs = resolvePublicAsset(assetPath);
      const exists = fs.existsSync(abs);
      const sha = exists ? sha256File(abs) : undefined;
      refs.push({
        raceId: parsed.id,
        raceNameFallback: parsed.name,
        descriptionFallback: parsed.description,
        gender,
        assetPath,
        absPath: abs,
        exists,
        sha,
      });
    }
  }

  const shaCounts = new Map<string, number>();
  for (const r of refs) {
    if (!r.sha) continue;
    shaCounts.set(r.sha, (shaCounts.get(r.sha) || 0) + 1);
  }

  const missing = refs.filter((r) => !r.exists);
  const duplicates = refs.filter((r) => r.sha && (shaCounts.get(r.sha) || 0) > 1);

  const targets = args.mode === "missing"
    ? missing
    : args.mode === "duplicates"
      ? duplicates
      : Array.from(new Set([...missing, ...duplicates]));

  const limited = args.limit ? targets.slice(0, args.limit) : targets;

  console.log(`[regen] mode=${args.mode} dryRun=${args.dryRun} limit=${args.limit ?? "none"}`);
  console.log(`[regen] targets=${targets.length} running=${limited.length} missing=${missing.length} duplicates=${duplicates.length}`);

  let ok = 0;
  let fail = 0;

  for (const t of limited) {
    const glossary = glossaryIndex.get(t.raceId);
    const prompt = buildPrompt({
      raceId: t.raceId,
      gender: t.gender,
      raceNameFallback: t.raceNameFallback,
      descriptionFallback: t.descriptionFallback,
      glossary,
    });

    console.log(`\n[regen] ${t.raceId} (${t.gender}) -> ${path.relative(ROOT, t.absPath)}`);
    if (args.dryRun) {
      console.log(prompt);
      ok++;
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(t.absPath), { recursive: true });
      const gen = await generateImage(prompt, "gemini");
      if (!gen.success) {
        console.error(`[regen] generate failed: ${gen.message}`);
        fail++;
        continue;
      }

      // Give the UI a breath before download.
      await new Promise((r) => setTimeout(r, 1500));

      const dl = await downloadImage({
        outputPath: t.absPath,
        race: t.raceId,
        gender: t.gender,
        prompt,
      });
      if (!dl.success) {
        console.error(`[regen] download failed: ${dl.message}`);
        fail++;
        continue;
      }

      ok++;
      if (args.cooldownMs) {
        console.log(`[regen] cooldown ${args.cooldownMs}ms`);
        await new Promise((r) => setTimeout(r, args.cooldownMs));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[regen] error: ${msg}`);
      fail++;
    }
  }

  await cleanup().catch(() => undefined);
  console.log(`\n[regen] done ok=${ok} fail=${fail}`);
  process.exitCode = fail ? 1 : 0;
}

main().catch(async (e) => {
  console.error(`[regen] fatal: ${e instanceof Error ? e.stack || e.message : String(e)}`);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
