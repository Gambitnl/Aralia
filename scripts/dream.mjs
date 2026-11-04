#!/usr/bin/env node
/**
 * @file scripts/dream.mjs
 * Out-of-band "dreaming" over agent session transcripts — REPORT ONLY.
 *
 * What this file does:
 * 1. Streams the raw Claude Code session transcripts (`~/.claude/projects/<slug>/*.jsonl`)
 *    modified in the last `--days` (default 30). It never loads a whole file;
 *    some sessions are 400+ MB.
 * 2. Extracts the signals the talk says to scrutinize: failed tool calls
 *    (`tool_result.is_error`), user corrections, and `WORKFLOW:` friction lines.
 * 3. Groups them into patterns and keeps only those seen in >= `--min-sessions`
 *    DISTINCT sessions (default 2). One bad session is noise; two is a pattern.
 * 4. Cross-references each pattern against the memory store and marks it
 *    "covered by <memory>" or "NOT covered".
 * 5. Writes a Markdown review report with, per pattern: kind, signature,
 *    prevalence (sessions / occurrences), example excerpts, and a PROPOSED
 *    memory edit. A human accepts or rejects. Nothing is written to memory.
 *
 * Why it exists:
 * In-band memory (an agent writing memory during its own session) cannot see a
 * mistake repeated ACROSS sessions, and it splits the agent's focus. This is the
 * "head teacher" from Anthropic's memory talk: a batch job with its own budget
 * that reads every paper and fixes the curriculum. Claudeception (in-band,
 * single-session, outputs skills) sits below it; this sits above it and feeds
 * the memory store instead. MemPalace does NOT hold these transcripts, so the
 * raw .jsonl is the source of truth.
 *
 * The pattern step is pluggable: `EXTRACTOR` below is a free regex heuristic.
 * A cheap extraction model can replace it later without changing the report.
 *
 * Usage:
 *   node scripts/dream.mjs [--days 30] [--min-sessions 2] [--max-excerpts 3]
 *        [--sessions <dir>] [--memory <dir>] [--out <report.md>] [--json]
 */
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DAYS = Number(val('--days', '30'));
const MIN_SESSIONS = Number(val('--min-sessions', '2'));
const MAX_EXCERPTS = Number(val('--max-excerpts', '3'));
const JSON_OUT = has('--json');
const slug = process.cwd().replace(/[:\\/]/g, '-');
const SESSIONS = resolve(val('--sessions', join(homedir(), '.claude', 'projects', slug)));
const MEMORY = resolve(val('--memory', join(SESSIONS, 'memory')));
const today = new Date().toISOString().slice(0, 10);
const OUT = resolve(val('--out', join(process.cwd(), '.agent', 'scratch', `dream-report-${today}.md`)));

// --- signal extraction (the pluggable part) ---------------------------------
const CORRECTION = /^\s*(no\b|nope\b|wrong\b|not that\b|don'?t\b|stop\b|woof\b|that'?s (not|wrong)\b|incorrect\b|undo\b|revert\b|you (missed|forgot|broke)\b)/i;
// Hook nags arrive as user-role text but are not Remy. They are still a cross-session
// signal (a nag that fires in 30 sessions means the rule is not being followed), so
// they get their own kind instead of being dropped or counted as corrections.
const HOOK_FEEDBACK = /^\s*(stop hook feedback|userpromptsubmit hook|sessionstart:?\w* hook|pretooluse hook)\s*(success|feedback)?:?\s*/i;
const NOT_HUMAN = /^\s*(\[system notification|<task-notification|<system-reminder|<side-sessions-event|<ci-monitor-event|this session is being continued)/i;
// First lines of a tool error that carry no information on their own.
const BORING_ERROR_LINE = /^\s*(exit code \d+|error:?|command failed|<tool_use_error>)\s*$/i;
const STOP = new Set(['about', 'after', 'again', 'because', 'before', 'could', 'error', 'failed', 'found', 'there', 'their', 'these', 'those', 'using', 'which', 'while', 'would', 'should', 'cannot', 'please', 'command', 'result', 'output']);

/** Normalize a free-text signature: drop volatile tokens so repeats group together. */
function signature(text, cap = 120) {
  return String(text)
    .replace(/[A-Za-z]:\\[^\s'"`]+|\/[^\s'"`]+/g, '<path>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+(\.\d+)?\b/g, '<n>')
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, cap);
}
const keywords = (sig) => [...new Set(sig.split(/[^a-z]+/).filter((w) => w.length >= 5 && !STOP.has(w)))].slice(0, 4);

/** Text of a content block or content array. */
function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((b) => (typeof b === 'string' ? b : b?.type === 'text' ? b.text : '')).filter(Boolean).join('\n');
}

const EXTRACTOR = {
  /** @returns {Array<{kind:string, sig:string, raw:string}>} signals found in one record */
  fromRecord(rec, toolNames) {
    const out = [];
    const content = rec.message?.content;
    if (rec.type === 'assistant' && Array.isArray(content)) {
      for (const b of content) {
        if (b?.type === 'tool_use' && b.id) toolNames.set(b.id, b.name);
        if (b?.type === 'text' && typeof b.text === 'string') {
          for (const m of b.text.matchAll(/WORKFLOW:\s*([^\n]{8,200})/g)) {
            if (!/\bnone\b/i.test(m[1])) out.push({ kind: 'workflow-friction', sig: signature(m[1]), raw: m[1] });
          }
        }
      }
    }
    if (rec.type === 'user') {
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === 'tool_result' && b.is_error) {
            const tool = toolNames.get(b.tool_use_id) || 'tool';
            const errLines = textOf(b.content).split('\n').filter((l) => l.trim());
            // Prefer the first line that says something; fall back to the boring one.
            const t = errLines.find((l) => !BORING_ERROR_LINE.test(l)) || errLines[0] || '(no text)';
            out.push({ kind: 'tool-error', sig: `${tool}: ${signature(t)}`, raw: `${tool}: ${t.slice(0, 220)}` });
          }
        }
      }
      const t = textOf(content);
      if (!t || NOT_HUMAN.test(t)) return out;
      const hook = t.match(HOOK_FEEDBACK);
      if (hook) {
        const body = t.slice(hook[0].length);
        out.push({ kind: 'hook-feedback', sig: signature(body, 80), raw: body.slice(0, 220) });
      } else if (CORRECTION.test(t)) {
        out.push({ kind: 'user-correction', sig: signature(t, 80), raw: t.slice(0, 220) });
      }
    }
    return out;
  },
};

// --- transcript streaming -----------------------------------------------------
const cutoff = Date.now() - DAYS * 86_400_000;
async function sessionFiles() {
  const names = await readdir(SESSIONS);
  const picked = [];
  for (const n of names) {
    if (!n.endsWith('.jsonl')) continue;
    const f = join(SESSIONS, n);
    const s = await stat(f);
    if (s.mtimeMs >= cutoff) picked.push({ file: f, mtime: s.mtime, size: s.size });
  }
  return picked.sort((a, b) => b.mtime - a.mtime);
}

const patterns = new Map(); // key -> { kind, sig, sessions:Set, count, excerpts:[] }
let records = 0;

async function scan({ file }) {
  const session = basename(file, '.jsonl');
  const toolNames = new Map();
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    // cheap prefilter: skip attachment/queue/system noise before JSON.parse
    if (!(line.includes('"type":"user"') || line.includes('"type":"assistant"'))) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    if (rec.type !== 'user' && rec.type !== 'assistant') continue;
    // A long-lived session file has a fresh mtime but old records; the window is by record time.
    if (rec.timestamp && Date.parse(rec.timestamp) < cutoff) continue;
    records++;
    for (const sig of EXTRACTOR.fromRecord(rec, toolNames)) {
      const key = `${sig.kind}|${sig.sig}`;
      let p = patterns.get(key);
      if (!p) { p = { kind: sig.kind, sig: sig.sig, sessions: new Set(), count: 0, excerpts: [] }; patterns.set(key, p); }
      p.count++;
      p.sessions.add(session);
      if (p.excerpts.length < MAX_EXCERPTS && !p.excerpts.some((e) => e.session === session)) {
        p.excerpts.push({ session, ts: rec.timestamp, raw: sig.raw });
      }
    }
  }
}

// --- memory cross-reference ----------------------------------------------------
async function loadMemory() {
  const out = [];
  try {
    for (const n of await readdir(MEMORY)) {
      if (!n.endsWith('.md') || n === 'MEMORY.md') continue;
      const text = await readFile(join(MEMORY, n), 'utf8');
      const name = (text.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || n.replace(/\.md$/, '');
      out.push({ file: n, name, blob: text.toLowerCase() });
    }
  } catch { /* no memory dir: every pattern is uncovered */ }
  return out;
}
function coveredBy(sig, memory) {
  // Drop the tool-name prefix ("Bash: ...") so the tool name itself is not a keyword.
  const kws = keywords(sig.replace(/^[\w.]+:\s*/, ''));
  if (kws.length < 2) return [];
  // Need nearly all keywords, not just two: one large memory must not "cover" everything.
  const need = Math.max(2, kws.length - 1);
  return memory.filter((m) => kws.filter((k) => m.blob.includes(k)).length >= need).map((m) => m.name).slice(0, 3);
}
function proposal(p) {
  if (p.kind === 'tool-error') return `Add a memory (type: feedback or reference) that names this failure and its fix: \`${p.sig}\`. Seen in ${p.sessions.size} sessions — agents keep hitting it cold.`;
  if (p.kind === 'user-correction') return `Strengthen a directive memory: Remy corrected the same thing in ${p.sessions.size} sessions ("${p.sig}"). Make the rule explicit so it stops recurring.`;
  if (p.kind === 'hook-feedback') return `A hook fired this nag in ${p.sessions.size} sessions, so the rule it enforces is not followed up front. Move the rule earlier (SessionStart or UserPromptSubmit context) or make the memory that states it more direct.`;
  return `Register this friction in tools/agora/WORKFLOW_GAPS.md (it recurred in ${p.sessions.size} sessions) and note the workaround in memory.`;
}

// --- run -----------------------------------------------------------------------
const files = await sessionFiles();
for (const f of files) await scan(f);
const memory = await loadMemory();
const found = [...patterns.values()]
  .filter((p) => p.sessions.size >= MIN_SESSIONS)
  .map((p) => ({ ...p, sessions: [...p.sessions], covered: coveredBy(p.sig, memory), proposal: proposal(p) }))
  .sort((a, b) => b.sessions.length - a.sessions.length || b.count - a.count);

const totalMB = Math.round(files.reduce((a, f) => a + f.size, 0) / 1048576);
if (JSON_OUT) {
  console.log(JSON.stringify({ days: DAYS, files: files.length, records, patterns: found }, null, 2));
  process.exit(0);
}

const lines = [];
lines.push(`# Dream report — ${today}`, '');
lines.push(`Window: last ${DAYS} days · ${files.length} session files (${totalMB} MB) · ${records} user/assistant records · ${patterns.size} raw signals · **${found.length} patterns** seen in ≥ ${MIN_SESSIONS} sessions.`, '');
lines.push('This is a REVIEW report. Nothing was written to memory. Accept a proposal by making the memory edit yourself (or through `scripts/memoryWrite.mjs`); reject it by ignoring it.', '');
if (!found.length) lines.push('_No cross-session pattern cleared the threshold. Nothing to propose._');
found.forEach((p, i) => {
  lines.push(`## ${i + 1}. [${p.kind}] ${p.sig}`, '');
  lines.push(`- **Prevalence:** ${p.sessions.length} sessions · ${p.count} occurrences`);
  lines.push(p.covered.length ? `- **Covered by:** ${p.covered.map((c) => `\`${c}\``).join(', ')} — check it is still correct and actually prevents this` : '- **Covered by:** NOT covered by any memory');
  lines.push(`- **Proposed edit:** ${p.proposal}`, '', '  Examples:');
  for (const e of p.excerpts) lines.push(`  - \`${e.session.slice(0, 8)}\` ${e.ts ? e.ts.slice(0, 16) : ''} — ${e.raw.replace(/\s+/g, ' ')}`);
  lines.push('');
});
await mkdir(resolve(OUT, '..'), { recursive: true });
await writeFile(OUT, lines.join('\n'), 'utf8');
console.log(`dream: ${files.length} sessions (${totalMB} MB), ${records} records, ${found.length} patterns -> ${OUT}`);
for (const p of found.slice(0, 8)) console.log(`  [${p.kind}] ${p.sessions.length}x sessions ${p.covered.length ? '(covered)' : '(NOT covered)'} — ${p.sig.slice(0, 80)}`);
