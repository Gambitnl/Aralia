# Isolated Web Account Probes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an on-demand isolated Cursor account probe for Agent Matrix, using one persistent Playwright profile per account and no continuous polling.

**Architecture:** Add a focused browser probe helper beside the existing Vite usage-probe middleware. Keep `/api/agent-usage` as the dashboard contract, add Cursor account IDs as probeable agents, and add explicit login/session actions for the account-specific browser profile.

**Tech Stack:** TypeScript, Vite middleware, Playwright `chromium.launchPersistentContext`, Vitest, static Agent Matrix HTML/JS.

---

## File Structure

- Create `scripts/vite-plugins/webAccountProbe.ts`: owns account ID validation, profile path generation, Cursor dashboard probing, visible login launch, profile clearing, and Cursor usage parsing.
- Create `scripts/vite-plugins/__tests__/webAccountProbe.test.ts`: covers parser behavior, login-needed responses, profile path safety, and injected probe dependencies without a live Cursor login.
- Modify `scripts/vite-plugins/agentUsageProbe.ts`: delegates `cursor-main` and future `cursor-*` IDs to `webAccountProbe`, preserving the existing `/api/agent-usage` cache and refresh contract.
- Modify `misc/agent_matrix.html`: adds account-aware Cursor lane rendering, `open login`, and `clear session` actions while preserving the existing `probe` and `Fetch all live` controls.

## Task 1: Browser Probe Helper

**Files:**
- Create: `scripts/vite-plugins/webAccountProbe.ts`
- Test: `scripts/vite-plugins/__tests__/webAccountProbe.test.ts`

- [ ] **Step 1: Write failing tests for safe profile paths**

Add tests proving `cursor-main` resolves under `%USERPROFILE%\.aralia-browser-profiles` and unsafe account IDs are rejected.

Run:

```powershell
npx vitest run scripts/vite-plugins/__tests__/webAccountProbe.test.ts
```

Expected: fails because `webAccountProbe.ts` does not exist.

- [ ] **Step 2: Implement account validation and profile path generation**

Export `getWebAccountProfileDir(accountId: string, homeDir?: string): string` and allow only lowercase letters, numbers, and hyphens.

- [ ] **Step 3: Write failing parser tests**

Add representative Cursor dashboard text tests for:

- login required text
- a numeric usage phrase such as `23 of 50 premium requests used`
- a percentage phrase such as `46% used`

Expected: fails because parser is missing.

- [ ] **Step 4: Implement Cursor text normalization**

Export `parseCursorDashboardText(accountId: string, text: string, profileDir: string, fetchedAt?: number)` returning the normalized probe result from the design spec.

- [ ] **Step 5: Write failing probe tests with injected browser dependency**

Use dependency injection so tests can pass a fake browser runner that returns page text, throws a profile lock error, or simulates login-required content.

- [ ] **Step 6: Implement hidden probe, visible login, and clear session helpers**

Export:

```ts
probeCursorAccount(accountId: string, options?: ProbeCursorAccountOptions): Promise<WebAccountProbeResult>
openCursorAccountLogin(accountId: string, options?: OpenCursorLoginOptions): Promise<{ ok: boolean; accountId: string; profileDir: string; message: string }>
clearWebAccountProfile(accountId: string, options?: { homeDir?: string }): Promise<{ ok: boolean; accountId: string; profileDir: string }>
```

The real probe should use Playwright only inside the production runner path so unit tests do not launch a browser.

## Task 2: Usage Probe Endpoint Integration

**Files:**
- Modify: `scripts/vite-plugins/agentUsageProbe.ts`
- Test: `scripts/vite-plugins/__tests__/webAccountProbe.test.ts`

- [ ] **Step 1: Write failing test for Cursor account recipe detection**

Add a test proving `isWebAccountProbeAgent('cursor-main')` is true and `isWebAccountProbeAgent('codex')` is false.

- [ ] **Step 2: Implement web account delegation**

In `agentUsageProbe.ts`, detect `cursor-*` agents before `RECIPES` lookup and call `probeCursorAccount(agent)`. Store the result in the existing `cache[agent]` shape.

- [ ] **Step 3: Add login/session endpoints**

Add middleware routes:

- `POST /api/web-account-login` with `{ accountId }`
- `DELETE /api/web-account-profile` with `{ accountId }`

Both routes should return JSON, validate account IDs, and never expose cookies/tokens.

## Task 3: Agent Matrix UI

**Files:**
- Modify: `misc/agent_matrix.html`

- [ ] **Step 1: Add Cursor account lane metadata**

Change the Cursor chip from a single static `cursor` lane to a probeable `cursor-main` lane. Preserve the visible label `Cursor Agent`.

- [ ] **Step 2: Render web account probe states**

Extend the quota chip renderer so a Cursor probe can show:

- cached usage summary and timestamp
- `login needed`
- `profile locked`
- `probe failed`

- [ ] **Step 3: Add account actions**

Add compact per-chip actions for:

- `probe`
- `open login`
- `clear session`

`open login` should call `POST /api/web-account-login`. `clear session` should call `DELETE /api/web-account-profile`.

## Task 4: Verification

**Files:**
- Tests and rendered dashboard only.

- [ ] **Step 1: Run focused unit tests**

Run:

```powershell
npx vitest run scripts/vite-plugins/__tests__/webAccountProbe.test.ts scripts/vite-plugins/__tests__/patVaultManager.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Verify dashboard rendering**

Open or refresh `http://localhost:3000/Aralia/misc/agent_matrix.html` in the in-app browser and verify:

- Cursor tile still fits in the quota strip.
- `probe`, `open login`, and `clear session` controls are visible and do not overlap.
- No automatic polling starts when the page loads.

- [ ] **Step 3: Verify on-demand behavior**

Click `probe` for `cursor-main`. If no isolated Cursor login exists yet, the expected result is `login needed`. The proof is a tile state update, not a screenshot stream.

