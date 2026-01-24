import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

export type Provider = "gemini" | "whisk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATUS_PATH = path.join(__dirname, "../public/assets/images/races/race-image-status.json");

interface VerificationRecord {
  tool: string;
  complies: boolean;
  message: string;
}

export interface RaceImageStatusEntry {
  race?: string;
  variant?: string;
  gender?: string;
  prompt?: string;
  provider?: Provider;
  imagePath: string;
  sha256: string;
  downloadedAt: string;
  verifiedRace?: string;
  verifiedAt?: string;
  verification?: VerificationRecord;
}

interface RaceImageStatusFile {
  entries: RaceImageStatusEntry[];
}

function ensureStatusDirectory() {
  const dir = path.dirname(STATUS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStatus(): RaceImageStatusFile {
  if (!fs.existsSync(STATUS_PATH)) {
    return { entries: [] };
  }
  const raw = fs.readFileSync(STATUS_PATH, "utf-8");
  if (!raw.trim()) return { entries: [] };
  return JSON.parse(raw) as RaceImageStatusFile;
}

function saveStatus(data: RaceImageStatusFile) {
  ensureStatusDirectory();
  fs.writeFileSync(STATUS_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function computeFileSha(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function recordRaceImageDownload(input: {
  race?: string;
  variant?: string;
  gender?: string;
  prompt?: string;
  provider?: Provider;
  imagePath: string;
}) {
  const status = loadStatus();
  const sha256 = computeFileSha(input.imagePath);
  const downloadedAt = new Date().toISOString();
  const existingIndex = status.entries.findIndex((entry) => entry.imagePath === input.imagePath);
  const baseEntry: RaceImageStatusEntry = {
    race: input.race,
    variant: input.variant,
    gender: input.gender,
    prompt: input.prompt,
    provider: input.provider,
    imagePath: input.imagePath,
    sha256,
    downloadedAt,
  };
  if (existingIndex >= 0) {
    status.entries[existingIndex] = { ...status.entries[existingIndex], ...baseEntry };
  } else {
    status.entries.push(baseEntry);
  }
  saveStatus(status);
  const duplicates = status.entries.filter((entry) => entry.sha256 === sha256 && entry.imagePath !== input.imagePath);
  return { entry: baseEntry, duplicates };
}

export function recordRaceImageVerification(imagePath: string, verification: VerificationRecord & { verifiedRace?: string }) {
  const status = loadStatus();
  const existingIndex = status.entries.findIndex((entry) => entry.imagePath === imagePath);
  if (existingIndex < 0) {
    throw new Error(`No status entry recorded for ${imagePath}`);
  }
  status.entries[existingIndex] = {
    ...status.entries[existingIndex],
    verification: {
      tool: verification.tool,
      complies: verification.complies,
      message: verification.message,
    },
    verifiedAt: new Date().toISOString(),
    verifiedRace: verification.verifiedRace,
  };
  saveStatus(status);
  return status.entries[existingIndex];
}

export function loadRaceImageEntries() {
  return loadStatus().entries;
}
