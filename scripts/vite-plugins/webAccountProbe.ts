import fs from 'fs/promises';
import path from 'path';

/**
 * Web account probes are dashboard snapshots for browser-authenticated SaaS
 * accounts. They deliberately store durable login state in per-account browser
 * profiles outside the repo, while returning only small, sanitized usage data
 * to Agent Matrix.
 */
export interface WebAccountProbeUsage {
  label: string;
  used?: number;
  limit?: number;
  pct?: number;
  resetsAt?: string;
}

export interface WebAccountProbeResult {
  provider: 'cursor';
  accountId: string;
  profileDir: string;
  fetchedAt: number;
  loginRequired: boolean;
  lines: string[];
  summary?: string;
  usage?: WebAccountProbeUsage;
}

interface ProbeCursorAccountOptions {
  homeDir?: string;
  fetchedAt?: number;
  runner?: (profileDir: string) => Promise<string>;
}

interface OpenCursorLoginOptions {
  homeDir?: string;
  opener?: (profileDir: string, options: { accountId: string; homeDir: string }) => Promise<void>;
}

interface ClearProfileOptions {
  homeDir?: string;
}

const ACCOUNT_ID_RE = /^[a-z0-9-]+$/;
const PROFILE_ROOT = '.aralia-browser-profiles';
const LOGIN_REQUIRED_RE = /\b(sign in|log in|authenticate|authentication|need to log in)\b/i;
const BROWSER_VERIFICATION_RE = /authenticator\.cursor\.sh|security verification|malicious bots|enable javascript and cookies|cloudflare/i;
const SENSITIVE_LINE_RE = /__cf|cf_chl|authorization_session|client_id|redirect_uri|nonce|token|cookie/i;

// Normalize page text into stable lines so parsers and UI tooltips never depend
// on whitespace from the provider's current layout.
const normalizeLines = (text: string) => {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !SENSITIVE_LINE_RE.test(line))
    .map((line) => line.slice(0, 220));
  return [...new Set(lines)].slice(0, 20);
};

const parseUsageFromLines = (lines: string[]) => {
  const joined = lines.join(' ');
  let match = joined.match(/(\d+)\s+of\s+(\d+)\s+(.+?)\s*used/i);
  if (match) {
    const used = Number(match[1]);
    const limit = Number(match[2]);
    const label = match[3].trim().replace(/\s+$/u, '').replace(/^used\s+/iu, '');
    return {
      usage: {
        used,
        limit,
        pct: Math.round((used / limit) * 100),
        label,
      } as WebAccountProbeUsage,
      summary: `${used} of ${limit} ${label} used`,
    };
  }

  match = joined.match(/(\d+(?:\.\d+)?)\s*%\s*used/i);
  if (match) {
    return {
      usage: {
        pct: Number(match[1]),
        label: 'used',
      } as WebAccountProbeUsage,
      summary: `${match[1]}% used`,
    };
  }

  return {};
};

// Account IDs become profile directory names, so the allowed grammar is kept
// intentionally narrow. This prevents path separators, traversal, spaces, and
// mixed-case aliases from escaping the profile root or creating duplicate lanes.
export const getWebAccountProfileDir = (accountId: string, homeDir = process.env.USERPROFILE || process.env.HOME): string => {
  if (!ACCOUNT_ID_RE.test(accountId)) {
    throw new Error(`Invalid web account id: ${accountId}`);
  }
  if (!homeDir) {
    throw new Error('HOME path is not available for web account profile directories');
  }
  return path.join(homeDir, PROFILE_ROOT, accountId);
};

export const isWebAccountProbeAgent = (accountId: string): boolean => (
  /^cursor-[a-z0-9-]+$/.test(accountId)
);

// Cursor does not expose a stable local CLI usage command, so the first provider
// reads dashboard text and converts only the small usage facts Agent Matrix
// needs. Secrets, cookies, request headers, and raw browser state stay out of
// this result object.
export const parseCursorDashboardText = (
  accountId: string,
  text: string,
  profileDir: string,
  fetchedAt = Date.now(),
): WebAccountProbeResult => {
  const needsBrowserVerification = BROWSER_VERIFICATION_RE.test(text);
  const lines = needsBrowserVerification ? ['Cursor browser verification required.'] : normalizeLines(text);
  const loginRequired = needsBrowserVerification || LOGIN_REQUIRED_RE.test(text);
  const usageInfo = loginRequired ? {} : parseUsageFromLines(lines);
  const output: WebAccountProbeResult = {
    provider: 'cursor',
    accountId,
    profileDir,
    fetchedAt,
    loginRequired,
    lines,
  };

  if (usageInfo.usage) {
    output.usage = usageInfo.usage;
  }
  if (usageInfo.summary) {
    output.summary = usageInfo.summary;
  }
  return output;
};

// The Playwright import stays lazy so normal Vite startup and unit tests do not
// launch or even load browser automation. Tests inject a runner instead.
const getDefaultProbeRunner = async (profileDir: string): Promise<string> => {
  const { chromium } = await import('playwright');
  const context = await chromium.launchPersistentContext(profileDir, { headless: true });
  const page = await context.newPage();
  try {
    await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const text = await page.textContent('body');
    return text || '';
  } finally {
    await context.close();
  }
};

const getDefaultLoginOpener = async (profileDir: string, options: { homeDir: string }) => {
  void options;
  const { chromium } = await import('playwright');
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
  });
  const page = await context.newPage();
  await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.bringToFront();
};

// Hidden probes are read-only snapshots. Interactive auth is intentionally
// handled by openCursorAccountLogin so a background probe never surprises the
// user with a login flow.
export const probeCursorAccount = async (
  accountId: string,
  options: ProbeCursorAccountOptions = {},
): Promise<WebAccountProbeResult> => {
  const profileDir = getWebAccountProfileDir(accountId, options.homeDir);
  const runner = options.runner ?? getDefaultProbeRunner;
  const text = await runner(profileDir);
  return parseCursorDashboardText(accountId, text, profileDir, options.fetchedAt);
};

// Login opens a headed browser bound to one account profile. The context is not
// closed here: closing it would immediately dismiss the browser the user needs
// for completing the account sign-in.
export const openCursorAccountLogin = async (
  accountId: string,
  options: OpenCursorLoginOptions = {},
): Promise<{ ok: boolean; accountId: string; profileDir: string; message: string }> => {
  const homeDir = options.homeDir || process.env.USERPROFILE || process.env.HOME;
  let profileDir = '';
  try {
    if (!homeDir) {
      throw new Error('HOME path is not available for web account profile directories');
    }
    profileDir = getWebAccountProfileDir(accountId, homeDir);
    const opener = options.opener ?? ((dir) => getDefaultLoginOpener(dir, { homeDir }));
    await opener(profileDir);
    return {
      ok: true,
      accountId,
      profileDir,
      message: 'cursor login browser started',
    };
  } catch (error) {
    return {
      ok: false,
      accountId,
      profileDir,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

// Clearing a session deletes exactly one validated profile directory. Other
// accounts under the same profile root are left in place for isolation.
export const clearWebAccountProfile = async (
  accountId: string,
  options: ClearProfileOptions = {},
): Promise<{ ok: boolean; accountId: string; profileDir: string }> => {
  let profileDir = '';
  try {
    profileDir = getWebAccountProfileDir(accountId, options.homeDir);
    await fs.rm(profileDir, { recursive: true, force: true });
    return { ok: true, accountId, profileDir };
  } catch {
    return { ok: false, accountId, profileDir };
  }
};
