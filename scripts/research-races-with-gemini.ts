#!/usr/bin/env npx tsx
/**
 * Research race profiles using Gemini Web (CDP) and write one markdown file per race.
 *
 * This script is intentionally separate from image generation to avoid breaking
 * existing portrait regen workflows.
 *
 * Usage:
 *   cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/research-races-with-gemini.ts --race-id giff"
 *   cmd.exe /c "set IMAGE_GEN_USE_CDP=1&& npx tsx scripts/research-races-with-gemini.ts --all --limit 3"
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { doctorGeminiCDP, ensureBrowser, startNewGeminiChat } from "./image-gen-mcp";

type RaceIndexEntry = {
  id: string;
  title: string;
  filePath: string | null;
};

type ProfileQuestion = {
  id: string;
  question: string;
};

type ResearchStatusEntry = {
  timestamp: string;
  raceId: string;
  raceName: string;
  outputPath: string;
  success: boolean;
  attempts: number;
  responseChars: number;
  sourceUrlCount: number;
  promptHash: string;
  message: string;
};

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "public", "data", "glossary", "index", "character_races.json");
const DEFAULT_PROFILE_QUESTIONS_PATH = path.join(
  ROOT,
  "scripts",
  "audits",
  "qa-batches",
  "RACE_PROFILE_QUESTIONS.md",
);
const DEFAULT_OUT_DIR = path.join(ROOT, "docs", "portraits", "race_profiles");
const DEFAULT_STATUS_PATH = path.join(DEFAULT_OUT_DIR, "research-status.json");

const INPUT_SELECTORS = [
  'div[contenteditable="true"]',
  'textarea[aria-label*="prompt" i]',
  ".ql-editor",
  "rich-textarea",
  '[data-placeholder*="Enter" i]',
];
const RESPONSE_SELECTORS = [".markdown", ".model-response-text"];
const TOOLS_TRIGGER_SELECTORS = [
  'button:has-text("Tools")',
  '[role="button"]:has-text("Tools")',
  'button[aria-label*="Tools" i]',
  '[aria-label*="Tool" i]',
];
const DEEP_RESEARCH_SELECTORS = [
  'button:has-text("Deep Research")',
  '[role="button"]:has-text("Deep Research")',
  '[role="menuitem"]:has-text("Deep Research")',
  '[role="option"]:has-text("Deep Research")',
  'button[aria-label*="Deep Research" i]',
  '[role="button"][aria-label*="Deep Research" i]',
  "li:has-text(\"Deep Research\")",
];
const RESPONSE_POLL_MS = 5_000;
const START_RESEARCH_SELECTORS = [
  'button:has-text("Start research")',
  '[role="button"]:has-text("Start research")',
];
const CREATE_REPORT_SELECTORS = [
  'button:has-text("Create report")',
  '[role="button"]:has-text("Create report")',
];
const NEW_CHAT_POPUP_BUTTON_SELECTORS = [
  'button:has-text("Start new chat")',
  'button:has-text("Got it")',
  'button:has-text("Close")',
  'button[aria-label*="Close" i]',
];

const DEFAULT_TIMEOUT_MS = (() => {
  const raw = String(process.env.GEMINI_RESEARCH_TIMEOUT_MS || "").trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_200_000;
})();

const DEFAULT_MAX_ATTEMPTS = 3;
type DeepResearchMode = "required" | "optional" | "off";
type GeminiStepState = {
  promptInputVisible: boolean;
  likelyFreshChat: boolean;
  userQueryCount: number;
  newChatRequirementPopupVisible: boolean;
  deepResearchSelected: boolean;
  startResearchVisible: boolean;
  createReportVisible: boolean;
};
type ResearchControlsState = {
  startResearchVisible: boolean;
  startResearchDisabled: boolean;
  createReportVisible: boolean;
  createReportDisabled: boolean;
};

function parseFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function loadProfileQuestions(filePath: string): ProfileQuestion[] {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const questions = lines
    .map((line) => {
      const match = line.match(/^\s*(\d+)\.\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        idx: Number.parseInt(match[1], 10),
        question: match[2].trim(),
      };
    })
    .filter((row): row is { idx: number; question: string } => row !== null)
    .sort((a, b) => a.idx - b.idx)
    .map((row) => ({ id: `q${row.idx}`, question: row.question }));

  if (questions.length !== 10) {
    throw new Error(`Expected 10 profile questions in ${filePath}, found ${questions.length}.`);
  }
  return questions;
}

function flattenRaceEntries(raw: unknown): RaceIndexEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RaceIndexEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : id;
    const filePath = typeof row.filePath === "string" ? row.filePath : null;
    if (id && filePath) out.push({ id, title, filePath });

    const subEntries = Array.isArray(row.subEntries) ? row.subEntries : [];
    for (const sub of subEntries) {
      if (!sub || typeof sub !== "object") continue;
      const sr = sub as Record<string, unknown>;
      const sid = typeof sr.id === "string" ? sr.id.trim() : "";
      const stitle = typeof sr.title === "string" ? sr.title.trim() : sid;
      const sfilePath = typeof sr.filePath === "string" ? sr.filePath : null;
      if (!sid || !sfilePath) continue;
      out.push({ id: sid, title: stitle, filePath: sfilePath });
    }
  }

  const dedup = new Map<string, RaceIndexEntry>();
  for (const row of out) {
    if (!dedup.has(row.id)) dedup.set(row.id, row);
  }
  return [...dedup.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function toTitleFromId(raceId: string): string {
  return raceId
    .split(/[_-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function readRaceContext(glossaryFilePath: string | null): string {
  if (!glossaryFilePath) return "";
  const rel = glossaryFilePath.replace(/^\/+/, "").replace(/\//g, path.sep);
  const abs = path.join(ROOT, "public", rel);
  if (!fs.existsSync(abs)) return "";

  try {
    const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
    const entryLore = typeof raw.entryLore === "string" ? raw.entryLore.trim() : "";
    const source = typeof raw.source === "string" ? raw.source.trim() : "";
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((v): v is string => typeof v === "string") : [];
    const lore = raw.lore && typeof raw.lore === "object" ? (raw.lore as Record<string, unknown>) : {};
    const societyType = typeof lore.societyType === "string" ? lore.societyType.trim() : "";
    const typicalEnvironment = typeof lore.typicalEnvironment === "string" ? lore.typicalEnvironment.trim() : "";

    const parts = [
      entryLore ? `entryLore: ${entryLore}` : "",
      source ? `sourceBook: ${source}` : "",
      tags.length ? `tags: ${tags.join(", ")}` : "",
      societyType ? `societyType: ${societyType}` : "",
      typicalEnvironment ? `typicalEnvironment: ${typicalEnvironment}` : "",
    ].filter(Boolean);

    return parts.join("\n");
  } catch {
    return "";
  }
}

function buildResearchPrompt(
  raceId: string,
  raceName: string,
  questions: ProfileQuestion[],
  contextSnippet: string,
): string {
  const questionLines = questions.map((q, idx) => `${idx + 1}. (${q.id}) ${q.question}`).join("\n");
  const contextBlock = contextSnippet
    ? `\nCandidate internal context to cross-check (may be stale; verify externally):\n${contextSnippet}\n`
    : "";

  return [
    `You are a senior RPG lore researcher writing a world-agnostic race dossier for "${raceName}" (${raceId}).`,
    "",
    "Research mode requirements:",
    "- Perform live web research before drafting. Use Gemini's Deep Research workflow if available.",
    "- Cross-check multiple sources and resolve contradictions when possible.",
    "- Use source material internally for accuracy, but do not expose or cite sources in the final output.",
    "",
    "Content constraints:",
    "- Keep this generalized for procedural world generation.",
    "- Do not anchor to named cities, kingdoms, nations, or timeline-specific events.",
    "- Avoid setting-locked proper nouns unless unavoidable for origin context; generalize them when possible.",
    "- Write concise wiki-like prose with a light narrative flow (not a novel).",
    "- The final text must read as an informational lore article, not a questionnaire.",
    "- Do not include source references, citations, bibliography, or links.",
    "- Do not include URLs.",
    "- Do not use bullet lists or numbered lists.",
    "- Do not use tables.",
    "",
    "Output format (markdown only):",
    "1) # <Race Name>",
    "2) 4-7 thematic section headings with prose paragraphs under each heading.",
    "3) Optional final section for character-play hooks in prose form.",
    "4) No list syntax, no tables, no links, no citations.",
    "",
    "Required themes to cover naturally in prose (do not label them as Q1..Q10):",
    questionLines,
    "",
    "Quality bar:",
    "- Prefer official/primary sources first, then reputable references during research.",
    "- If sources disagree, reconcile in prose without citing the sources.",
    "- Keep claims specific but setting-generalized.",
    contextBlock,
    "Return markdown only.",
  ].join("\n");
}

function buildStyleCorrectionPrompt(
  raceId: string,
  raceName: string,
  questions: ProfileQuestion[],
  contextSnippet: string,
  reasonHint?: string,
): string {
  const base = buildResearchPrompt(raceId, raceName, questions, contextSnippet);
  const hint = reasonHint ? `\nPrevious failure mode to correct: ${reasonHint}` : "";
  return [
    base,
    "",
    "Revise and re-output the full dossier with strict format compliance:",
    "- No source references, no citations, no bibliography section.",
    "- No URLs.",
    "- No bullet lists, no numbered lists, no tables.",
    "- Keep wiki-like prose and section headings.",
    hint,
  ].join("\n");
}

async function findPromptSelector(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<string | null> {
  for (const selector of INPUT_SELECTORS) {
    const node = await page.waitForSelector(selector, { timeout: 6_000 }).catch(() => null);
    if (node) return selector;
  }
  return null;
}

async function clickFirstVisible(
  page: Awaited<ReturnType<typeof ensureBrowser>>,
  selectors: string[],
  timeoutMs = 600,
): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible({ timeout: timeoutMs }).catch(() => false);
    if (!visible) continue;
    try {
      await locator.click({ timeout: 4_000 });
      return true;
    } catch {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.keyboard.press("Escape").catch(() => undefined);
      try {
        await locator.click({ timeout: 4_000, force: true });
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

async function clickElementByText(
  page: Awaited<ReturnType<typeof ensureBrowser>>,
  textPattern: RegExp,
): Promise<boolean> {
  return page.evaluate((patternSource, patternFlags) => {
    const pattern = new RegExp(patternSource, patternFlags);
    const candidates = Array.from(
      document.querySelectorAll("button,[role='button'],[role='menuitem'],[role='option'],li,div"),
    );
    for (const node of candidates) {
      const text = (node.textContent || "").trim().replace(/\s+/g, " ");
      const aria = String((node as HTMLElement).getAttribute("aria-label") || "").trim();
      if (!pattern.test(`${text} ${aria}`)) continue;
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.offsetParent === null && style.position !== "fixed") continue;
      el.click();
      return true;
    }
    return false;
  }, textPattern.source, textPattern.flags);
}

async function isDeepResearchActive(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<boolean> {
  return page.evaluate(() => {
    const selectors = [
      "button",
      '[role="button"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[aria-label]',
    ];
    const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    for (const node of nodes) {
      const text = (node.textContent || "").trim().replace(/\s+/g, " ");
      const aria = String((node as HTMLElement).getAttribute("aria-label") || "").trim();
      if (/deselect\s+deep\s*research/i.test(aria)) return true;
      if (!/deep\s*research/i.test(`${text} ${aria}`)) continue;

      const attrs = [
        (node as HTMLElement).getAttribute("aria-pressed"),
        (node as HTMLElement).getAttribute("aria-checked"),
        (node as HTMLElement).getAttribute("aria-selected"),
        (node as HTMLElement).getAttribute("data-state"),
      ]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase());
      if (attrs.includes("true") || attrs.includes("active") || attrs.includes("selected") || attrs.includes("checked")) {
        return true;
      }

      const className = String((node as HTMLElement).className || "").toLowerCase();
      if (className.includes("active") || className.includes("selected") || className.includes("checked")) {
        return true;
      }
    }
    return false;
  });
}

async function inspectGeminiStepState(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<GeminiStepState> {
  const [promptInputVisible, deepResearchSelected] = await Promise.all([
    findPromptSelector(page).then((v) => Boolean(v)).catch(() => false),
    isDeepResearchActive(page).catch(() => false),
  ]);

  const scan = await page.evaluate(
    `(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const userQueryCount = document.querySelectorAll(".user-query").length;
      const buttons = Array.from(document.querySelectorAll("button,[role='button']"));
      const startResearchVisible = buttons.some((node) => {
        if (!isVisible(node)) return false;
        const text = (node.textContent || "").trim();
        const aria = node.getAttribute("aria-label") || "";
        return /start\\s*research/i.test(text + " " + aria);
      });
      const createReportVisible = buttons.some((node) => {
        if (!isVisible(node)) return false;
        const text = (node.textContent || "").trim();
        const aria = node.getAttribute("aria-label") || "";
        return /create\\s*report/i.test(text + " " + aria);
      });

      const popupContainers = Array.from(document.querySelectorAll("[role='dialog'], .cdk-overlay-pane, .cdk-overlay-container, .mat-mdc-dialog-container"));
      const newChatRequirementPopupVisible = popupContainers.some((node) => {
        if (!isVisible(node)) return false;
        const text = (node.textContent || "").replace(/\\s+/g, " ").toLowerCase();
        return text.includes("start a new chat") && (text.includes("deep research") || text.includes("to use deep research"));
      });

      return { userQueryCount, startResearchVisible, createReportVisible, newChatRequirementPopupVisible };
    })()`,
  ) as {
    userQueryCount: number;
    startResearchVisible: boolean;
    createReportVisible: boolean;
    newChatRequirementPopupVisible: boolean;
  };

  return {
    promptInputVisible,
    likelyFreshChat: scan.userQueryCount === 0,
    userQueryCount: scan.userQueryCount,
    newChatRequirementPopupVisible: scan.newChatRequirementPopupVisible,
    deepResearchSelected,
    startResearchVisible: scan.startResearchVisible,
    createReportVisible: scan.createReportVisible,
  };
}

function logStepState(prefix: string, state: GeminiStepState): void {
  console.log(
    `${prefix} promptInput=${state.promptInputVisible} freshChat=${state.likelyFreshChat} userQueries=${state.userQueryCount} popup=${state.newChatRequirementPopupVisible} deepResearch=${state.deepResearchSelected} startResearch=${state.startResearchVisible} createReport=${state.createReportVisible}`,
  );
}

async function dismissNewChatRequirementPopup(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    const clicked = await clickFirstVisible(page, NEW_CHAT_POPUP_BUTTON_SELECTORS, 700).catch(() => false);
    if (!clicked) {
      await page.keyboard.press("Escape").catch(() => undefined);
    }
    await page.waitForTimeout(350);
    const state = await inspectGeminiStepState(page);
    if (!state.newChatRequirementPopupVisible) return true;
  }
  return false;
}

async function inspectResearchControls(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<ResearchControlsState> {
  return page.evaluate(
    `(() => {
      const isVisible = (el) => {
        const s = window.getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const result = {
        startResearchVisible: false,
        startResearchDisabled: false,
        createReportVisible: false,
        createReportDisabled: false,
      };
      const nodes = Array.from(document.querySelectorAll("button,[role='button']"));
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = (node.textContent || "").trim().replace(/\\s+/g, " ");
        const aria = node.getAttribute("aria-label") || "";
        const probe = (text + " " + aria).toLowerCase();
        const disabled = Boolean(node.getAttribute("disabled")) || node.getAttribute("aria-disabled") === "true";
        if (/start\\s*research/.test(probe)) {
          result.startResearchVisible = true;
          result.startResearchDisabled = disabled;
        }
        if (/create\\s*report/.test(probe)) {
          result.createReportVisible = true;
          result.createReportDisabled = disabled;
        }
      }
      return result;
    })()`,
  ) as ResearchControlsState;
}

async function prepareResearchChat(
  page: Awaited<ReturnType<typeof ensureBrowser>>,
  deepResearchMode: DeepResearchMode,
  contextLabel: string,
): Promise<void> {
  console.log(`[step] ${contextLabel}: start new chat`);
  const newChat = await startNewGeminiChat();
  if (!newChat.success) {
    throw new Error(`Failed to start new chat: ${newChat.message}`);
  }

  let state = await inspectGeminiStepState(page);
  logStepState(`[check] ${contextLabel}: post-new-chat`, state);

  if (!state.promptInputVisible) {
    throw new Error("Prompt input not visible after new chat.");
  }
  if (!state.likelyFreshChat) {
    throw new Error(`New chat did not look fresh (user queries=${state.userQueryCount}).`);
  }
  if (state.newChatRequirementPopupVisible) {
    console.log(`[step] ${contextLabel}: dismissing new-chat requirement popup`);
    const cleared = await dismissNewChatRequirementPopup(page);
    state = await inspectGeminiStepState(page);
    logStepState(`[check] ${contextLabel}: post-popup-dismiss`, state);
    if (!cleared || state.newChatRequirementPopupVisible) {
      throw new Error("New-chat requirement popup remained visible.");
    }
  }

  if (deepResearchMode === "off") return;

  console.log(`[step] ${contextLabel}: ensure Deep Research selected`);
  await ensureDeepResearchEnabled(page, deepResearchMode);

  state = await inspectGeminiStepState(page);
  logStepState(`[check] ${contextLabel}: post-deep-research-enable`, state);

  if (deepResearchMode === "required" && !state.deepResearchSelected) {
    throw new Error("Deep Research is not selected after enable step.");
  }
  if (state.newChatRequirementPopupVisible) {
    console.log(`[step] ${contextLabel}: popup appeared after deep-research toggle, dismissing`);
    const cleared = await dismissNewChatRequirementPopup(page);
    state = await inspectGeminiStepState(page);
    logStepState(`[check] ${contextLabel}: post-toggle-popup-dismiss`, state);
    if (!cleared || state.newChatRequirementPopupVisible) {
      throw new Error("New-chat requirement popup remained visible after deep-research toggle.");
    }
    if (deepResearchMode === "required" && !state.deepResearchSelected) {
      await ensureDeepResearchEnabled(page, deepResearchMode);
      state = await inspectGeminiStepState(page);
      logStepState(`[check] ${contextLabel}: post-reenable`, state);
      if (!state.deepResearchSelected) {
        throw new Error("Deep Research is not selected after popup recovery.");
      }
    }
  }
}

async function ensureDeepResearchEnabled(
  page: Awaited<ReturnType<typeof ensureBrowser>>,
  mode: DeepResearchMode,
): Promise<boolean> {
  if (mode === "off") return false;
  if (await isDeepResearchActive(page)) return true;

  for (let i = 0; i < 3; i++) {
    let toolsClicked = await clickFirstVisible(page, TOOLS_TRIGGER_SELECTORS, 800).catch(() => false);
    if (!toolsClicked) {
      toolsClicked = await clickElementByText(page, /(^|\s)tools(\s|$)/i).catch(() => false);
    }
    if (!toolsClicked) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(500);
    let clicked = await clickFirstVisible(page, DEEP_RESEARCH_SELECTORS, 1_200);
    if (!clicked) {
      clicked = await clickElementByText(page, /deep\s*research/i).catch(() => false);
    }
    if (clicked) {
      await page.waitForTimeout(500);
      if (await isDeepResearchActive(page)) return true;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);
  }

  if (mode === "required") {
    throw new Error("Could not enable Gemini Tools -> Deep Research mode.");
  }
  return false;
}

async function extractLatestResponseText(page: Awaited<ReturnType<typeof ensureBrowser>>): Promise<string> {
  return page.evaluate((selectors) => {
    const nodes = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
        .filter((el) => ((el.textContent || "").trim().length > 120)),
    );
    if (nodes.length === 0) return "";
    const last = nodes[nodes.length - 1] as HTMLElement;
    return (last.textContent || "").trim();
  }, RESPONSE_SELECTORS);
}

function validateResearchOutput(text: string): { ok: boolean; sourceUrlCount: number; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < 1_500) return { ok: false, sourceUrlCount: 0, reason: "response too short" };
  if (/start\s+research|ready in a few mins|research plan|edit plan/i.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "deep research plan detected (not final report)" };
  }
  if (!/^#\s+/m.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "missing title heading" };
  }
  const sectionCount = (trimmed.match(/^##\s+/gm) || []).length;
  if (sectionCount < 3) {
    return { ok: false, sourceUrlCount: 0, reason: "not enough prose sections" };
  }
  if (/https?:\/\/|www\./i.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "contains URL" };
  }
  if (/^(\s*)([-*+]\s+|\d+\.\s+)/m.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "contains list formatting" };
  }
  if (/^\s*\|.+\|\s*$/m.test(trimmed) || /^\s*\|?[-: ]+\|[-|: ]+\s*$/m.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "contains table formatting" };
  }
  if (/(^|\n)##\s*(sources?|references?|bibliography|citations?)\b/i.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "contains source/reference section" };
  }
  if (/\[[0-9]+\]|\(source[:)]/i.test(trimmed)) {
    return { ok: false, sourceUrlCount: 0, reason: "contains citation markers" };
  }

  return { ok: true, sourceUrlCount: 0 };
}

async function waitForValidatedResearchResponse(
  page: Awaited<ReturnType<typeof ensureBrowser>>,
  timeoutMs: number,
  baselineText?: string,
): Promise<{ text: string; sourceUrlCount: number; ok: boolean; reason?: string }> {
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  let lastLogAt = 0;
  let bestText = "";
  let lastReason = "no response text yet";
  let startResearchClicked = false;
  let createReportClicked = false;
  let lastStartResearchAttemptAt = 0;
  let lastCreateReportAttemptAt = 0;
  let lastDisabledStartLogAt = 0;
  let lastDisabledReportLogAt = 0;

  while (Date.now() < deadline) {
    const text = await extractLatestResponseText(page);
    if (baselineText && text.trim() === baselineText.trim()) {
      const now = Date.now();
      if (now - lastLogAt >= 60_000) {
        const elapsedSec = Math.floor((now - startedAt) / 1000);
        console.log(`[wait] elapsed=${elapsedSec}s awaiting new response (still baseline)`);
        lastLogAt = now;
      }
      await page.waitForTimeout(RESPONSE_POLL_MS);
      continue;
    }
    if (text.length > bestText.length) {
      bestText = text;
    }

    const validation = validateResearchOutput(text);
    if (validation.ok) {
      return { text: text.trim(), sourceUrlCount: validation.sourceUrlCount, ok: true };
    }
    if (validation.reason) lastReason = validation.reason;

    const now = Date.now();
    if (
      /start\s+research/i.test(text) &&
      now - lastStartResearchAttemptAt >= 15_000
    ) {
      lastStartResearchAttemptAt = now;
      const controls = await inspectResearchControls(page);
      if (controls.startResearchVisible && controls.startResearchDisabled) {
        if (now - lastDisabledStartLogAt >= 60_000) {
          console.log("[wait] 'Start research' is visible but disabled; waiting for it to enable.");
          lastDisabledStartLogAt = now;
        }
      } else {
        let clicked = await clickFirstVisible(page, START_RESEARCH_SELECTORS, 1_200).catch(() => false);
        if (!clicked) {
          clicked = await clickElementByText(page, /start\s+research/i).catch(() => false);
        }
        if (clicked) {
          startResearchClicked = true;
          console.log("[wait] Deep Research plan detected; clicked 'Start research'.");
          await page.waitForTimeout(1_000);
          continue;
        }
      }
    }

    if (startResearchClicked && !createReportClicked && now - lastCreateReportAttemptAt >= 15_000) {
      lastCreateReportAttemptAt = now;
      const controls = await inspectResearchControls(page);
      if (controls.createReportVisible && controls.createReportDisabled) {
        if (now - lastDisabledReportLogAt >= 60_000) {
          console.log("[wait] 'Create report' is visible but disabled; waiting for it to enable.");
          lastDisabledReportLogAt = now;
        }
      } else {
        let clicked = await clickFirstVisible(page, CREATE_REPORT_SELECTORS, 1_200).catch(() => false);
        if (!clicked) {
          clicked = await clickElementByText(page, /create\s+report/i).catch(() => false);
        }
        if (clicked) {
          createReportClicked = true;
          console.log("[wait] Deep Research results ready; clicked 'Create report'.");
          await page.waitForTimeout(1_000);
          continue;
        }
      }
    }

    if (now - lastLogAt >= 60_000) {
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      console.log(`[wait] elapsed=${elapsedSec}s bestChars=${bestText.length} status=${lastReason}`);
      lastLogAt = now;
    }
    await page.waitForTimeout(RESPONSE_POLL_MS);
  }

  const fallback = validateResearchOutput(bestText);
  return {
    text: bestText.trim(),
    sourceUrlCount: fallback.sourceUrlCount,
    ok: false,
    reason: `Timed out waiting for research completion: ${fallback.reason ?? lastReason}`,
  };
}

async function submitPromptText(page: Awaited<ReturnType<typeof ensureBrowser>>, prompt: string): Promise<void> {
  const selector = await findPromptSelector(page);
  if (!selector) throw new Error("Could not find Gemini prompt input.");

  const fillOnce = async () => {
    const input = page.locator(selector).first();
    await input.click({ clickCount: 3, timeout: 5_000 });
    await page.keyboard.press("Backspace").catch(() => undefined);
    await input.fill(prompt, { timeout: 8_000 });
    await page.waitForTimeout(450);
    await input.press("Enter", { timeout: 5_000 });
  };

  try {
    await fillOnce();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/not attached|detached/i.test(msg)) throw error;
    await page.waitForTimeout(500);
    await fillOnce();
  }
}

function appendStatus(statusPath: string, row: ResearchStatusEntry) {
  const current = safeReadJson<ResearchStatusEntry[]>(statusPath, []);
  current.push(row);
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify(current, null, 2) + "\n", "utf8");
}

async function generateRaceResearch(
  raceId: string,
  raceName: string,
  raceContext: string,
  questions: ProfileQuestion[],
  timeoutMs: number,
  maxAttempts: number,
  deepResearchMode: DeepResearchMode,
): Promise<{ text: string; attempts: number; sourceUrlCount: number; promptHash: string }> {
  const prompt = buildResearchPrompt(raceId, raceName, questions, raceContext);
  const promptHash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const page = await ensureBrowser("gemini");
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prepareResearchChat(page, deepResearchMode, `${raceId} attempt ${attempt}`);

      const baseline = await extractLatestResponseText(page);
      await submitPromptText(page, prompt);
      console.log(`[attempt ${attempt}/${maxAttempts}] ${raceId}: prompt sent, waiting for finalized response`);

      let ready = await waitForValidatedResearchResponse(page, timeoutMs, baseline);
      if (
        !ready.ok &&
        !/timed out waiting for research completion/i.test(String(ready.reason || ""))
      ) {
        console.log(
          `[attempt ${attempt}/${maxAttempts}] ${raceId}: starting remediation in a new chat (${ready.reason ?? "validation failed"})`,
        );
        await prepareResearchChat(page, deepResearchMode, `${raceId} remediation attempt ${attempt}`);
        const strictPrompt = buildStyleCorrectionPrompt(
          raceId,
          raceName,
          questions,
          raceContext,
          ready.reason,
        );
        const remediationBaseline = await extractLatestResponseText(page);
        await submitPromptText(page, strictPrompt);
        ready = await waitForValidatedResearchResponse(page, Math.min(timeoutMs, 300_000), remediationBaseline);
      }
      if (!ready.ok) {
        throw new Error(ready.reason ?? "research response did not meet validation");
      }
      console.log(`[attempt ${attempt}/${maxAttempts}] ${raceId}: completed (format checks passed)`);
      return {
        text: ready.text,
        attempts: attempt,
        sourceUrlCount: ready.sourceUrlCount,
        promptHash,
      };
    } catch (error: unknown) {
      lastError = `Attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`;
      await page.waitForTimeout(1_000 + attempt * 800);
    }
  }

  throw new Error(lastError);
}

function writeProfileFile(
  outputPath: string,
  raceId: string,
  raceName: string,
  body: string,
  promptHash: string,
): void {
  const lines: string[] = [];
  lines.push(`# ${raceName} Profile`);
  lines.push("");
  lines.push(`Race ID: ${raceId}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("Method: Gemini Web via CDP (research prompt)");
  lines.push(`Prompt Hash: ${promptHash}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(body.trim());
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    console.log("Usage:");
    console.log("  npx tsx scripts/research-races-with-gemini.ts --race-id <id> [--overwrite]");
    console.log("  npx tsx scripts/research-races-with-gemini.ts --all [--limit N] [--start-after <raceId>] [--overwrite]");
    console.log("");
    console.log("Options:");
    console.log("  --race-id <id>                 Research one race by id.");
    console.log("  --all                          Research all races in glossary index.");
    console.log("  --limit <n>                    Max races to process.");
    console.log("  --start-after <raceId>         Skip until this race id, then continue.");
    console.log("  --questions <path>             Questions markdown path.");
    console.log("  --out-dir <path>               Output folder for per-race markdown files.");
    console.log("  --status-path <path>           Append-only status file path.");
    console.log("  --timeout-ms <n>               Wait timeout per attempt (default 1200000).");
    console.log("  --max-attempts <n>             Retry attempts per race (default 3).");
    console.log("  --deep-research <mode>         required|optional|off (default required).");
    console.log("  --overwrite                    Overwrite existing profile file.");
    process.exit(0);
  }

  const doctor = await doctorGeminiCDP({ openIfMissing: true, attemptConsent: true });
  if (!doctor.ok && doctor.stage !== "consent") {
    throw new Error(`Gemini CDP not ready: ${doctor.stage} - ${doctor.message}`);
  }

  const questionsPathArg = parseFlag(args, "--questions");
  const outDirArg = parseFlag(args, "--out-dir");
  const statusPathArg = parseFlag(args, "--status-path");
  const raceIdArg = parseFlag(args, "--race-id");
  const all = hasFlag(args, "--all");
  const overwrite = hasFlag(args, "--overwrite");
  const startAfter = parseFlag(args, "--start-after");
  const limitRaw = parseFlag(args, "--limit");
  const timeoutRaw = parseFlag(args, "--timeout-ms");
  const maxAttemptsRaw = parseFlag(args, "--max-attempts");
  const deepResearchRaw = parseFlag(args, "--deep-research") ?? "required";
  const deepResearchMode: DeepResearchMode = (
    deepResearchRaw === "required" || deepResearchRaw === "optional" || deepResearchRaw === "off"
  )
    ? deepResearchRaw
    : (() => {
      throw new Error(`Invalid --deep-research value: ${deepResearchRaw} (expected required|optional|off)`);
    })();

  const questionsPath = questionsPathArg
    ? (path.isAbsolute(questionsPathArg) ? questionsPathArg : path.join(ROOT, questionsPathArg))
    : DEFAULT_PROFILE_QUESTIONS_PATH;
  const outDir = outDirArg
    ? (path.isAbsolute(outDirArg) ? outDirArg : path.join(ROOT, outDirArg))
    : DEFAULT_OUT_DIR;
  const statusPath = statusPathArg
    ? (path.isAbsolute(statusPathArg) ? statusPathArg : path.join(ROOT, statusPathArg))
    : DEFAULT_STATUS_PATH;

  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(`Invalid --timeout-ms value: ${timeoutRaw}`);

  const maxAttempts = maxAttemptsRaw ? Number(maxAttemptsRaw) : DEFAULT_MAX_ATTEMPTS;
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
    throw new Error(`Invalid --max-attempts value: ${maxAttemptsRaw}`);
  }

  if (!all && !raceIdArg) {
    throw new Error("Provide --race-id <id> or --all.");
  }

  const questions = loadProfileQuestions(questionsPath);
  const indexRaw = safeReadJson<unknown>(INDEX_PATH, []);
  const allRaces = flattenRaceEntries(indexRaw);
  const byId = new Map(allRaces.map((r) => [r.id, r]));

  let selected: RaceIndexEntry[];
  if (raceIdArg) {
    const found = byId.get(raceIdArg);
    selected = [found ?? { id: raceIdArg, title: toTitleFromId(raceIdArg), filePath: null }];
  } else {
    selected = [...allRaces];
  }

  if (startAfter) {
    const idx = selected.findIndex((row) => row.id === startAfter);
    if (idx >= 0 && idx + 1 < selected.length) {
      selected = selected.slice(idx + 1);
    } else if (idx >= 0) {
      selected = [];
    }
  }

  const limit = limitRaw ? Number(limitRaw) : NaN;
  if (Number.isFinite(limit) && limit > 0) {
    selected = selected.slice(0, limit);
  }

  if (selected.length === 0) {
    console.log("No races selected.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const race of selected) {
    const raceId = race.id;
    const raceName = race.title || toTitleFromId(raceId);
    const outputPath = path.join(outDir, `${raceId}.md`);

    if (!overwrite && fs.existsSync(outputPath)) {
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: true,
        attempts: 0,
        responseChars: fs.statSync(outputPath).size,
        sourceUrlCount: 0,
        promptHash: "skipped-existing",
        message: "Skipped (already exists). Use --overwrite to regenerate.",
      });
      console.log(`[skip] ${raceId} (already exists)`);
      continue;
    }

    try {
      const context = readRaceContext(race.filePath);
      const result = await generateRaceResearch(
        raceId,
        raceName,
        context,
        questions,
        timeoutMs,
        maxAttempts,
        deepResearchMode,
      );
      writeProfileFile(outputPath, raceId, raceName, result.text, result.promptHash);
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: true,
        attempts: result.attempts,
        responseChars: result.text.length,
        sourceUrlCount: result.sourceUrlCount,
        promptHash: result.promptHash,
        message: "OK",
      });
      successCount += 1;
      console.log(`[ok] ${raceId} -> ${path.relative(ROOT, outputPath).replace(/\\/g, "/")}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      appendStatus(statusPath, {
        timestamp: new Date().toISOString(),
        raceId,
        raceName,
        outputPath: path.relative(ROOT, outputPath).replace(/\\/g, "/"),
        success: false,
        attempts: maxAttempts,
        responseChars: 0,
        sourceUrlCount: 0,
        promptHash: "error",
        message,
      });
      failCount += 1;
      console.error(`[fail] ${raceId}: ${message}`);
    }
  }

  console.log(`done success=${successCount} failed=${failCount} total=${selected.length}`);
}

void main();
