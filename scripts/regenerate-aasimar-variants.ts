#!/usr/bin/env tsx
/**
 * Regenerate Aasimar variant (Fallen/Protector/Scourge) race images (male/female)
 * using the Gemini browser automation.
 *
 * Outputs overwrite the paths referenced by:
 * - src/data/races/fallen_aasimar.ts
 * - src/data/races/protector_aasimar.ts
 * - src/data/races/scourge_aasimar.ts
 */

import * as fs from "fs";
import * as path from "path";
import { doctorGeminiCDP, generateImage, downloadImage, startNewGeminiChat } from "./image-gen-mcp.ts";

type VariantId = "fallen_aasimar" | "protector_aasimar" | "scourge_aasimar";
type Gender = "male" | "female";

const ROOT = process.cwd();
const VARIANTS_DIR = path.resolve(ROOT, "public/data/glossary/entries/races/aasimar_variants");
const OUT_DIR = path.resolve(ROOT, "public/assets/images/races");

const VARIANTS: Array<{
  id: VariantId;
  json: string;
  outMale: string;
  outFemale: string;
  vibe: string;
}> = [
  {
    id: "fallen_aasimar",
    json: "fallen.json",
    outMale: "Aasimar_Fallen_Male.png",
    outFemale: "Aasimar_Fallen_Female.png",
    vibe: "Somber, ominous, corrupted celestial. Skeletal, ghostly, flightless wings hinted. Aura of dread. Ashen tones.",
  },
  {
    id: "protector_aasimar",
    json: "protector.json",
    outMale: "Aasimar_Protector_Male.png",
    outFemale: "Aasimar_Protector_Female.png",
    vibe: "Noble, compassionate guardian of light. Subtle inner glow. Luminous incorporeal wings hinted. White/gold accents.",
  },
  {
    id: "scourge_aasimar",
    json: "scourge.json",
    outMale: "Aasimar_Scourge_Male.png",
    outFemale: "Aasimar_Scourge_Female.png",
    vibe: "Intense, blazing divine energy. Radiant heat shimmering. Controlled fury. Bright core with warm oranges/whites.",
  },
];

interface RaceVariantJson {
  id: string;
  title: string;
  entryLore?: string;
  lore?: {
    typicalDwelling?: string;
    typicalAttire?: string;
    typicalEnvironment?: string;
    societyType?: string;
    typicalAssociation?: string;
    physicalAppearance?: string;
  };
  tags?: string[];
}

function readVariantJson(file: string): RaceVariantJson {
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as RaceVariantJson;
}

function clampText(text: string, max: number): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max).trim() : s;
}

type ImageBrief = {
  setting: string;
  role: string;
  action: string;
  prop: string;
  wardrobe: string;
  physicalMarkers: string;
};

function pickFrom(parts: Array<string | undefined>, fallback: string): string {
  for (const p of parts) {
    const s = clampText(p || "", 500);
    if (s) return s;
  }
  return fallback;
}

function deriveBrief(data: RaceVariantJson, variantId: VariantId, gender: Gender): ImageBrief {
  const lore = data.lore || {};

  // Use different lore fields per gender to naturally diversify locations.
  const settingSource =
    gender === "male"
      ? pickFrom([lore.typicalEnvironment, lore.typicalDwelling], "A quiet village street in daylight")
      : pickFrom([lore.typicalDwelling, lore.typicalEnvironment], "A simple interior room in a village home");

  const wardrobe = pickFrom([lore.typicalAttire], "Simple, practical commoner clothing suitable for daily work");

  const physicalMarkers = clampText(lore.physicalAppearance || "", 520);

  const vibesText = `${variantId} ${data.title || "Aasimar"} ${gender}`.toLowerCase() + " " +
    clampText(lore.typicalAssociation || "", 240).toLowerCase() + " " +
    clampText(lore.societyType || "", 240).toLowerCase() + " " +
    clampText(settingSource || "", 240).toLowerCase();

  // Role/action/prop: lightweight inference from the race's own lore text.
  let role = "common village worker";
  let action = "doing a simple everyday task";
  let prop = "a small work item";

  const pick = (a: [string, string, string], b: [string, string, string]) => (gender === "male" ? a : b);

  if (/\btemple\b|\bshrine\b|\bprayer\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["shrine caretaker", "lighting a small candle at a stone altar", "a small candle and tinderbox"],
      ["temple helper", "carrying fresh water to wash the steps", "a bowl of clean water"]
    );
  } else if (/\bapothecary\b|\bherb\b|\bheal\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["village healer", "sorting herbs on a small table", "a bundle of herbs"],
      ["herbalist", "mixing a simple salve", "a small mortar and pestle"]
    );
  } else if (/\bmarket\b|\bstall\b|\bbazaar\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["market porter", "carrying supplies between stalls", "a small crate of produce"],
      ["market vendor", "arranging bread or fruit at a stall", "a basket of bread"]
    );
  } else if (/\bforge\b|\bsmith\b|\btools\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["artisan blacksmith", "adjusting metal with tongs near a warm forge", "metal tongs (work tool)"],
      ["workshop assistant", "polishing a metal fitting on a bench", "a cloth and small metal fitting"]
    );
  } else if (/\balley\b|\burban\b|\bshadowy\b|\boutcast\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["night watchman", "holding a lantern while checking a doorway", "a lantern"],
      ["wandering scribe", "reading a note while walking", "a satchel of papers"]
    );
  } else if (/\bruins\b|\babandoned\b|\bcursed\b/.test(vibesText)) {
    [role, action, prop] = pick(
      ["ruins scavenger", "carrying salvage carefully", "a small bundle of scrap"],
      ["pilgrim", "holding a simple charm while walking", "a small wooden charm"]
    );
  } else {
    [role, action, prop] = pick(
      ["field laborer", "carrying a sack of grain", "a sack of grain"],
      ["village baker", "carrying bread wrapped in cloth", "a wrapped loaf of bread"]
    );
  }

  // Force each variant to lean into a distinct slice-of-life scene even if the lore text is broad.
  const variantSceneHint =
    variantId === "fallen_aasimar"
      ? "The scene should feel lonely and slightly unsettling, but still mundane."
      : variantId === "protector_aasimar"
      ? "The scene should feel warm and peaceful, with gentle light."
      : "The scene should feel energetic and bright, with a hint of contained radiance.";

  const setting = `${clampText(settingSource, 320)}. ${variantSceneHint}`;

  return { setting, role, action, prop, wardrobe, physicalMarkers };
}

function buildPrompt(data: RaceVariantJson, gender: Gender, vibe: string, brief: ImageBrief): string {
  const lore = clampText(data.entryLore || "", 260);
  const tags = Array.isArray(data.tags) ? data.tags.filter((t) => t && t !== "race").slice(0, 4).join(", ") : "";

  // Style target (per codebase IMAGE_GUIDELINES):
  // - Full body head-to-toe
  // - Common villager/worker (NOT adventurer/hero)
  // - Slice-of-life (mundane, not combat)
  // - D&D 5e canon illustration
  // - No text/UI/watermark
  return [
    "High fantasy Dungeons and Dragons character illustration.",
    "Full body view, head to toe, single character, consistent framing.",
    "Subject is a common villager or worker (not an adventurer or hero).",
    "No weapons. No armor. No spell effects. No combat stance.",
    "Slice-of-life mood: mundane daily life. The character should be shown mid-task (hands interacting with a simple prop).",
    `Role: ${brief.role}.`,
    `Action: ${brief.action}.`,
    `Prop: ${brief.prop}.`,
    `Wardrobe: ${brief.wardrobe}.`,
    "Art style: high-quality D&D 5e canon illustration, professional TTRPG art, sharp focus.",
    `Slice-of-life setting: ${brief.setting}. The environment should be clearly readable (not abstract), but not cluttered.`,
    "Lighting: dramatic but readable. No text. No UI. No watermark.",
    `Gender: ${gender}.`,
    `Race: ${data.title || "Aasimar"}.`,
    vibe ? `Mood: ${vibe}` : "",
    lore ? `Lore: ${lore}` : "",
    brief.physicalMarkers ? `Physical markers: ${brief.physicalMarkers}` : "",
    tags ? `Tags: ${tags}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function regenOne(variant: (typeof VARIANTS)[number], gender: Gender) {
  const jsonPath = path.join(VARIANTS_DIR, variant.json);
  const data = readVariantJson(jsonPath);

  const outName = gender === "male" ? variant.outMale : variant.outFemale;
  const outPath = path.join(OUT_DIR, outName);

  const brief = deriveBrief(data, variant.id, gender);
  const prompt = buildPrompt(data, gender, variant.vibe, brief);
  console.log(`\n[aasimar] ${variant.id} ${gender} -> ${outName}`);

  const gen = await generateImage(prompt, "gemini");
  if (!gen?.success) {
    throw new Error(`Generation failed: ${gen?.message || "unknown error"}`);
  }

  const dl = await downloadImage({ outputPath: outPath, race: variant.id, gender, prompt });
  if (!dl?.success || !fs.existsSync(outPath)) {
    throw new Error(`Download failed: ${dl?.message || "unknown error"} (expected ${outPath})`);
  }

  // Critical: reset conversation context so Gemini doesn't keep "touching up" the same scene.
  await startNewGeminiChat().catch(() => undefined);

  const stat = fs.statSync(outPath);
  console.log(`[aasimar] saved ${outName} (${stat.size} bytes)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Prefer the Gemini "app" session via debug Chrome (CDP).
  process.env.IMAGE_GEN_USE_CDP = process.env.IMAGE_GEN_USE_CDP || "1";
  process.env.IMAGE_GEN_CDP_URL = process.env.IMAGE_GEN_CDP_URL || "http://localhost:9222";

  const doctor = await doctorGeminiCDP({
    cdpUrl: process.env.IMAGE_GEN_CDP_URL,
    attemptConsent: true,
    openIfMissing: true,
  });
  if (!doctor.ok) {
    throw new Error(`[aasimar] Gemini is not ready (${doctor.stage}): ${doctor.message}`);
  }

  for (const v of VARIANTS) {
    await regenOne(v, "male");
    await new Promise((r) => setTimeout(r, 2500));
    await regenOne(v, "female");
    await new Promise((r) => setTimeout(r, 8000)); // cooldown to reduce rate limits
  }

  console.log("\n[aasimar] done");
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
