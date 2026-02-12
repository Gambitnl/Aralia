#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";

type QaStatus = "pending" | "approved" | "rejected";
type QaEntry = {
  raceId: string;
  gender: "male" | "female";
  status: QaStatus;
  notes?: string;
  reviewedAt?: string;
  reviewer?: string;
};

type LedgerRow = {
  pairTag?: string;
  raceId: string;
  raceName: string;
  gender: "male" | "female";
  illustrationPath: string | null;
  observedActivity?: string | null;
  needsRegen?: boolean;
};

const ROOT = process.cwd();
const QA_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-qa.json");
const LEDGER_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.json");

function keyOf(raceId: string, gender: string): string {
  return `${raceId.trim().toLowerCase()}::${gender.trim().toLowerCase()}`;
}

function loadQaEntries(): QaEntry[] {
  if (!fs.existsSync(QA_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(QA_PATH, "utf8")) as { entries?: QaEntry[] };
  return Array.isArray(raw.entries) ? raw.entries : [];
}

function saveQaEntries(entries: QaEntry[]) {
  fs.mkdirSync(path.dirname(QA_PATH), { recursive: true });
  fs.writeFileSync(QA_PATH, JSON.stringify({ entries }, null, 2) + "\n", "utf8");
}

function loadLedgerRows(): LedgerRow[] {
  const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as { rows?: LedgerRow[] };
  return Array.isArray(raw.rows) ? raw.rows : [];
}

function parseFlagValue(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  return args[i + 1] ?? null;
}

function listNonRegenPending() {
  const rows = loadLedgerRows();
  const qaEntries = loadQaEntries();
  const qaByKey = new Map<string, QaEntry>();
  for (const e of qaEntries) qaByKey.set(keyOf(e.raceId, e.gender), e);

  const pending = rows.filter((r) => {
    if (r.needsRegen) return false;
    const qa = qaByKey.get(keyOf(r.raceId, r.gender));
    return qa?.status !== "approved";
  });

  console.log(`pending_non_regen_count=${pending.length}`);
  pending.forEach((r, i) => {
    const qa = qaByKey.get(keyOf(r.raceId, r.gender));
    const status = qa?.status ?? "pending";
    const notes = qa?.notes ?? "";
    const relPath = r.illustrationPath ?? "";
    const absPath = relPath ? path.join(ROOT, "public", relPath.replace(/^assets[\\/]/, "assets/")) : "";
    console.log(
      `${String(i + 1).padStart(3, "0")} ${r.pairTag ?? "-"} ${r.raceId} ${r.gender} status=${status} activity="${r.observedActivity ?? ""}" path="${absPath}" notes="${notes}"`,
    );
  });
}

function setStatus(args: string[]) {
  const raceId = args[1];
  const gender = args[2] as "male" | "female" | undefined;
  const status = args[3] as QaStatus | undefined;
  if (!raceId || (gender !== "male" && gender !== "female") || !status) {
    throw new Error("Usage: --set <raceId> <male|female> <pending|approved|rejected> [--notes \"...\"] [--reviewer \"...\"]");
  }
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    throw new Error(`Invalid status: ${status}`);
  }

  const notes = parseFlagValue(args, "--notes");
  const reviewer = parseFlagValue(args, "--reviewer") ?? "codex";
  const reviewedAt = new Date().toISOString();

  const entries = loadQaEntries();
  const k = keyOf(raceId, gender);
  const byKey = new Map<string, QaEntry>();
  for (const e of entries) byKey.set(keyOf(e.raceId, e.gender), e);
  byKey.set(k, {
    raceId,
    gender,
    status,
    notes: notes ?? undefined,
    reviewer,
    reviewedAt,
  });

  const out = [...byKey.values()].sort((a, b) => {
    return keyOf(a.raceId, a.gender).localeCompare(keyOf(b.raceId, b.gender));
  });
  saveQaEntries(out);
  console.log(`updated ${raceId} ${gender} => ${status}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--list-non-regen-pending") {
    listNonRegenPending();
    return;
  }
  if (args[0] === "--set") {
    setStatus(args);
    return;
  }

  console.log("Usage:");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --list-non-regen-pending");
  console.log("  npx tsx scripts/audits/mark-slice-of-life-qa.ts --set <raceId> <male|female> <pending|approved|rejected> [--notes \"...\"] [--reviewer \"...\"]");
}

main();
