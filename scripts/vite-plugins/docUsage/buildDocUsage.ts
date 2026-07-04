import fs from 'fs';
import path from 'path';
import type { DocUsagePayload, DocUsageEntry, RefKind, ReferenceIndex } from './types';
import { enumerateDocs } from './enumerateDocs';
import { scanReferences } from './scanReferences';
import { gitAgeDays } from './gitRecency';
import { loadAtlasRoles } from './atlasRoles';
import { combineConfidence } from './confidence';

const DEFAULT_ATLAS = '.agent/atlas/exports/knowledge-tree.json';
const DEFAULT_LEDGER = 'docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md';

function resolveConsumption(
  docPath: string, idx: ReferenceIndex, basenameUnique: Set<string>,
): { consumedBy: string[]; via: RefKind | null } {
  const base = path.posix.basename(docPath);
  if (idx.fileRefs.has(docPath)) return { consumedBy: [...idx.fileRefs.get(docPath)!], via: 'file' };
  const dir = idx.dirRefs.filter(d => docPath.startsWith(d.prefix));
  if (dir.length) return { consumedBy: [...new Set(dir.map(d => d.app))], via: 'dir' };
  if (idx.dataRefs.has(docPath)) return { consumedBy: [...idx.dataRefs.get(docPath)!], via: 'data' };
  if (idx.buildRefs.has(docPath)) return { consumedBy: ['build'], via: 'build' };
  if (basenameUnique.has(base) && idx.basenameRefs.has(base))
    return { consumedBy: [...idx.basenameRefs.get(base)!], via: 'file' };
  return { consumedBy: [], via: null };
}

function loadLedger(rootDir: string, ledgerRel: string): Set<string> {
  const set = new Set<string>();
  try {
    const raw = fs.readFileSync(path.join(rootDir, ledgerRel), 'utf-8');
    for (const m of raw.matchAll(/([\w./-]+\.md)/g)) set.add(m[1].replace(/^(\.\/)+/, ''));
  } catch { /* no ledger yet */ }
  return set;
}

export function buildDocUsage(
  rootDir: string, opts: { atlasPath?: string; ledgerPath?: string; now?: number } = {},
): DocUsagePayload {
  const now = opts.now ?? Date.now();
  const facts = enumerateDocs(rootDir);
  const idx = scanReferences(rootDir);
  const { roles, atlasMissing } = loadAtlasRoles(path.isAbsolute(opts.atlasPath || '')
    ? opts.atlasPath! : path.join(rootDir, opts.atlasPath || DEFAULT_ATLAS));
  const ledger = loadLedger(rootDir, opts.ledgerPath || DEFAULT_LEDGER);
  const ages = gitAgeDays(rootDir, facts.map(f => f.path), now);

  const baseCount = new Map<string, number>();
  for (const f of facts) { const b = path.posix.basename(f.path); baseCount.set(b, (baseCount.get(b) || 0) + 1); }
  const basenameUnique = new Set([...baseCount].filter(([, n]) => n === 1).map(([b]) => b));

  const hashGroups = new Map<string, string[]>();
  for (const f of facts) { if (!hashGroups.has(f.contentHash)) hashGroups.set(f.contentHash, []); hashGroups.get(f.contentHash)!.push(f.path); }
  const dupGroupId = new Map<string, number>();
  let gid = 0;
  for (const [, members] of hashGroups) { if (members.length > 1) { gid += 1; for (const m of members) dupGroupId.set(m, gid); } }

  const docPaths = new Set(facts.map(f => f.path));
  const inbound = new Map<string, number>();
  for (const f of facts) for (const t of f.outboundLinkTargets)
    if (docPaths.has(t) && t !== f.path) inbound.set(t, (inbound.get(t) || 0) + 1);

  const docs: DocUsageEntry[] = facts.map((f) => {
    const { consumedBy, via } = resolveConsumption(f.path, idx, basenameUnique);
    const inboundLinks = inbound.get(f.path) || 0;
    const gitAge = ages.get(f.path) ?? null;
    const dup = dupGroupId.get(f.path) ?? null;
    const candidate = combineConfidence({
      consumed: consumedBy.length > 0, inboundLinks, gitAgeDays: gitAge,
      wordCount: f.wordCount, isDuplicate: dup != null, supersededBy: f.supersededBy,
      lifecycle: f.lifecycleStatus, inLedger: ledger.has(f.path),
    });
    return {
      path: f.path, consumedBy, consumedVia: via, contentHash: f.contentHash,
      duplicateGroupId: dup, role: roles.get(f.path) ?? null,
      ageDays: Math.floor((now - f.mtimeMs) / 86_400_000), gitAgeDays: gitAge,
      wordCount: f.wordCount, openTaskCount: f.openTaskCount, inboundLinks,
      lifecycle: f.lifecycleStatus, supersededBy: f.supersededBy, candidate,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    docs,
    diagnostics: { ...idx.diagnostics, atlasMissing },
  };
}
