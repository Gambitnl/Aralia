import fs from "fs";
import { computeFileSha, loadRaceImageEntries, RaceImageStatusEntry } from "./raceImageStatus.js";

function reportErrors(errors: string[]) {
  if (errors.length === 0) return;
  console.error("Race image validation failed:");
  for (const error of errors) {
    console.error("  -", error);
  }
  process.exit(1);
}

function main() {
  const entries = loadRaceImageEntries();
  const errors: string[] = [];
  const shaMap = new Map<string, RaceImageStatusEntry[]>();

  for (const entry of entries) {
    if (!fs.existsSync(entry.imagePath)) {
      errors.push(`missing file for ${entry.imagePath}`);
      continue;
    }
    const actualSha = computeFileSha(entry.imagePath);
    if (actualSha !== entry.sha256) {
      errors.push(`sha mismatch for ${entry.imagePath}: recorded ${entry.sha256}, actual ${actualSha}`);
    }
    if (!shaMap.has(actualSha)) {
      shaMap.set(actualSha, []);
    }
    shaMap.get(actualSha)!.push(entry);
  }

  for (const [sha, hits] of shaMap.entries()) {
    if (hits.length <= 1) continue;
    const labels = hits.map((entry) => `${entry.race ?? "unknown"} ${entry.variant ?? ""} ${entry.gender ?? ""}`.trim());
    errors.push(`duplicate hash ${sha} used by ${labels.join(", ")}`);
  }

  if (errors.length === 0) {
    console.log("Race image validation passed. No duplicates or mismatched hashes detected.");
  }

  reportErrors(errors);
}

main();
