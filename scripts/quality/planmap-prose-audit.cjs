#!/usr/bin/env node

/*
 * Planmap sub-field prose auditor (WF-G77 / GG-120): flags topics whose `sub`
 * still carries dated narrative / finding sentences per the convention settled
 * in PLANMAP-AGENT-GUIDE section 4. Produces a prioritized worklist; it does
 * NOT edit topics.json.
 *
 * Heuristics (each match cites its reason):
 *   - DATED-FINDING   contains "FINDING" / "Phase N (" style incident-log phrasing
 *   - PAST-TENSE-DATE references a specific date (YYYY-MM-DD or "(YYYY-MM-") inside sub
 *   - SUPERSEDED-WORD claims like "currently", "now", "no X exists" that rot fastest
 *   - STALE-UNVERIFIED active/specced topic with no fresh verified date (ties WF-G78)
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

const topicsPath = path.join(repoRoot, 'public', 'planmap', 'topics.json');
const map = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const now = new Date();

const dayDiff = (d) => Math.max(0, Math.round((now - new Date(d)) / 86400000));
const HEURISTICS = [
  ['DATED-FINDING', /\bFINDING\b|\bPhase \d+ \(|landed \d{4}-\d{2}-\d{2}|fixed \d{4}-\d{2}-\d{2}/i],
  ['PAST-TENSE-DATE', /\d{4}-\d{2}-\d{2}/],
  ['SUPERSEDED-WORD', /\b(no .{1,40} exists|does not exist|frozen|legacy)\b/i],
];

const rows = [];
for (const t of map.topics) {
  if (!t.sub || typeof t.sub !== 'string') continue;
  const reasons = [];
  for (const [name, re] of HEURISTICS) {
    const m = t.sub.match(re);
    if (m) reasons.push(`${name}:"${m[0].slice(0, 40)}"`);
  }
  const isActive = t.status === 'active' || t.status === 'specced';
  const staleUnverified = isActive && (!t.verified || dayDiff(t.verified) > 30);
  if (staleUnverified) reasons.push('STALE-UNVERIFIED');
  if (reasons.length === 0) continue;

  const priority = (isActive ? 0 : 1) * 10 + reasons.length; // actives first, most signals first
  rows.push({ id: t.id, status: t.status, priority, reasons, subLength: t.sub.length });
}
rows.sort((a, b) => a.priority - b.priority);

console.log(`topics flagged: ${rows.length} of ${map.topics.length}`);
console.log(`actives flagged: ${rows.filter((r) => r.status === 'active' || r.status === 'specced').length}`);
console.log('\nTop 15 remediation targets:');
for (const r of rows.slice(0, 15)) {
  console.log(`  [p${r.priority}] ${r.id} (${r.status}) ${r.reasons.join(', ')}`);
}
