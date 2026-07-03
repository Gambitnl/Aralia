// Backfill / update Agora categories for existing tasks.
// Supports dual tagging: work-type from TODO(...) + domain from first referenced path.
//
//   node tools/agora/categorize-open-tasks.mjs [--state open] [--url http://localhost:4319] [--token ...] [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_BASE_URL = 'http://localhost:4319';
const UNCATEGORIZED_TASK_CATEGORY = 'uncategorized';
const DEFAULT_STATE = 'open';

function parseArgs(argv) {
  const out = { flags: {}, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '--dry') {
      out.flags.dryRun = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        const key = arg.slice(2);
        const value = argv[i + 1];
        if (value && !value.startsWith('--')) {
          out.flags[key] = value;
          i++;
        } else {
          out.flags[key] = true;
        }
      } else {
        const key = arg.slice(2, eq);
        out.flags[key] = arg.slice(eq + 1);
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function normalizeCategoryInput(raw) {
  if (typeof raw !== 'string') return '';
  const value = raw.trim().toLowerCase();
  if (!value) return '';
  return value;
}

function normalizeCategoryList(raw = []) {
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const n = normalizeCategoryInput(r);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function normalizeTaskPath(raw) {
  let p = String(raw || '').trim().replace(/\\/g, '/');
  const marker = '/repos/aralia/';
  const lower = p.toLowerCase();
  const markerPos = lower.indexOf(marker);
  if (markerPos >= 0) {
    p = p.slice(markerPos + marker.length);
  }
  p = p.replace(/^[a-z]:\//i, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return p;
}

function categoryFromPath(raw) {
  const p = normalizeTaskPath(raw);
  if (!p) return UNCATEGORIZED_TASK_CATEGORY;
  const lower = p.toLowerCase();
  if (lower.startsWith('.github/')) return 'github';
  if (lower.startsWith('docs/projects/')) {
    const parts = lower.split('/');
    return `project:${parts[2] || 'docs'}`;
  }
  if (lower.startsWith('docs/')) return 'docs';
  if (lower.startsWith('src/')) return 'src';
  if (lower.startsWith('tools/')) return 'tools';
  if (lower.startsWith('scripts/')) return 'scripts';
  if (lower.startsWith('tests/')) return 'tests';
  if (lower.startsWith('misc/')) return 'misc';
  return UNCATEGORIZED_TASK_CATEGORY;
}

function firstPathFromRefs(refs = []) {
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const match = /([^:]+):\d+$/.exec(ref);
    const rawPath = match ? match[1] : ref;
    const category = categoryFromPath(rawPath);
    if (category !== UNCATEGORIZED_TASK_CATEGORY) return category;
  }
  return '';
}

function inferTodoCategoryFromBody(body) {
  if (typeof body !== 'string') return '';
  const match = /TODO\(\s*([^)]+)\s*\)/i.exec(body);
  if (!match) return '';

  const rawTag = match[1].trim().toLowerCase();
  const normalizedTag = rawTag.replace(/[^a-z0-9_-]/g, '-');
  if (!normalizedTag) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(normalizedTag)) return 'work:todo';
  if (/\blint\b/.test(rawTag) || /lint-intent/.test(normalizedTag)) return 'work:lint';
  if (/next-agent/.test(normalizedTag)) return 'work:next-agent';
  if (/navigator/.test(normalizedTag)) return 'work:navigator';
  if (/spell/.test(rawTag)) return 'work:spells';
  if (/docs|documentation/.test(rawTag)) return 'work:docs';
  if (/test/.test(rawTag)) return 'work:tests';
  if (/pass|sweep|cleanup|refactor/.test(rawTag)) return 'work:cleanup';
  if (/work|task|ticket/.test(rawTag)) return 'work:task';
  return `work:${normalizedTag}`;
}

function inferTaskCategories(task) {
  const output = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = normalizeCategoryInput(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  };

  const fromTodo = inferTodoCategoryFromBody(task.body);
  if (fromTodo) add(fromTodo);

  const fromRefs = firstPathFromRefs(task.refs || []);
  if (fromRefs) add(`domain:${fromRefs}`);

  if (!fromRefs && typeof task.body === 'string') {
    const fileMatch = /File:\s*([^\r\n]+)/i.exec(task.body);
    if (fileMatch) {
      const fileCategory = categoryFromPath(fileMatch[1]);
      if (fileCategory && fileCategory !== UNCATEGORIZED_TASK_CATEGORY) {
        add(`domain:${fileCategory}`);
      }
    }
  }

  if (!output.length) {
    add(UNCATEGORIZED_TASK_CATEGORY);
  }
  return output;
}

function sameCategorySet(a = [], b = []) {
  const s1 = normalizeCategoryList(a).sort();
  const s2 = normalizeCategoryList(b).sort();
  if (s1.length !== s2.length) return false;
  for (let i = 0; i < s1.length; i++) {
    if (s1[i] !== s2[i]) return false;
  }
  return true;
}

function identityDir() {
  const d = process.env.AGORA_DIR;
  return d ? (path.isAbsolute(d) ? d : path.resolve(process.cwd(), d)) : path.join(REPO_ROOT, '.agent', 'agora');
}

function loadIdentity(baseUrl) {
  try {
    const raw = fs.readFileSync(path.join(identityDir(), 'client-identity.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed[baseUrl] ? parsed[baseUrl] : null;
  } catch {
    return null;
  }
}

async function api(baseUrl, method, pathName, token, body) {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl + pathName, {
    method,
    headers,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const err = new Error(json && json.error ? `${pathName} ${res.status}: ${json.error}` : `${pathName} ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json || {};
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const baseUrl = (parsed.flags.url || parsed.flags.base || parsed.flags.endpoint || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const id = loadIdentity(baseUrl);
  const token = parsed.flags.token || (id && id.token);

  if (!token) {
    console.error('Error: missing token. Pass --token=<token> or ensure client-identity exists for this base URL.');
    process.exitCode = 1;
    return;
  }

  const state = typeof parsed.flags.state === 'string' ? parsed.flags.state : DEFAULT_STATE;
  const dryRun = parsed.flags['dry-run'] === true || parsed.flags['dry'] === true;

  const listResp = await api(baseUrl, 'GET', `/tasks?state=${encodeURIComponent(state)}`, token);
  const tasks = listResp.tasks || [];
  console.log(`Loaded ${tasks.length} task(s) with state="${state}" from ${baseUrl}`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  for (const task of tasks) {
    const nextCategories = inferTaskCategories(task);
    const currentCategories = task.categories && task.categories.length ? task.categories : [task.category];
    if (sameCategorySet(currentCategories, nextCategories)) {
      unchanged++;
      continue;
    }
    if (dryRun) {
      console.log(`dry-run: ${task.id} -> ${nextCategories.join(", ")}`);
      updated++;
      continue;
    }
    try {
      await api(baseUrl, 'POST', `/tasks/${encodeURIComponent(task.id)}/categories`, token, { categories: nextCategories });
      console.log(`updated: ${task.id} -> ${nextCategories.join(", ")}`);
      updated++;
    } catch (err) {
      errors++;
      console.error(`failed: ${task.id} -> ${err.message}`);
    }
  }
  console.log(`Done. updated=${updated}, unchanged=${unchanged}, errors=${errors}`);
  if (errors) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exitCode = 1;
});
