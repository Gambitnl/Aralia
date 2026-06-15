# Isolated Web Account Probes Design

## Goal

Add an on-demand web account probe system to Agent Matrix, with Cursor as the
first provider. The system should fetch live account usage only when the user
clicks `probe` or `Fetch all live`, keep multiple accounts isolated from each
other, and render dashboard-native usage state instead of streaming screenshots
or continuously polling a website.

## Non-Goals

- Do not embed a user's normal Chrome profile.
- Do not poll Cursor every few seconds or minutes.
- Do not use screenshot crops as the primary data path.
- Do not stream a remote website component inside Agent Matrix.
- Do not add a new browser automation dependency while Playwright is already
  available in the repo.

## User Experience

Agent Matrix keeps its current quota-chip pattern. Cursor gains account-specific
lanes, starting with `cursor-main` and using the same pattern for accounts such
as `cursor-alt`.

Each account lane exposes three states:

- `probe`: runs a hidden, on-demand read using that lane's isolated browser
  profile.
- `open login`: opens a visible browser for that one lane if the hidden probe
  detects that Cursor needs authentication.
- `clear session`: optional recovery action that removes only that lane's
  browser profile, never another account's profile.

The tile shows the most recent timestamped snapshot. A stale snapshot is still
shown as cached data until the next manual refresh succeeds or fails.

## Architecture

Use Playwright's `chromium.launchPersistentContext` with one persistent
`userDataDir` per account. The user profile stores durable login state outside
the repo, while `.agent` keeps only transient probe cache/results.

Recommended profile paths:

- `%USERPROFILE%\.aralia-browser-profiles\cursor-main`
- `%USERPROFILE%\.aralia-browser-profiles\cursor-alt`

Recommended cache path:

- `F:\Repos\Aralia\.agent\usage-cache.json`

The first implementation should extend the existing `/api/agent-usage` shape:

- `GET /api/agent-usage?agent=cursor-main`
- `GET /api/agent-usage?agent=cursor-main&refresh=1`

If the current `agentUsageProbe.ts` becomes too broad, split browser probes into
a focused helper module and keep `agentUsageProbe.ts` as the endpoint/queue
owner.

## Data Flow

1. User clicks `probe` on a Cursor account tile.
2. Agent Matrix calls `/api/agent-usage?agent=cursor-main&refresh=1`.
3. The Vite middleware serializes the probe through the existing probe queue.
4. The Cursor probe launches a hidden Playwright persistent context for
   `cursor-main`.
5. The probe opens `https://cursor.com/dashboard`.
6. If Cursor requires login, the probe returns `{ ok: false, loginRequired:
   true }`.
7. If already logged in, the probe reads usage state from DOM text or reachable
   page data, normalizes it, writes the cache, and returns a dashboard-friendly
   payload.
8. Agent Matrix renders its own usage bar/text from that payload.

## Cursor Probe Result

The normalized data should be intentionally small:

```ts
interface WebAccountProbeResult {
  accountId: string;
  provider: 'cursor';
  profileDir: string;
  loginRequired: boolean;
  fetchedAt: number;
  summary?: string;
  usage?: {
    label: string;
    used?: number;
    limit?: number;
    pct?: number;
    resetsAt?: string;
  };
  lines: string[];
}
```

The returned `profileDir` is for transparency only. It must never include
cookies, tokens, request headers, or page secrets.

## Login Flow

Hidden probes should never force an interactive login. If login is needed, the
dashboard should offer a visible `open login` action for that specific account.

The visible login action should:

- Use the same Playwright `userDataDir` as that account's hidden probe.
- Launch headed.
- Start from a neutral working directory such as `%USERPROFILE%`, matching the
  existing login-command caution in the local session manager.
- Avoid remote debugging ports unless a dedicated debugging task explicitly
  needs them.

## Error Handling

Expected failures should become tile states, not terminal-only failures:

- `loginRequired`: show `login needed` and reveal `open login`.
- `profileLocked`: show that this account profile is already open.
- `selectorMissing`: show that Cursor's dashboard layout changed.
- `timeout`: show that the account page did not settle in time.
- `probeFailed`: show the concise error and keep the previous cached snapshot.

## Testing

Unit tests should cover the probe normalization and endpoint behavior without
requiring a live Cursor login:

- Cache hit returns without launching Playwright.
- Forced refresh calls the account probe.
- Login-required result is preserved in the response.
- Cursor parser converts representative page text into normalized usage data.
- Profile path generation keeps account IDs inside the intended profile root.

Manual verification is required for the first live Cursor account because the
real dashboard and login state are external:

- First hidden probe reports `login needed`.
- `open login` opens the correct isolated profile.
- After login, hidden probe reads data on demand.
- A second account profile does not inherit the first account's login.

## Open Risks

- Cursor may render the usage bar in a way that requires inspecting network
  responses rather than simple DOM text.
- Cursor may change dashboard labels or account quota wording.
- Persistent browser profiles cannot be used concurrently by two Playwright
  contexts.
- Headless authentication can fail for some login providers, so the visible
  login fallback must stay part of the design.
