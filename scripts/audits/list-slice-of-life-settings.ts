#!/usr/bin/env npx tsx
/**
 * Build a clean slice-of-life ledger for race portraits.
 *
 * Sources:
 * - CC race data: src/data/races/*.ts
 * - Image status log: public/assets/images/races/race-image-status.json
 * - QA decisions: scripts/audits/slice-of-life-qa.json
 *
 * Outputs:
 * - scripts/audits/slice-of-life-settings.md
 * - scripts/audits/slice-of-life-settings.json
 * - public/data/dev/slice-of-life-settings.md
 * - public/data/dev/slice-of-life-settings.json
 *
 * Rules:
 * - Use only the latest status entry per (race, gender).
 * - Include every CC race/gender pair in the final ledger.
 * - Uniqueness is evaluated on targetActivity canonical when present; otherwise observedActivity canonical.
 * - Duplicate handling follows keeper rule + dual-state QA conflict routing.
 */

import fs from "fs";
import path from "path";

type Gender = "male" | "female";
type VisualStatus = "pending" | "approved" | "rejected";
type UniquenessStatus = "pending" | "unique" | "keeper" | "non_keeper";

type FailureChecklist = {
  isSquare: boolean | null;
  isFullBody: boolean | null;
  isEdgeToEdge: boolean | null;
  isSliceOfLife: boolean | null;
  isCivilian: boolean | null;
  hasArrowsArtifact: boolean | null;
};

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
  gender: Gender;
  illustrationPath: string | null;
};

type QaEntry = {
  raceId?: string;
  gender?: string;
  status?: string;
  visualStatus?: string;
  uniquenessStatus?: string;
  manualReviewRequired?: boolean;
  checklist?: Partial<FailureChecklist>;
  notes?: string;
  reviewedAt?: string;
  reviewer?: string;
  likelyScore?: number | null;
  likelyReason?: string | null;
  targetActivity?: string | null;
  observedActivity?: string | null;
};

type QaState = {
  visualStatus: VisualStatus;
  uniquenessStatus: UniquenessStatus;
  manualReviewRequired: boolean;
  checklist: FailureChecklist;
  notes: string | null;
  reviewedAt: string | null;
  reviewer: string | null;
  likelyScore: number | null;
  likelyReason: string | null;
  targetActivity: string | null;
  observedActivity: string | null;
};

type LedgerRow = {
  pairNumber: number;
  pairTag: string;
  raceId: string;
  raceName: string;
  baseRace: string | null;
  gender: Gender;
  illustrationPath: string | null;
  observedActivity: string | null;
  activityCanonical: string | null;
  targetActivity: string | null;
  targetActivityCanonical: string | null;
  uniquenessCanonical: string | null;
  likelyScore: number | null;
  likelyReason: string | null;
  needsRegen: boolean;
  duplicateGroupSize: number;
  duplicateDecision: "missing" | "unique" | "keep" | "regen";
  duplicateKeeperPairTag: string | null;
  visualStatus: VisualStatus;
  uniquenessStatus: UniquenessStatus;
  manualReviewRequired: boolean;
  checklist: FailureChecklist;
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
  // Compatibility with previous consumers.
  qaStatus: VisualStatus;
  activity: string | null;
};

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, "public", "assets", "images", "races", "race-image-status.json");
const RACES_TS_DIR = path.join(ROOT, "src", "data", "races");
const QA_PATH = path.join(ROOT, "scripts", "audits", "slice-of-life-qa.json");
const OUT_MD = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.md");
const OUT_JSON = path.join(ROOT, "scripts", "audits", "slice-of-life-settings.json");
const PUBLIC_OUT_DIR = path.join(ROOT, "public", "data", "dev");
const PUBLIC_OUT_MD = path.join(PUBLIC_OUT_DIR, "slice-of-life-settings.md");
const PUBLIC_OUT_JSON = path.join(PUBLIC_OUT_DIR, "slice-of-life-settings.json");

const NON_SELECTABLE_BASE_RACE_IDS = new Set(["elf", "tiefling", "goliath", "eladrin", "dragonborn"]);
const BACKLOG_CATEGORIES = new Set(["A", "B", "C", "D", "E"]);

function statusKey(race: string, gender: string): string {
  return `${race.trim().toLowerCase()}::${gender.trim().toLowerCase()}`;
}

function normalizeVisualStatus(value: string | undefined): VisualStatus {
  if (value === "approved" || value === "rejected" || value === "pending") return value;
  return "pending";
}

function normalizeUniquenessStatus(value: string | undefined): UniquenessStatus {
  if (value === "unique" || value === "keeper" || value === "non_keeper" || value === "pending") return value;
  return "pending";
}

function normalizeLikelyScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1 || value > 5) return null;
  return Math.round(value);
}

function normalizeChecklist(value: Partial<FailureChecklist> | undefined): FailureChecklist {
  return {
    isSquare: typeof value?.isSquare === "boolean" ? value.isSquare : null,
    isFullBody: typeof value?.isFullBody === "boolean" ? value.isFullBody : null,
    isEdgeToEdge: typeof value?.isEdgeToEdge === "boolean" ? value.isEdgeToEdge : null,
    isSliceOfLife: typeof value?.isSliceOfLife === "boolean" ? value.isSliceOfLife : null,
    isCivilian: typeof value?.isCivilian === "boolean" ? value.isCivilian : null,
    hasArrowsArtifact: typeof value?.hasArrowsArtifact === "boolean" ? value.hasArrowsArtifact : null,
  };
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

function parseDateMs(s: string | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function extractLine(prompt: string, label: string): string | null {
  if (typeof prompt !== "string" || !prompt) return null;
  const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)\\s*$`, "mi");
  return prompt.match(re)?.[1]?.trim() ?? null;
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

      pairs.push({ raceId, raceName, baseRace, gender: "male", illustrationPath: malePath });
      pairs.push({ raceId, raceName, baseRace, gender: "female", illustrationPath: femalePath });
    }
  }

  const byKey = new Map<string, CcRacePair>();
  for (const pair of pairs) byKey.set(statusKey(pair.raceId, pair.gender), pair);
  return [...byKey.values()].sort((a, b) => `${a.raceId}:${a.gender}`.localeCompare(`${b.raceId}:${b.gender}`));
}

function loadQaByPairKey(): Map<string, QaState> {
  const out = new Map<string, QaState>();
  if (!fs.existsSync(QA_PATH)) return out;
  const raw = JSON.parse(fs.readFileSync(QA_PATH, "utf8")) as { entries?: QaEntry[] };
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  for (const entry of entries) {
    if (typeof entry.raceId !== "string" || typeof entry.gender !== "string") continue;
    if (entry.gender !== "male" && entry.gender !== "female") continue;
    out.set(statusKey(entry.raceId, entry.gender), {
      visualStatus: normalizeVisualStatus(entry.visualStatus ?? entry.status),
      uniquenessStatus: normalizeUniquenessStatus(entry.uniquenessStatus),
      manualReviewRequired: Boolean(entry.manualReviewRequired),
      checklist: normalizeChecklist(entry.checklist),
      notes: typeof entry.notes === "string" && entry.notes.trim() ? entry.notes.trim() : null,
      reviewedAt: typeof entry.reviewedAt === "string" && entry.reviewedAt.trim() ? entry.reviewedAt.trim() : null,
      reviewer: typeof entry.reviewer === "string" && entry.reviewer.trim() ? entry.reviewer.trim() : null,
      likelyScore: normalizeLikelyScore(entry.likelyScore),
      likelyReason: typeof entry.likelyReason === "string" && entry.likelyReason.trim() ? entry.likelyReason.trim() : null,
      targetActivity:
        typeof entry.targetActivity === "string" && entry.targetActivity.trim() ? entry.targetActivity.trim() : null,
      observedActivity:
        typeof entry.observedActivity === "string" && entry.observedActivity.trim() ? entry.observedActivity.trim() : null,
    });
  }
  return out;
}

function collectDuplicates(rows: LedgerRow[], regenOnly: boolean) {
  const byCanonical = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.uniquenessCanonical) continue;
    if (regenOnly && !row.isRegenerated) continue;
    const arr = byCanonical.get(row.uniquenessCanonical) ?? [];
    arr.push(row);
    byCanonical.set(row.uniquenessCanonical, arr);
  }

  return [...byCanonical.entries()]
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([activityCanonical, arr]) => ({
      activityCanonical,
      count: arr.length,
      entries: arr
        .slice()
        .sort((x, y) => `${x.raceId}:${x.gender}`.localeCompare(`${y.raceId}:${y.gender}`))
        .map((row) => ({
          raceId: row.raceId,
          raceName: row.raceName,
          gender: row.gender,
          observedActivity: row.observedActivity,
          targetActivity: row.targetActivity,
          downloadedAt: row.downloadedAt,
        })),
    }));
}

function compareRowsForDuplicateKeeper(a: LedgerRow, b: LedgerRow): number {
  const aLikely = typeof a.likelyScore === "number" ? a.likelyScore : -1;
  const bLikely = typeof b.likelyScore === "number" ? b.likelyScore : -1;
  if (aLikely !== bLikely) return bLikely - aLikely;

  const visualRank = (v: VisualStatus): number => (v === "approved" ? 2 : v === "pending" ? 1 : 0);
  const aVisual = visualRank(a.visualStatus);
  const bVisual = visualRank(b.visualStatus);
  if (aVisual !== bVisual) return bVisual - aVisual;

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

  const rawStatus = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as { entries?: StatusEntry[] };
  const statusEntries = Array.isArray(rawStatus.entries) ? rawStatus.entries : [];
  const qaByPairKey = loadQaByPairKey();
  const ccPairs = parseCcRacePairs();
  const { latest, discardedWithoutPair } = getLatestStatusByPair(statusEntries);

  const rows: LedgerRow[] = ccPairs.map((pair) => {
    const key = statusKey(pair.raceId, pair.gender);
    const latestStatus = latest.get(key)?.entry;
    const statusObserved =
      (typeof latestStatus?.activity === "string" && latestStatus.activity.trim()) ||
      (typeof latestStatus?.prompt === "string" && extractLine(latestStatus.prompt, "Slice-of-life action")) ||
      (typeof latestStatus?.prompt === "string" && extractLine(latestStatus.prompt, "Role")) ||
      null;

    const qa = qaByPairKey.get(key);
    const observedActivity = qa?.observedActivity ?? statusObserved;
    const activityCanonical = normalizeActivity(observedActivity);
    const targetActivity = qa?.targetActivity ?? null;
    const targetActivityCanonical = normalizeActivity(targetActivity);
    const uniquenessCanonical = targetActivityCanonical ?? activityCanonical;

    const statusCategory =
      typeof latestStatus?.category === "string" && latestStatus.category.trim()
        ? latestStatus.category.trim()
        : null;
    const isRegenerated = statusCategory !== null && BACKLOG_CATEGORIES.has(statusCategory);

    return {
      pairNumber: 0,
      pairTag: "",
      raceId: pair.raceId,
      raceName: pair.raceName,
      baseRace: pair.baseRace,
      gender: pair.gender,
      illustrationPath: pair.illustrationPath,
      observedActivity,
      activityCanonical,
      targetActivity,
      targetActivityCanonical,
      uniquenessCanonical,
      likelyScore: qa?.likelyScore ?? null,
      likelyReason: qa?.likelyReason ?? "Pending lore-likelihood review.",
      needsRegen: false,
      duplicateGroupSize: 0,
      duplicateDecision: "missing",
      duplicateKeeperPairTag: null,
      visualStatus: qa?.visualStatus ?? "pending",
      uniquenessStatus: qa?.uniquenessStatus ?? "pending",
      manualReviewRequired: qa?.manualReviewRequired ?? false,
      checklist: qa?.checklist ?? normalizeChecklist(undefined),
      qaNotes: qa?.notes ?? null,
      qaReviewedAt: qa?.reviewedAt ?? null,
      qaReviewer: qa?.reviewer ?? null,
      statusCategory,
      statusReason: typeof latestStatus?.reason === "string" ? latestStatus.reason : null,
      downloadedAt: typeof latestStatus?.downloadedAt === "string" ? latestStatus.downloadedAt : null,
      statusImagePath: typeof latestStatus?.imagePath === "string" ? latestStatus.imagePath : null,
      isRegenerated,
      duplicateAll: false,
      duplicateRegenerated: false,
      qaStatus: qa?.visualStatus ?? "pending",
      activity: observedActivity,
    };
  });

  // Pair races as N(m/f) in a stable order.
  const raceSort = [...rows]
    .sort((a, b) => a.raceName.localeCompare(b.raceName) || a.raceId.localeCompare(b.raceId))
    .map((row) => row.raceId)
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

  const rowsByCanonical = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.uniquenessCanonical) continue;
    const arr = rowsByCanonical.get(row.uniquenessCanonical) ?? [];
    arr.push(row);
    rowsByCanonical.set(row.uniquenessCanonical, arr);
  }

  for (const row of rows) {
    let autoDecision: "missing" | "unique" | "keep" | "regen";
    let autoUniqueness: UniquenessStatus;

    if (!row.uniquenessCanonical) {
      autoDecision = "missing";
      autoUniqueness = "pending";
      row.duplicateGroupSize = 0;
      row.duplicateKeeperPairTag = null;
    } else {
      const peers = rowsByCanonical.get(row.uniquenessCanonical) ?? [];
      row.duplicateGroupSize = peers.length;
      if (peers.length <= 1) {
        autoDecision = "unique";
        autoUniqueness = "unique";
        row.duplicateKeeperPairTag = row.pairTag;
      } else {
        const keeper = peers.slice().sort(compareRowsForDuplicateKeeper)[0];
        row.duplicateKeeperPairTag = keeper.pairTag;
        if (row.pairTag === keeper.pairTag) {
          autoDecision = "keep";
          autoUniqueness = "keeper";
        } else {
          autoDecision = "regen";
          autoUniqueness = "non_keeper";
        }
      }
    }

    row.duplicateDecision = autoDecision;
    if (row.uniquenessStatus === "pending") row.uniquenessStatus = autoUniqueness;

    const conflict = row.visualStatus === "approved" && row.uniquenessStatus === "non_keeper";
    row.manualReviewRequired = row.manualReviewRequired || conflict;

    row.needsRegen =
      row.visualStatus === "rejected" ||
      (row.uniquenessStatus === "non_keeper" && row.visualStatus !== "approved");
  }

  for (const row of rows) {
    if (row.uniquenessCanonical && dupAllSet.has(row.uniquenessCanonical)) row.duplicateAll = true;
    if (row.uniquenessCanonical && dupRegenSet.has(row.uniquenessCanonical)) row.duplicateRegenerated = true;
    row.qaStatus = row.visualStatus;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalCcRacePairs: rows.length,
    rowsWithObservedActivity: rows.filter((r) => r.activityCanonical !== null).length,
    rowsMissingObservedActivity: rows.filter((r) => r.activityCanonical === null).length,
    rowsWithTargetActivity: rows.filter((r) => r.targetActivityCanonical !== null).length,
    rowsMissingTargetActivity: rows.filter((r) => r.targetActivityCanonical === null).length,
    regeneratedPairs: rows.filter((r) => r.isRegenerated).length,
    regeneratedPairsWithObservedActivity: rows.filter((r) => r.isRegenerated && r.activityCanonical !== null).length,
    uniqueActivitiesAcrossLatestPairs: new Set(
      rows.map((r) => r.uniquenessCanonical).filter(Boolean) as string[]
    ).size,
    uniqueActivitiesAcrossRegeneratedPairs: new Set(
      rows.filter((r) => r.isRegenerated).map((r) => r.uniquenessCanonical).filter(Boolean) as string[]
    ).size,
    duplicatedActivitiesAcrossLatestPairs: duplicateAll.length,
    duplicatedRowsAcrossLatestPairs: rows.filter((r) => r.duplicateAll).length,
    duplicatedActivitiesAcrossRegeneratedPairs: duplicateRegen.length,
    duplicatedRowsAcrossRegeneratedPairs: rows.filter((r) => r.duplicateRegenerated).length,
    rowsMarkedForRegen: rows.filter((r) => r.needsRegen).length,
    visualApprovedCount: rows.filter((r) => r.visualStatus === "approved").length,
    visualRejectedCount: rows.filter((r) => r.visualStatus === "rejected").length,
    visualPendingCount: rows.filter((r) => r.visualStatus === "pending").length,
    uniquenessUniqueCount: rows.filter((r) => r.uniquenessStatus === "unique").length,
    uniquenessKeeperCount: rows.filter((r) => r.uniquenessStatus === "keeper").length,
    uniquenessNonKeeperCount: rows.filter((r) => r.uniquenessStatus === "non_keeper").length,
    uniquenessPendingCount: rows.filter((r) => r.uniquenessStatus === "pending").length,
    manualReviewRequiredCount: rows.filter((r) => r.manualReviewRequired).length,
    checklistCompleteCount: rows.filter((r) =>
      Object.values(r.checklist).every((value) => value !== null)
    ).length,
    discardedStatusEntriesWithoutRaceGender: discardedWithoutPair,
    totalStatusEntriesRead: statusEntries.length,
  };

  const md: string[] = [];
  md.push("# Slice-of-Life Ledger (Race Portraits)");
  md.push("");
  md.push(`Generated from: \`${path.relative(ROOT, STATUS_PATH).replace(/\\/g, "/")}\``);
  md.push(`Generated at: ${summary.generatedAt}`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Total CC race/gender pairs: ${summary.totalCcRacePairs}`);
  md.push(`- Observed activity present: ${summary.rowsWithObservedActivity}`);
  md.push(`- Observed activity missing: ${summary.rowsMissingObservedActivity}`);
  md.push(`- Target activity present: ${summary.rowsWithTargetActivity}`);
  md.push(`- Target activity missing: ${summary.rowsMissingTargetActivity}`);
  md.push(`- Regenerated pairs (A-E category): ${summary.regeneratedPairs}`);
  md.push(`- Regenerated pairs with observed activity: ${summary.regeneratedPairsWithObservedActivity}`);
  md.push(`- Unique activities (all pairs, target-first): ${summary.uniqueActivitiesAcrossLatestPairs}`);
  md.push(`- Unique activities (regenerated, target-first): ${summary.uniqueActivitiesAcrossRegeneratedPairs}`);
  md.push(`- Duplicated activities (all pairs): ${summary.duplicatedActivitiesAcrossLatestPairs}`);
  md.push(`- Duplicated rows (all pairs): ${summary.duplicatedRowsAcrossLatestPairs}`);
  md.push(`- Duplicated activities (regenerated pairs): ${summary.duplicatedActivitiesAcrossRegeneratedPairs}`);
  md.push(`- Duplicated rows (regenerated pairs): ${summary.duplicatedRowsAcrossRegeneratedPairs}`);
  md.push(`- Rows marked for regen: ${summary.rowsMarkedForRegen}`);
  md.push(`- Visual status: approved=${summary.visualApprovedCount}, rejected=${summary.visualRejectedCount}, pending=${summary.visualPendingCount}`);
  md.push(`- Uniqueness status: unique=${summary.uniquenessUniqueCount}, keeper=${summary.uniquenessKeeperCount}, non_keeper=${summary.uniquenessNonKeeperCount}, pending=${summary.uniquenessPendingCount}`);
  md.push(`- Manual review required rows: ${summary.manualReviewRequiredCount}`);
  md.push(`- Checklist complete rows: ${summary.checklistCompleteCount}`);
  md.push(`- Discarded status entries without race/gender: ${summary.discardedStatusEntriesWithoutRaceGender}`);
  md.push("");

  md.push("## Duplicate Activities (Regenerated Pairs)");
  md.push("");
  if (duplicateRegen.length === 0) {
    md.push("- None");
  } else {
    for (const dup of duplicateRegen) {
      md.push(`- \`${dup.activityCanonical}\` (${dup.count})`);
      for (const entry of dup.entries) {
        md.push(`  - ${entry.raceId} (${entry.gender})`);
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
      for (const entry of dup.entries) {
        md.push(`  - ${entry.raceId} (${entry.gender})`);
      }
    }
  }
  md.push("");

  md.push("## All Race/Gender Pairs");
  md.push("");
  md.push(
    "| Pair | Race ID | Race Name | Gender | Group | Observed Activity | Target Activity | Likely | Visual | Uniqueness | Manual Review | Needs Regen | Decision | Keeper | Category | Regen? | Dup(Regen) | Dup(All) |",
  );
  md.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    md.push(
      `| ${row.pairTag} | ${row.raceId} | ${row.raceName} | ${row.gender} | ${row.baseRace ?? row.raceId} | ${row.observedActivity ?? "(missing)"} | ${row.targetActivity ?? "(unset)"} | ${row.likelyScore ?? "-"} | ${row.visualStatus} | ${row.uniquenessStatus} | ${row.manualReviewRequired ? "yes" : "no"} | ${row.needsRegen ? "yes" : "no"} | ${row.duplicateDecision} | ${row.duplicateKeeperPairTag ?? "-"} | ${row.statusCategory ?? ""} | ${row.isRegenerated ? "yes" : "no"} | ${row.duplicateRegenerated ? "yes" : "no"} | ${row.duplicateAll ? "yes" : "no"} |`,
    );
  }
  md.push("");

  const payload = {
    summary,
    duplicateActivitiesRegenerated: duplicateRegen,
    duplicateActivitiesAllLatest: duplicateAll,
    rows,
  };

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  fs.mkdirSync(PUBLIC_OUT_DIR, { recursive: true });
  fs.writeFileSync(PUBLIC_OUT_MD, md.join("\n"), "utf8");
  fs.writeFileSync(PUBLIC_OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`[slice-of-life] Wrote ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`[slice-of-life] Wrote ${path.relative(ROOT, PUBLIC_OUT_MD)} and ${path.relative(ROOT, PUBLIC_OUT_JSON)}`);
  console.log(`[slice-of-life] Regenerated duplicate activities: ${duplicateRegen.length}`);
}

main();
