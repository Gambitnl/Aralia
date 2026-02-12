#!/usr/bin/env npx tsx
/**
 * Build a clean slice-of-life ledger for race portraits.
 *
 * Sources:
 * - CC race data: src/data/races/*.ts
 * - Image status log: public/assets/images/races/race-image-status.json
 *
 * Outputs:
 * - scripts/audits/slice-of-life-settings.md
 * - scripts/audits/slice-of-life-settings.json
 *
 * Rules:
 * - Use only the latest status entry per (race, gender).
 * - Include every CC race/gender pair in the final ledger.
 * - Flag duplicate activities across:
 *   1) all latest pairs
 *   2) regenerated pairs only (entries with backlog category A-E)
 */

import fs from "fs";
import path from "path";

type StatusEntry = {
  race?: string;
  gender?: string;
  prompt?: string;
  downloadedAt?: string;
  imagePath?: string;
  category?: string;
  reason?: string;
  activity?: string;
};

type CcRacePair = {
  raceId: string;
  raceName: string;
  baseRace: string | null;
  gender: "male" | "female";
  illustrationPath: string | null;
};

type LedgerRow = {
  pairNumber: number;
  pairTag: string;
  raceId: string;
  raceName: string;
  baseRace: string | null;
  gender: "male" | "female";
  illustrationPath: string | null;
  observedActivity: string | null;
  targetActivity: string | null;
  activity: string | null;
  activityCanonical: string | null;
  likelyScore: number | null;
  likelyReason: string | null;
  needsRegen: boolean;
  duplicateGroupSize: number;
  duplicateDecision: "missing" | "unique" | "keep" | "regen";
  duplicateKeeperPairTag: string | null;
  qaStatus: "pending" | "approved" | "rejected";
  qaNotes: string | null;
  qaReviewedAt: string | null;
  qaReviewer: string | null;
  statusCategory: string | null;
  statusReason: string | null;
  downloadedAt: string | null;
  statusImagePath: string | null;
  isRegenerated: boolean;
  duplicateAll: boolean;
  duplicateRegenerated: boolean;
};

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, "public", "assets", "images", "races", "race-image-status.json");
const RACES_TS_DIR = path.join(ROOT, "src", "data", "races");
const QA_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-qa.json");
const OUT_MD = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.md");
const OUT_JSON = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.json");

// Also emit a copy under public/ so the Design Preview page can fetch "live" ledger data
// without requiring a rebuild (static JSON import tends to go stale across sessions).
const PUBLIC_OUT_DIR = path.join(ROOT, "public", "data", "dev");
const PUBLIC_OUT_MD = path.join(PUBLIC_OUT_DIR, "slice-of-life-settings.md");
const PUBLIC_OUT_JSON = path.join(PUBLIC_OUT_DIR, "slice-of-life-settings.json");

const NON_SELECTABLE_BASE_RACE_IDS = new Set(["elf", "tiefling", "goliath", "eladrin", "dragonborn"]);
const BACKLOG_CATEGORIES = new Set(["A", "B", "C", "D", "E"]);

type QaEntry = {
  raceId?: string;
  gender?: string;
  status?: string;
  notes?: string;
  reviewedAt?: string;
  reviewer?: string;
};

function loadQaByPairKey(): Map<string, Required<Pick<LedgerRow, "qaStatus" | "qaNotes" | "qaReviewedAt" | "qaReviewer">>> {
  const out = new Map<string, Required<Pick<LedgerRow, "qaStatus" | "qaNotes" | "qaReviewedAt" | "qaReviewer">>>();
  if (!fs.existsSync(QA_PATH)) return out;
  const raw = JSON.parse(fs.readFileSync(QA_PATH, "utf8")) as { entries?: QaEntry[] };
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  for (const entry of entries) {
    if (typeof entry.raceId !== "string" || typeof entry.gender !== "string") continue;
    const key = statusKey(entry.raceId, entry.gender);
    const status = entry.status === "approved" || entry.status === "rejected" || entry.status === "pending"
      ? entry.status
      : "pending";
    out.set(key, {
      qaStatus: status,
      qaNotes: typeof entry.notes === "string" && entry.notes.trim() ? entry.notes.trim() : null,
      qaReviewedAt: typeof entry.reviewedAt === "string" && entry.reviewedAt.trim() ? entry.reviewedAt.trim() : null,
      qaReviewer: typeof entry.reviewer === "string" && entry.reviewer.trim() ? entry.reviewer.trim() : null,
    });
  }
  return out;
}

function extractLine(prompt: string, label: string): string | null {
  if (typeof prompt !== "string" || !prompt) return null;
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, "mi");
  return prompt.match(re)?.[1]?.trim() ?? null;
}

function normalizeActivity(activity: string | null): string | null {
  if (!activity) return null;
  const cleaned = activity
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,;:!?'"`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function statusKey(race: string, gender: string): string {
  return `${race.trim().toLowerCase()}::${gender.trim().toLowerCase()}`;
}

function parseDateMs(s: string | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function getLatestStatusByPair(entries: StatusEntry[]) {
  const latest = new Map<string, { entry: StatusEntry; index: number; downloadedAtMs: number }>();
  let discardedWithoutPair = 0;

  entries.forEach((entry, index) => {
    if (typeof entry.race !== "string" || typeof entry.gender !== "string") {
      discardedWithoutPair += 1;
      return;
    }
    const key = statusKey(entry.race, entry.gender);
    const candidate = { entry, index, downloadedAtMs: parseDateMs(entry.downloadedAt) };
    const current = latest.get(key);
    if (!current) {
      latest.set(key, candidate);
      return;
    }

    // Prefer newer downloadedAt, then higher index for stable tie-break.
    if (
      candidate.downloadedAtMs > current.downloadedAtMs ||
      (candidate.downloadedAtMs === current.downloadedAtMs && candidate.index > current.index)
    ) {
      latest.set(key, candidate);
    }
  });

  return { latest, discardedWithoutPair };
}

function parseCcRacePairs(): CcRacePair[] {
  const files = fs.readdirSync(RACES_TS_DIR).filter((file) => {
    return file.endsWith(".ts") && file !== "index.ts" && file !== "raceGroups.ts";
  });

  const pairs: CcRacePair[] = [];

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

      const raceId = idMatch[1];
      if (NON_SELECTABLE_BASE_RACE_IDS.has(raceId)) continue;

      const raceName = nameMatch[1];
      const baseRace = block.match(/baseRace:\s*['"]([^'"]+)['"]/)?.[1] ?? null;
      const malePath = block.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/)?.[1] ?? null;
      const femalePath = block.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/)?.[1] ?? null;

      pairs.push({
        raceId,
        raceName,
        baseRace,
        gender: "male",
        illustrationPath: malePath,
      });
      pairs.push({
        raceId,
        raceName,
        baseRace,
        gender: "female",
        illustrationPath: femalePath,
      });
    }
  }

  // Deduplicate by (raceId, gender) in case multiple matches appear in a file.
  const byKey = new Map<string, CcRacePair>();
  for (const p of pairs) {
    byKey.set(`${p.raceId}::${p.gender}`, p);
  }
  return [...byKey.values()].sort((a, b) => {
    return `${a.raceId}:${a.gender}`.localeCompare(`${b.raceId}:${b.gender}`);
  });
}

function collectDuplicates(rows: LedgerRow[], regenOnly: boolean) {
  const byActivity = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.activityCanonical) continue;
    if (regenOnly && !row.isRegenerated) continue;
    const arr = byActivity.get(row.activityCanonical) ?? [];
    arr.push(row);
    byActivity.set(row.activityCanonical, arr);
  }

  return [...byActivity.entries()]
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([activityCanonical, arr]) => ({
      activityCanonical,
      count: arr.length,
      entries: arr
        .slice()
        .sort((x, y) => `${x.raceId}:${x.gender}`.localeCompare(`${y.raceId}:${y.gender}`))
        .map((r) => ({
          raceId: r.raceId,
          raceName: r.raceName,
          gender: r.gender,
          activity: r.activity,
          downloadedAt: r.downloadedAt,
        })),
    }));
}

function compareRowsForDuplicateKeeper(a: LedgerRow, b: LedgerRow): number {
  // Higher likely score wins if present.
  const aLikely = typeof a.likelyScore === "number" ? a.likelyScore : -1;
  const bLikely = typeof b.likelyScore === "number" ? b.likelyScore : -1;
  if (aLikely !== bLikely) return bLikely - aLikely;

  // Prefer regenerated rows, then newer downloads, then stable pair ordering.
  if (a.isRegenerated !== b.isRegenerated) return a.isRegenerated ? -1 : 1;
  const aDate = parseDateMs(a.downloadedAt ?? undefined);
  const bDate = parseDateMs(b.downloadedAt ?? undefined);
  if (aDate !== bDate) return bDate - aDate;
  if (a.pairNumber !== b.pairNumber) return a.pairNumber - b.pairNumber;
  if (a.gender !== b.gender) return a.gender === "male" ? -1 : 1;
  return a.raceId.localeCompare(b.raceId);
}

function main() {
  if (!fs.existsSync(STATUS_PATH)) {
    console.error(`[slice-of-life] Missing status file: ${STATUS_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as { entries?: StatusEntry[] };
  const statusEntries = Array.isArray(raw.entries) ? raw.entries : [];
  const qaByPairKey = loadQaByPairKey();
  const ccPairs = parseCcRacePairs();
  const { latest, discardedWithoutPair } = getLatestStatusByPair(statusEntries);

  const rows: LedgerRow[] = ccPairs.map((pair) => {
    const key = statusKey(pair.raceId, pair.gender);
    const latestStatus = latest.get(key)?.entry;
    const extractedActivity =
      (typeof latestStatus?.activity === "string" && latestStatus.activity.trim()) ||
      (typeof latestStatus?.prompt === "string" && extractLine(latestStatus.prompt, "Slice-of-life action")) ||
      (typeof latestStatus?.prompt === "string" && extractLine(latestStatus.prompt, "Role")) ||
      null;
    const canonical = normalizeActivity(extractedActivity);
    const statusCategory =
      typeof latestStatus?.category === "string" && latestStatus.category.trim()
        ? latestStatus.category.trim()
        : null;
    const isRegenerated = statusCategory !== null && BACKLOG_CATEGORIES.has(statusCategory);
    const qa = qaByPairKey.get(key);

    return {
      pairNumber: 0,
      pairTag: "",
      raceId: pair.raceId,
      raceName: pair.raceName,
      baseRace: pair.baseRace,
      gender: pair.gender,
      illustrationPath: pair.illustrationPath,
      observedActivity: extractedActivity,
      targetActivity: null,
      activity: extractedActivity,
      activityCanonical: canonical,
      likelyScore: null,
      likelyReason: "Pending lore-likelihood review.",
      needsRegen: false,
      duplicateGroupSize: 0,
      duplicateDecision: "missing",
      duplicateKeeperPairTag: null,
      qaStatus: qa?.qaStatus ?? "pending",
      qaNotes: qa?.qaNotes ?? null,
      qaReviewedAt: qa?.qaReviewedAt ?? null,
      qaReviewer: qa?.qaReviewer ?? null,
      statusCategory,
      statusReason: typeof latestStatus?.reason === "string" ? latestStatus.reason : null,
      downloadedAt: typeof latestStatus?.downloadedAt === "string" ? latestStatus.downloadedAt : null,
      statusImagePath: typeof latestStatus?.imagePath === "string" ? latestStatus.imagePath : null,
      isRegenerated,
      duplicateAll: false,
      duplicateRegenerated: false,
    };
  });

  // Pair races as N(m/f) in a stable, human-readable order.
  const raceSort = [...rows]
    .sort((a, b) => a.raceName.localeCompare(b.raceName) || a.raceId.localeCompare(b.raceId))
    .map((r) => r.raceId)
    .filter((value, index, arr) => arr.indexOf(value) === index);
  const pairNumberByRace = new Map<string, number>();
  raceSort.forEach((raceId, index) => pairNumberByRace.set(raceId, index + 1));

  for (const row of rows) {
    const pairNumber = pairNumberByRace.get(row.raceId) ?? 0;
    row.pairNumber = pairNumber;
    row.pairTag = `${pairNumber}${row.gender === "male" ? "m" : "f"}`;
  }

  rows.sort((a, b) => {
    if (a.pairNumber !== b.pairNumber) return a.pairNumber - b.pairNumber;
    if (a.gender !== b.gender) return a.gender === "male" ? -1 : 1;
    return a.raceId.localeCompare(b.raceId);
  });

  const duplicateAll = collectDuplicates(rows, false);
  const duplicateRegen = collectDuplicates(rows, true);

  const dupAllSet = new Set<string>(duplicateAll.map((d) => d.activityCanonical));
  const dupRegenSet = new Set<string>(duplicateRegen.map((d) => d.activityCanonical));

  const rowsByActivity = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.activityCanonical) continue;
    const arr = rowsByActivity.get(row.activityCanonical) ?? [];
    arr.push(row);
    rowsByActivity.set(row.activityCanonical, arr);
  }

  for (const row of rows) {
    if (!row.activityCanonical) {
      row.needsRegen = true;
      row.duplicateDecision = "missing";
      continue;
    }

    const peers = rowsByActivity.get(row.activityCanonical) ?? [];
    row.duplicateGroupSize = peers.length;
    if (peers.length <= 1) {
      row.needsRegen = false;
      row.duplicateDecision = "unique";
      continue;
    }

    const keeper = peers.slice().sort(compareRowsForDuplicateKeeper)[0];
    row.duplicateKeeperPairTag = keeper.pairTag;
    if (row.pairTag === keeper.pairTag) {
      row.needsRegen = false;
      row.duplicateDecision = "keep";
    } else {
      row.needsRegen = true;
      row.duplicateDecision = "regen";
    }
  }

  for (const row of rows) {
    if (row.activityCanonical && dupAllSet.has(row.activityCanonical)) row.duplicateAll = true;
    if (row.activityCanonical && dupRegenSet.has(row.activityCanonical)) row.duplicateRegenerated = true;
  }

  const withActivityCount = rows.filter((r) => r.activityCanonical !== null).length;
  const regeneratedCount = rows.filter((r) => r.isRegenerated).length;
  const regeneratedWithActivityCount = rows.filter((r) => r.isRegenerated && r.activityCanonical !== null).length;
  const duplicateAllRowCount = rows.filter((r) => r.duplicateAll).length;
  const duplicateRegenRowCount = rows.filter((r) => r.duplicateRegenerated).length;
  const rowsMarkedForRegen = rows.filter((r) => r.needsRegen).length;
  const qaApprovedCount = rows.filter((r) => r.qaStatus === "approved").length;
  const qaRejectedCount = rows.filter((r) => r.qaStatus === "rejected").length;
  const qaPendingCount = rows.length - qaApprovedCount - qaRejectedCount;

  const uniqueLatestActivities = new Set(rows.map((r) => r.activityCanonical).filter(Boolean) as string[]);
  const uniqueRegenActivities = new Set(
    rows.filter((r) => r.isRegenerated).map((r) => r.activityCanonical).filter(Boolean) as string[]
  );

  const summary = {
    totalCcRacePairs: rows.length,
    rowsWithActivity: withActivityCount,
    rowsMissingActivity: rows.length - withActivityCount,
    regeneratedPairs: regeneratedCount,
    regeneratedPairsWithActivity: regeneratedWithActivityCount,
    uniqueActivitiesAcrossLatestPairs: uniqueLatestActivities.size,
    uniqueActivitiesAcrossRegeneratedPairs: uniqueRegenActivities.size,
    duplicatedActivitiesAcrossLatestPairs: duplicateAll.length,
    duplicatedRowsAcrossLatestPairs: duplicateAllRowCount,
    duplicatedActivitiesAcrossRegeneratedPairs: duplicateRegen.length,
    duplicatedRowsAcrossRegeneratedPairs: duplicateRegenRowCount,
    rowsMarkedForRegen,
    qaApprovedCount,
    qaRejectedCount,
    qaPendingCount,
    discardedStatusEntriesWithoutRaceGender: discardedWithoutPair,
    totalStatusEntriesRead: statusEntries.length,
  };

  const md: string[] = [];
  md.push("# Slice-of-Life Ledger (Race Portraits)");
  md.push("");
  md.push(`Generated from: \`${path.relative(ROOT, STATUS_PATH).replace(/\\/g, "/")}\``);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Total CC race/gender pairs: ${summary.totalCcRacePairs}`);
  md.push(`- Pairs with activity recorded: ${summary.rowsWithActivity}`);
  md.push(`- Pairs missing activity: ${summary.rowsMissingActivity}`);
  md.push(`- Regenerated pairs (A-E category): ${summary.regeneratedPairs}`);
  md.push(`- Regenerated pairs with activity: ${summary.regeneratedPairsWithActivity}`);
  md.push(`- Unique activities (all latest pairs): ${summary.uniqueActivitiesAcrossLatestPairs}`);
  md.push(`- Unique activities (regenerated pairs): ${summary.uniqueActivitiesAcrossRegeneratedPairs}`);
  md.push(`- Duplicated activities (all latest pairs): ${summary.duplicatedActivitiesAcrossLatestPairs}`);
  md.push(`- Duplicated rows (all latest pairs): ${summary.duplicatedRowsAcrossLatestPairs}`);
  md.push(`- Duplicated activities (regenerated pairs): ${summary.duplicatedActivitiesAcrossRegeneratedPairs}`);
  md.push(`- Duplicated rows (regenerated pairs): ${summary.duplicatedRowsAcrossRegeneratedPairs}`);
  md.push(`- Rows marked for regen (missing or non-keeper duplicate): ${summary.rowsMarkedForRegen}`);
  md.push(`- QA approved rows: ${summary.qaApprovedCount}`);
  md.push(`- QA rejected rows: ${summary.qaRejectedCount}`);
  md.push(`- QA pending rows: ${summary.qaPendingCount}`);
  md.push(`- Discarded status entries without race/gender: ${summary.discardedStatusEntriesWithoutRaceGender}`);
  md.push("");

  md.push("## Duplicate Activities (Regenerated Pairs)");
  md.push("");
  if (duplicateRegen.length === 0) {
    md.push("- None");
  } else {
    for (const dup of duplicateRegen) {
      md.push(`- \`${dup.activityCanonical}\` (${dup.count})`);
      for (const e of dup.entries) {
        md.push(`  - ${e.raceId} (${e.gender})`);
      }
    }
  }
  md.push("");

  md.push("## Duplicate Activities (All Latest Pairs)");
  md.push("");
  if (duplicateAll.length === 0) {
    md.push("- None");
  } else {
    for (const dup of duplicateAll) {
      md.push(`- \`${dup.activityCanonical}\` (${dup.count})`);
      for (const e of dup.entries) {
        md.push(`  - ${e.raceId} (${e.gender})`);
      }
    }
  }
  md.push("");

  md.push("## All Race/Gender Pairs");
  md.push("");
  md.push(
    "| Pair | Race ID | Race Name | Gender | Group | Observed Activity | Target Activity | Likely | Needs Regen | Decision | Keeper | QA | QA Note | Category | Regen? | Dup(Regen) | Dup(All) |",
  );
  md.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    md.push(
      `| ${row.pairTag} | ${row.raceId} | ${row.raceName} | ${row.gender} | ${row.baseRace ?? row.raceId} | ${row.observedActivity ?? "(missing)"} | ${row.targetActivity ?? "(unset)"} | ${row.likelyScore ?? "-"} | ${row.needsRegen ? "yes" : "no"} | ${row.duplicateDecision} | ${row.duplicateKeeperPairTag ?? "-"} | ${row.qaStatus} | ${row.qaNotes ?? ""} | ${row.statusCategory ?? ""} | ${row.isRegenerated ? "yes" : "no"} | ${row.duplicateRegenerated ? "yes" : "no"} | ${row.duplicateAll ? "yes" : "no"} |`,
    );
  }
  md.push("");

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");

  const jsonPayload =
    JSON.stringify(
      {
        summary,
        duplicateActivitiesRegenerated: duplicateRegen,
        duplicateActivitiesAllLatest: duplicateAll,
        rows,
      },
      null,
      2,
    ) + "\n";

  fs.writeFileSync(OUT_JSON, jsonPayload, "utf8");

  fs.mkdirSync(PUBLIC_OUT_DIR, { recursive: true });
  fs.writeFileSync(PUBLIC_OUT_MD, md.join("\n"), "utf8");
  fs.writeFileSync(PUBLIC_OUT_JSON, jsonPayload, "utf8");

  console.log(`[slice-of-life] Wrote ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`[slice-of-life] Wrote ${path.relative(ROOT, PUBLIC_OUT_MD)} and ${path.relative(ROOT, PUBLIC_OUT_JSON)}`);
  console.log(`[slice-of-life] Regenerated duplicate activities: ${duplicateRegen.length}`);
}

main();
