#!/usr/bin/env node
/**
 * planmap-session-groups.mjs — refresh public/planmap/session-groups.json from the
 * Claude desktop app's local state.
 *
 * The desktop app stores which chat session belongs to which custom sidebar group in
 * %APPDATA%\Claude\claude_desktop_config.json (group ids only — display names live
 * server-side). Session titles live in %APPDATA%\Claude\claude-code-sessions\.
 * This script joins the two and rewrites the DERIVED fields of each group entry
 * (sessions count, sampleTitles). Hand-edited fields (name, theme, campaign, topics)
 * are preserved. Groups that appear in the app but not yet in the file are appended
 * with theme "NEW — unmapped".
 *
 *   node tools/agora/planmap-session-groups.mjs           # refresh + validate
 *   node tools/agora/planmap-session-groups.mjs --check   # validate only, no write
 *
 * Multi-agent note: acquire the Agora file lock on public/planmap/session-groups.json
 * first when other agents are live.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const mapFile = path.join(repo, 'public', 'planmap', 'session-groups.json');
const topicsFile = path.join(repo, 'public', 'planmap', 'topics.json');
const checkOnly = process.argv.includes('--check');
const die = (msg) => { console.error(`planmap-session-groups: ${msg}`); process.exit(1); };

const appData = process.env.APPDATA;
if (!appData) die('APPDATA not set — this script reads the Claude desktop app state on Windows');
const cfgFile = path.join(appData, 'Claude', 'claude_desktop_config.json');
if (!fs.existsSync(cfgFile)) die(`desktop config not found: ${cfgFile}`);

const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const slice = cfg?.preferences?.epitaxyPrefs?.['dframe-local-slice'] ?? {};
const order = slice.customGroupOrder ?? {};
if (!Object.keys(order).length) die('no customGroupOrder in desktop config — has the app state moved?');

// Session titles: claude-code-sessions/<account>/<project>/<sessionId>.json
const titles = new Map();
const sessRoot = path.join(appData, 'Claude', 'claude-code-sessions');
if (fs.existsSync(sessRoot)) {
  for (const account of fs.readdirSync(sessRoot)) {
    const accountDir = path.join(sessRoot, account);
    if (!fs.statSync(accountDir).isDirectory()) continue;
    for (const project of fs.readdirSync(accountDir)) {
      const projectDir = path.join(accountDir, project);
      if (!fs.statSync(projectDir).isDirectory()) continue;
      for (const f of fs.readdirSync(projectDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(projectDir, f), 'utf8'));
          if (j.sessionId) titles.set(j.sessionId, { title: j.title ?? '(untitled)', last: j.lastActivityAt ?? 0 });
        } catch { /* partial write by the app — skip */ }
      }
    }
  }
}

const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const topics = JSON.parse(fs.readFileSync(topicsFile, 'utf8'));
const topicIds = new Set(topics.topics.map((t) => t.id));
const campaignIds = new Set(Object.keys(topics.campaigns));
const byId = new Map(map.groups.map((g) => [g.id, g]));

let problems = 0;
for (const g of map.groups) {
  if (g.campaign !== null && !campaignIds.has(g.campaign)) { console.error(`  ✗ ${g.id}: unknown campaign "${g.campaign}"`); problems++; }
  for (const t of g.topics) if (!topicIds.has(t)) { console.error(`  ✗ ${g.id}: unknown topic "${t}"`); problems++; }
}

for (const [groupId, members] of Object.entries(order)) {
  let g = byId.get(groupId);
  if (!g) {
    g = { id: groupId, name: null, theme: 'NEW — unmapped', campaign: null, topics: [], sessions: 0, sampleTitles: [] };
    map.groups.push(g);
    byId.set(groupId, g);
    console.log(`  + new group ${groupId} — map it by hand (theme/campaign/topics)`);
  }
  const known = members
    .map((m) => titles.get(m.replace(/^code:/, '')))
    .filter(Boolean)
    .sort((a, b) => b.last - a.last);
  g.sessions = members.length;
  g.sampleTitles = known.slice(0, 4).map((k) => k.title);
}

// Groups deleted in the app keep their row (anchors may still be useful) but get flagged.
for (const g of map.groups) {
  if (!order[g.id]) console.log(`  ~ ${g.id} ("${g.theme}") no longer exists in the app`);
}

if (problems) die(`${problems} bad anchor(s) — fix campaign/topic ids in ${path.relative(repo, mapFile)}`);
if (checkOnly) { console.log('check ok — anchors valid, no write'); process.exit(0); }

const now = new Date();
map.updated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
fs.writeFileSync(mapFile, JSON.stringify(map, null, 2) + '\n');
console.log(`refreshed ${path.relative(repo, mapFile)} — ${map.groups.length} groups, ${titles.size} local sessions seen`);
