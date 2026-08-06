// ============================================================================
// Coverage — what SHOULD be on a planning surface and is not
// ============================================================================
// The planning stack keeps every surface honest about what it holds. Nothing
// asked the other question: what is missing? Absence is invisible by
// construction, because a surface can only show what somebody put in it, and a
// missing entry looks exactly like empty space.
//
// This was found the hard way. On 2026-08-05 the repo had 24 architecture
// domain docs and none for the streamed 3D world — 154 files across
// src/systems/world3d and src/components/World3D, the largest undocumented
// area in the codebase. Nothing flagged it. A human noticed, months late.
//
// The rule, and the reason each checker below looks the way it does, live in
// PLANNING-STACK.md section 6. Two points from it govern this file:
//
//   • A surface is checkable only if it can name the population it covers AND
//     say how to enumerate that population from the repository. A surface that
//     cannot answer both is reported as unCHECKABLE rather than as covered,
//     because "no gaps found" and "cannot look" must never render alike.
//
//   • RANK, do not filter. Every gap is reported, sorted by size. A threshold
//     makes a judgment this tool is not qualified to make: src/components/ui
//     has 105 files and probably needs no domain doc, but that call takes a
//     reader one second and costs less than a rule that quietly hides the one
//     entry that mattered.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

/** Directories that are containers for other areas, never areas themselves. */
const AREA_ROOTS = ['src/systems', 'src/components'];

/**
 * Count files under a directory, one level deep.
 *
 * Depth one on purpose. This is a size SIGNAL for ranking, not a metric, and a
 * recursive walk over src/ costs far more than the ordering is worth.
 */
function shallowFileCount(dir) {
  try {
    return fs.readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/** Every candidate code area, with its repo-relative path and file count. */
export function listCodeAreas(repoRoot, roots = AREA_ROOTS) {
  const areas = [];
  for (const root of roots) {
    const abs = path.join(repoRoot, root);
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      areas.push({
        name: e.name,
        repoPath: `${root}/${e.name}`,
        files: shallowFileCount(path.join(abs, e.name)),
      });
    }
  }
  return areas;
}

/**
 * Does this text claim to cover this area?
 *
 * Two signals, because domain docs reference code two different ways. Most list
 * repo-relative entry points such as `src/systems/world3d/chunkGeometry.ts`.
 * Some name a directory in prose. Matching the bare area name alone would be
 * far too loose — `party`, `dice` and `ui` appear in ordinary sentences — so a
 * bare name only counts when it is written as a path segment.
 */
export function textCoversArea(text, area) {
  if (text.includes(area.repoPath)) return true;
  return text.includes(`/${area.name}/`);
}

/**
 * Code areas that no architecture domain doc names.
 *
 * `ignore` holds area names a reader has already judged as needing no doc. It
 * is an explicit record of a decision, not a filter: an ignored area is still
 * returned, marked, so the list stays a complete picture of the repository.
 */
export function domainDocCoverage(repoRoot, { domainDir = 'docs/architecture/domains', ignore = [] } = {}) {
  const abs = path.join(repoRoot, domainDir);
  let docs = [];
  try {
    docs = fs.readdirSync(abs).filter((f) => f.endsWith('.md'));
  } catch {
    return { checkable: false, reason: `no domain directory at ${domainDir}`, gaps: [] };
  }
  const corpus = docs.map((f) => fs.readFileSync(path.join(abs, f), 'utf8')).join('\n');
  const ignored = new Set(ignore);

  const gaps = listCodeAreas(repoRoot)
    .filter((area) => !textCoversArea(corpus, area))
    .map((area) => ({ ...area, ignored: ignored.has(area.name) }))
    // Rank by size. The biggest undocumented area is the one worth a reader's
    // attention first, and it is exactly the one this check exists to surface.
    .sort((a, b) => b.files - a.files || a.repoPath.localeCompare(b.repoPath));

  return { checkable: true, docCount: docs.length, gaps };
}

/**
 * Domain docs whose "Verified Current Entry Points" no longer exist.
 *
 * This is DRIFT rather than absence, and it is the harder half. A doc that
 * names a deleted file still reads as authoritative, which is worse than a
 * missing doc — a reader trusts it.
 *
 * Only lines that look like repo paths are checked. Domain docs carry prose,
 * cross-references and mermaid blocks, and treating every backticked token as
 * a path would report noise as rot.
 */
export function domainDocDrift(repoRoot, { domainDir = 'docs/architecture/domains' } = {}) {
  const abs = path.join(repoRoot, domainDir);
  let docs = [];
  try {
    docs = fs.readdirSync(abs).filter((f) => f.endsWith('.md'));
  } catch {
    return { checkable: false, reason: `no domain directory at ${domainDir}`, stale: [] };
  }
  /* Longest extension FIRST, and a trailing boundary.
   *
   * `ts|tsx` with no end anchor matches the PREFIX of `BattleMap.tsx` and
   * reports `BattleMap.ts` as a missing file that no doc ever named. That bug
   * manufactured 58 false positives on its first run — 70% of everything it
   * reported — and every one pointed at a file sitting right there. A checker
   * that invents faults is worse than no checker, because somebody acts on it. */
  const PATH_RE = /(?:^|[\s`(])(src\/[A-Za-z0-9_\-./]+\.(?:tsx|jsx|ts|js))(?![A-Za-z0-9])/g;
  const stale = [];
  for (const f of docs) {
    const text = fs.readFileSync(path.join(abs, f), 'utf8');
    const missing = [];
    for (const m of text.matchAll(PATH_RE)) {
      const p = m[1];
      if (!fs.existsSync(path.join(repoRoot, p))) missing.push(p);
    }
    if (missing.length) stale.push({ doc: `${domainDir}/${f}`, missing: [...new Set(missing)] });
  }
  stale.sort((a, b) => b.missing.length - a.missing.length || a.doc.localeCompare(b.doc));
  return { checkable: true, docCount: docs.length, stale };
}

/**
 * The whole coverage report, one entry per planning surface.
 *
 * Surfaces that cannot be enumerated are reported with `checkable: false` and a
 * reason. That is the honest answer and it is deliberately not omitted — a
 * surface missing from this report would read as a surface with no gaps.
 */
export function coverageReport(repoRoot, opts = {}) {
  const domains = domainDocCoverage(repoRoot, opts);
  const drift = domainDocDrift(repoRoot, opts);
  return {
    domainDocs: {
      population: 'substantial code areas under src/systems and src/components',
      ...domains,
    },
    domainDocDrift: {
      population: 'entry points named by architecture domain docs',
      ...drift,
    },
    // Declared, not guessed. See PLANNING-STACK.md section 6.
    adrs: {
      population: 'hard-to-reverse decisions',
      checkable: false,
      reason: 'a decision made without a record leaves no trace to enumerate',
    },
    judgmentSurfaces: {
      population: 'systems that need a human eye',
      checkable: false,
      reason: 'no verdict store exists yet; see docs/adr/0001',
    },
  };
}
