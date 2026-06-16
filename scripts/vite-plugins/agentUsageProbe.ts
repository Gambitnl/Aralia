/**
 * agentUsageProbe — dev-server middleware that fetches LIVE usage/quota data
 * from locally installed AI coding agents and isolated web-account profiles.
 * CLI probes drive TUIs in a hidden PTY; web-account probes use their own
 * browser profiles and return only normalized dashboard facts.
 *
 * GET /api/agent-usage            → all cached entries
 * GET /api/agent-usage?agent=codex            → cached (probe if absent)
 * GET /api/agent-usage?agent=codex&refresh=1  → force a fresh probe
 *
 * Probes are serialized (one PTY at a time) and cached for CACHE_TTL_MS.
 * Each probe takes ~15-45s (TUI boot + panel render), so the dashboard
 * shows the cached value instantly and refreshes on demand.
 */
import * as pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  clearWebAccountProfile,
  isWebAccountProbeAgent,
  openCursorAccountLogin,
  probeCursorAccount,
} from './webAccountProbe';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_FILE = path.join(process.cwd(), '.agent', 'usage-cache.json');
const WEB_ACCOUNT_AGENTS = ['cursor-main', 'cursor-alt'];

// eslint-disable-next-line no-control-regex
const ANSI_RE = /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

interface ProbeStep { send: string; delayMs?: number; perCharMs?: number }
interface Recipe {
  /** command resolved through cmd.exe so npm shims work */
  cli: string;
  /** skip the PTY entirely — collect() is the whole probe */
  collectOnly?: boolean;
  env?: Record<string, string>;
  /** delete every inherited env var starting with one of these prefixes */
  envStripPrefixes?: string[];
  bootPattern: RegExp;
  bootTimeoutMs?: number;
  /** extra settle time after boot before typing (plugin-heavy TUIs) */
  preDelayMs?: number;
  steps: ProbeStep[];
  /** after the last step, wait until this appears (or settleMs elapses) */
  donePattern?: RegExp;
  settleMs?: number;
  exitSends: string[];
  parse: (clean: string) => Record<string, unknown>;
  /** runs at finish; merged over parse() output (e.g. scrape the CLI's own log files) */
  collect?: () => Record<string, unknown>;
}

/** Claude Code: the TUI renders with heavy cursor-positioning (regex-hostile),
 * but ccusage computes the active 5h block locally from ~/.claude transcripts. */
function claudeCcusage(): Record<string, unknown> {
  try {
    const out = execSync('npx -y ccusage@latest blocks --json --active', {
      encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const b = (JSON.parse(out).blocks || [])[0];
    if (!b) return { summary: 'no active 5h block (idle)', lines: ['no active 5h block (idle)'] };
    const reset = new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const summary = `5h block ${(b.totalTokens / 1e6).toFixed(1)}M tok · ~$${Math.round(b.costUSD || 0)} API-equiv · resets ${reset}`;
    return { summary, blockTokens: b.totalTokens, resetAt: b.endTime, lines: [summary] };
  } catch (e) {
    return { error: 'ccusage failed: ' + (e as Error).message };
  }
}

/** newest qodercli run log contains `quota/usage response: {json}` on every boot */
function qoderLogQuota(): Record<string, unknown> {
  try {
    const runsDir = path.join(process.env.USERPROFILE || '', '.qoder', 'logs', 'runs');
    const newest = fs.readdirSync(runsDir)
      .map((n) => ({ n, t: fs.statSync(path.join(runsDir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];
    if (!newest) return { error: 'no qoder run logs' };
    const log = fs.readFileSync(path.join(runsDir, newest.n, 'qodercli.log'), 'utf8');
    const m = [...log.matchAll(/quota\/usage response: (\{.*\})/g)].pop();
    if (!m) return { error: 'no quota response in log' };
    const q = JSON.parse(m[1]);
    return {
      plan: q.userType,
      quotaUsedPct: q.totalUsagePercentage,
      credits: `${q.userQuota?.used}/${q.userQuota?.total} ${q.userQuota?.unit || ''}`.trim(),
      exceeded: q.isQuotaExceeded,
      lines: [`plan ${q.userType} · credits ${q.userQuota?.used}/${q.userQuota?.total} · ${q.isQuotaExceeded ? 'plan credits exhausted (free 200/day Qwen promo unaffected)' : 'quota available'}`],
    };
  } catch (e) {
    return { error: `log scrape failed: ${(e as Error).message}` };
  }
}

const pctLines = (clean: string, re: RegExp) => {
  const out: string[] = [];
  for (const line of clean.split('\n')) {
    const l = line.trim().replace(/\s{2,}/g, ' ');
    if (re.test(l) && !out.includes(l)) out.push(l);
  }
  return out;
};

const RECIPES: Record<string, Recipe> = {
  codex: {
    cli: 'codex',
    bootPattern: /5h \d+% left|Context \d+% left/,
    steps: [{ send: '/status', perCharMs: 120 }, { send: '\r', delayMs: 1200 }],
    donePattern: /Weekly limit/,
    settleMs: 6000,
    exitSends: ['\x1b', '/exit', '\r'],
    parse: (clean) => {
      const limits: { window: string; pctLeft: number; resets: string }[] = [];
      const re = /(5h|Weekly) limit:\s*\[[^\]]*\]\s*(\d+)% left \(resets ([^)]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clean))) limits.push({ window: m[1], pctLeft: Number(m[2]), resets: m[3] });
      const account = clean.match(/Account:\s*(\S+ \([^)]+\))/)?.[1];
      return { account, limits, lines: pctLines(clean, /% left/) };
    },
  },
  claude: {
    // The TUI renders /usage with cursor-positioned writes that defeat stream
    // regexes (verified visually: boots fine, scrapes garbage). ccusage reads
    // the local transcripts instead — faster, no PTY, no TUI fragility.
    cli: 'claude',
    collectOnly: true,
    bootPattern: /unused/,
    steps: [],
    exitSends: [],
    parse: () => ({}),
    collect: claudeCcusage,
  },
  agy: {
    cli: 'agy',
    bootPattern: /\? for shortcuts/,
    steps: [{ send: '/usage', perCharMs: 120 }, { send: '\r', delayMs: 1200 }],
    donePattern: /Quota available|Model Quota/,
    settleMs: 8000,
    exitSends: ['\x1b', '/exit', '\r'],
    parse: (clean) => {
      const models: { model: string; pct: number }[] = [];
      const re = /(^|\n)[ \t]*([A-Za-z][^\n]+?)[ \t]*\n[ \t]*[█░ ]+[ \t]*(\d+)%/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clean))) {
        const model = m[2].trim();
        if (model && !/Model Quota|usage/i.test(model) && !models.some((x) => x.model === model)) {
          models.push({ model, pct: Number(m[3]) });
        }
      }
      return { models, lines: pctLines(clean, /\d+%/) };
    },
  },
  qoder: {
    // boot only — the CLI fetches /quota/usage at startup and logs the JSON; we scrape that
    cli: 'qodercli',
    bootPattern: /\? for shortcuts/,
    preDelayMs: 4000,
    steps: [],
    settleMs: 1000,
    exitSends: ['\x03', '\x03'],
    parse: () => ({}),
    collect: qoderLogQuota,
  },
  'qoder-cranenre': {
    // boot-only + log scrape, like the bob lane; auth comes from the PAT file
    // at ~/.qoder-pats/cranenre.txt (outside the repo), injected in runProbe.
    cli: 'qodercli',
    env: { QODER_CONFIG_DIR: path.join(process.env.USERPROFILE || '', '.qoder-cli-cranenre') },
    bootPattern: /\? for shortcuts/,
    preDelayMs: 4000,
    steps: [],
    settleMs: 1000,
    exitSends: ['\x03', '\x03'],
    parse: () => ({}),
    collect: qoderLogQuota,
  },
  gemini: {
    cli: 'gemini',
    bootPattern: /quota\s|% used/,
    steps: [],
    settleMs: 3000,
    exitSends: ['/quit', '\r'],
    parse: (clean) => {
      // footer column order: ... quota | memory | context — first "% used" is quota
      const quota = clean.match(/(\d+)% used/)?.[1];
      return { quotaUsedPct: quota ? Number(quota) : undefined, lines: pctLines(clean, /% used/).slice(0, 3) };
    },
  },
};

interface CacheEntry { agent: string; at: number; ok: boolean; data?: Record<string, unknown>; error?: string }
let cache: Record<string, CacheEntry> = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* fresh */ }
const persist = () => { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); } catch { /* ignore */ } };

let queue: Promise<unknown> = Promise.resolve();

// Browser-backed account probes live beside the CLI probes, but they are
// capped to explicit, validated account ids so the middleware never accepts
// arbitrary profile names or returns raw browser state.
const listAgents = () => [...new Set([...Object.keys(RECIPES), ...WEB_ACCOUNT_AGENTS])];

const readJsonBody = async (req: any): Promise<Record<string, unknown>> => {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
};

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const runWebAccountProbe = async (accountId: string, logger: { info: (s: string) => void }): Promise<CacheEntry> => {
  try {
    const result = await probeCursorAccount(accountId);
    const selectorMissing = !result.loginRequired && !result.summary && !result.usage;
    const entry: CacheEntry = {
      agent: accountId,
      at: result.fetchedAt,
      ok: !result.loginRequired && !selectorMissing,
      data: result as unknown as Record<string, unknown>,
      error: result.loginRequired ? 'login required' : selectorMissing ? 'selector missing' : undefined,
    };
    cache[accountId] = entry;
    persist();
    logger.info(`[usage-probe] ${accountId}: ${entry.ok ? 'ok' : `FAILED (${entry.error})`}`);
    return entry;
  } catch (error) {
    const entry: CacheEntry = {
      agent: accountId,
      at: Date.now(),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    cache[accountId] = entry;
    persist();
    logger.info(`[usage-probe] ${accountId}: FAILED (${entry.error})`);
    return entry;
  }
};

function runProbe(agent: string, logger: { info: (s: string) => void }): Promise<CacheEntry> {
  const recipe = RECIPES[agent];
  if (!recipe) return Promise.resolve({ agent, at: Date.now(), ok: false, error: `no recipe for "${agent}"` });

  const job = () => new Promise<CacheEntry>((resolve) => {
    if (recipe.collectOnly && recipe.collect) {
      let entry: CacheEntry;
      try {
        const data = recipe.collect();
        entry = { agent, at: Date.now(), ok: !data.error, data, error: data.error as string | undefined };
      } catch (e) {
        entry = { agent, at: Date.now(), ok: false, error: (e as Error).message };
      }
      cache[agent] = entry;
      persist();
      logger.info(`[usage-probe] ${agent}: ${entry.ok ? 'ok (collect-only)' : `FAILED (${entry.error})`}`);
      resolve(entry);
      return;
    }
    let buf = '';
    let finished = false;
    // surface this hidden PTY in the Live Dispatches grid (agentSessionManager)
    const ext = (globalThis as { __agentSessionExternal?: { register: (o: object) => void; data: (id: string, c: string) => void; finish: (id: string, ok: boolean, n?: string) => void } }).__agentSessionExternal;
    const extId = `probe-${agent}-${Date.now().toString(36)}`;
    ext?.register({ id: extId, title: `usage probe · ${agent}`, agent, cmd: `cmd.exe /c ${recipe.cli} (hidden PTY, usage scrape)` });
    const env: Record<string, string> = { ...(process.env as Record<string, string>), ...(recipe.env || {}) };
    for (const [k, v] of Object.entries(env)) if (v === '') delete env[k];
    for (const prefix of recipe.envStripPrefixes || []) {
      for (const k of Object.keys(env)) if (k.startsWith(prefix)) delete env[k];
    }
    if (agent === 'qoder-cranenre') {
      // PAT lives outside the repo; the vite process env predates setx, so read the file
      try {
        env.QODER_PERSONAL_ACCESS_TOKEN = fs.readFileSync(
          path.join(process.env.USERPROFILE || '', '.qoder-pats', 'cranenre.txt'), 'utf8').trim();
      } catch { /* not provisioned — probe will show login state */ }
    }

    let proc: pty.IPty;
    try {
      proc = pty.spawn('cmd.exe', ['/c', recipe.cli], { name: 'xterm-256color', cols: 200, rows: 50, cwd: process.cwd(), env });
    } catch (err) {
      resolve({ agent, at: Date.now(), ok: false, error: `spawn failed: ${(err as Error).message}` });
      return;
    }

    const finish = (ok: boolean, error?: string) => {
      if (finished) return;
      finished = true;
      const clean = stripAnsi(buf);
      let data: Record<string, unknown> | undefined;
      if (ok) {
        try { data = recipe.parse(clean); } catch (e) { ok = false; error = `parse failed: ${(e as Error).message}`; }
        if (recipe.collect) {
          try { data = { ...(data || {}), ...recipe.collect() }; } catch (e) { /* keep parse data */ void e; }
        }
      }
      // graceful exit, then hard kill as backstop
      (async () => {
        for (const s of recipe.exitSends) { try { proc.write(s); } catch { /* gone */ } await sleep(400); }
        await sleep(1500);
        try { proc.kill(); } catch { /* gone */ }
      })();
      const entry: CacheEntry = { agent, at: Date.now(), ok, data, error };
      cache[agent] = entry;
      persist();
      ext?.finish(extId, ok, error);
      logger.info(`[usage-probe] ${agent}: ${ok ? 'ok' : `FAILED (${error})`}`);
      resolve(entry);
    };

    proc.onData((d) => {
      buf += d;
      if (buf.length > 400_000) buf = buf.slice(-400_000);
      ext?.data(extId, d);
    });
    proc.onExit(() => { if (!finished) finish(buf.length > 0, 'process exited early'); });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (re: RegExp, timeoutMs: number) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (re.test(stripAnsi(buf))) return true;
        await sleep(500);
      }
      return false;
    };

    (async () => {
      // some CLIs gate boot behind an update prompt or a workspace-trust dialog
      const updateRe = /Press enter to continue|Update now \(runs|trust the files in this folder/;
      const first = await waitFor(new RegExp(`${recipe.bootPattern.source}|${updateRe.source}`), recipe.bootTimeoutMs ?? 30_000);
      if (!first) { finish(false, `boot timeout; tail: ${stripAnsi(buf).slice(-200).replace(/\s+/g, ' ')}`); return; }
      if (!recipe.bootPattern.test(stripAnsi(buf)) && updateRe.test(stripAnsi(buf))) {
        if (/trust the files/.test(stripAnsi(buf))) { proc.write('\r'); } // accept default "Yes" — own repo
        else { proc.write('2'); await sleep(600); proc.write('\r'); }     // update prompt: "Skip"
        const booted = await waitFor(recipe.bootPattern, recipe.bootTimeoutMs ?? 30_000);
        if (!booted) { finish(false, `boot timeout after update prompt; tail: ${stripAnsi(buf).slice(-200).replace(/\s+/g, ' ')}`); return; }
      }
      await sleep(recipe.preDelayMs ?? 1500);
      const scrapeStart = buf.length;
      for (const step of recipe.steps) {
        if (step.perCharMs) {
          for (const ch of step.send) { proc.write(ch); await sleep(step.perCharMs); }
        } else {
          proc.write(step.send);
        }
        await sleep(step.delayMs ?? 400);
      }
      if (recipe.donePattern) {
        const seen = await waitFor(
          new RegExp(recipe.donePattern.source, recipe.donePattern.flags),
          recipe.settleMs ?? 10_000,
        );
        if (!seen) await sleep(2000); // give the panel one more beat, then scrape what's there
      } else {
        await sleep(recipe.settleMs ?? 5000);
      }
      // scrape only post-boot output so stale scrollback never matches
      buf = buf.slice(0, scrapeStart) + buf.slice(scrapeStart);
      finish(true);
    })().catch((e) => finish(false, (e as Error).message));

    setTimeout(() => finish(buf.length > 0, finished ? undefined : 'probe timeout'), 90_000);
  });

  const next = queue.then(job, job);
  queue = next;
  return next as Promise<CacheEntry>;
}

export const agentUsageProbe = () => ({
  name: 'agent-usage-probe',
  configureServer(server: { middlewares: { use: (p: string, h: (req: any, res: any) => void) => void }; config: { logger: { info: (s: string) => void } } }) {
    server.middlewares.use('/api/agent-usage', async (req: any, res: any) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const agent = url.searchParams.get('agent');
      const refresh = url.searchParams.get('refresh') === '1';
      try {
        if (!agent) {
          sendJson(res, 200, { agents: listAgents(), cache });
          return;
        }
        const cached = cache[agent];
        if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
          sendJson(res, 200, cached);
          return;
        }
        const entry = isWebAccountProbeAgent(agent)
          ? await runWebAccountProbe(agent, server.config.logger)
          : await runProbe(agent, server.config.logger);
        sendJson(res, 200, entry);
      } catch (err) {
        sendJson(res, 500, { ok: false, error: (err as Error).message });
      }
    });

    server.middlewares.use('/api/web-account-login', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
      }
      try {
        const body = await readJsonBody(req);
        const accountId = String(body.accountId || '');
        if (!isWebAccountProbeAgent(accountId)) {
          sendJson(res, 400, { ok: false, error: 'invalid web account id' });
          return;
        }
        const result = await openCursorAccountLogin(accountId);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err instanceof SyntaxError ? 400 : 500, { ok: false, error: (err as Error).message });
      }
    });

    server.middlewares.use('/api/web-account-profile', async (req: any, res: any) => {
      if (req.method !== 'DELETE') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
      }
      try {
        const body = await readJsonBody(req);
        const accountId = String(body.accountId || '');
        if (!isWebAccountProbeAgent(accountId)) {
          sendJson(res, 400, { ok: false, error: 'invalid web account id' });
          return;
        }
        const result = await clearWebAccountProfile(accountId);
        delete cache[accountId];
        persist();
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, err instanceof SyntaxError ? 400 : 500, { ok: false, error: (err as Error).message });
      }
    });
  },
});
