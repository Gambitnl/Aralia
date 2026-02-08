# Character Creator TODO Plan: Generate Portrait (Stitch/AI)

## Identified TODO (Anchor)

The Character Creator flow contains an explicit TODO to add portrait generation in the final step:

- `src/components/CharacterCreator/NameAndReview.tsx:108`:
  - `TODO: Add "Generate Portrait" button here using the Stitch/AI backend to create a custom avatar based on race/class/description.`

## Context Snapshot (What Exists Today)

- The final review step already renders a portrait placeholder and will display `characterPreview.portraitUrl` if present:
  - `src/components/CharacterCreator/NameAndReview.tsx:110`
- `PlayerCharacter` already has fields intended for portrait generation:
  - `src/types/character.ts:452` `visualDescription?: string`
  - `src/types/character.ts:455` `portraitUrl?: string` (comment says “Base64 data URL”)
- Character Creator state is persisted to local storage on every change:
  - `src/components/CharacterCreator/CharacterCreator.tsx` (`SafeStorage` with key `aralia_character_creation_state`)
- There is an existing portrait generation service, but it is not wired into the UI:
  - `src/services/PortraitService.ts` (requests via `http://localhost:8000/api/messages`, then polls for `#portrait_ready`)
- Stitch/MCP tooling exists in repo docs/scripts (primarily for pipelines and CLI usage):
  - `docs/MCP_INTEGRATION.md`

## Goal

Implement the TODO by adding an in-flow “Generate Portrait” action in the `NameAndReview` step that:

- Generates a character portrait derived from chosen race/class and a user-editable description.
- Displays progress, success (portrait preview), and failure states.
- Persists the selected portrait into the final `PlayerCharacter` so it carries into gameplay and saves.
- Avoids accidentally bloating localStorage/save payloads with oversized base64 strings.

## Non-Goals (For This First Pass)

- No mid-flow portrait generation (keep it in the final step).
- No server deployment story beyond local/dev; the plan includes an integration seam so this can evolve.
- No overhaul of the visuals system; this is additive to the existing “portraitUrl” display.

## Proposed UX / UI Changes

### 1. Final Step Layout (Name + Portrait Card)

In `src/components/CharacterCreator/NameAndReview.tsx`:

- Add a primary button: `Generate Portrait`.
- Add a secondary button (only when a portrait exists): `Regenerate`.
- Add a tertiary action (only when generating): `Cancel`.
- Add a small disclosure line under the button:
  - “Portrait generation requires local AI tooling (Stitch/Agent).”
  - If the backend is unavailable, show an inline actionable error (“Start local server” link to docs section).

### 2. Description Input (Prompt Control)

Add a text area near the portrait card:

- Label: `Portrait Description (optional)`
- Helper text: “Used for AI portrait generation. Avoid real personal data.”
- Default value: auto-assembled string derived from:
  - Race name, class name
  - Selected visuals (gender, hair style, clothing)
  - Optional background (if selected)

Keep this description in creator state so it round-trips during the final step.

### 3. Loading + Error States

- While generating: replace avatar placeholder with a “generating” overlay:
  - Spinner + text: “Summoning your likeness…”
  - Disable `Begin Adventure!` only if you decide portrait is required (recommendation: do not block).
- On error: show a compact error panel with:
  - Retry button
  - A truncated technical detail string for debugging

### 4. Accessibility

- Ensure `Generate Portrait` is keyboard reachable and has `aria-busy` on the portrait region while running.
- Ensure the portrait image has meaningful alt text:
  - e.g., `alt={`${name || 'Character'} portrait`}`

## State & Flow Integration

### 1. Extend Creator State

Add portrait-related fields to `CharacterCreationState` in:

- `src/components/CharacterCreator/state/characterCreatorState.ts`

Recommended shape (keeps UI logic straightforward and supports job-based backends):

```ts
type PortraitStatus = 'idle' | 'requesting' | 'polling' | 'ready' | 'error' | 'cancelled';

portrait: {
  status: PortraitStatus;
  url?: string;        // Keep small: prefer URL over base64 for persistence
  error?: string;
  requestId?: string;  // For backends that return a job id
};

visualDescription: string; // prompt text
```

Reducer changes:

- Add actions like:
  - `SET_VISUAL_DESCRIPTION`
  - `PORTRAIT_REQUEST_START`
  - `PORTRAIT_REQUEST_SUCCESS`
  - `PORTRAIT_REQUEST_ERROR`
  - `PORTRAIT_REQUEST_CANCEL`
  - `CLEAR_PORTRAIT` (used when race/class materially changes)

Backtracking rules:

- Do not clear portrait on `GO_BACK` from `NameAndReview` by default.
- Clear portrait if the “inputs to portrait” change:
  - Race change, class change, visuals change, description change (optional, but recommended to clear on “major” changes only).

### 2. Thread Portrait Into Preview + Final Assembly

Update `useCharacterAssembly` so `generatePreviewCharacter()` includes:

- `portraitUrl: state.portrait.url` (or whatever field name you adopt)
- `visualDescription: state.visualDescription`

File:

- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`

Rationale:

- `NameAndReview` already expects `portraitUrl` on the preview object.
- `appState` already propagates `pc.portraitUrl` into companion identity `avatarUrl`:
  - `src/state/appState.ts:271`

### 3. Persistence Considerations (Important)

The creator state is persisted to local storage on every change (`SafeStorage`).

Avoid persisting large base64 images:

- Prefer storing `portrait.url` as a small URL (HTTP URL, or a path served from `public/`, or a short token).
- If the generator only produces base64:
  - Store it in IndexedDB (or Cache Storage) and persist only a key in state.
  - Alternatively, store a downscaled WebP data URL with strict size limits.

Define explicit limits:

- Max description length (e.g., 500-1000 chars).
- Max portrait payload size if base64 is ever used (e.g., 250KB).

## Backend / Integration Design

### 1. Provide a Single “Portrait Backend” Abstraction

Create a small service boundary, so the UI doesn’t care if the portrait comes from:

1. Existing “Agent Uplink” (`PortraitService.ts`) via `localhost:8000`.
2. Stitch MCP (via a local node service that calls `mcp-cli`).
3. image-gen fallback (same approach as Stitch).

Proposed interface:

```ts
export type PortraitJobStatus = 'queued' | 'running' | 'ready' | 'error';

export interface PortraitBackend {
  start(req: PortraitRequest): Promise<{ requestId: string }>;
  poll(requestId: string): Promise<{ status: PortraitJobStatus; url?: string; error?: string }>;
  cancel?(requestId: string): Promise<void>;
}
```

Then implement:

- `AgentUplinkPortraitBackend` (wrapping `requestPortrait()` + `pollForPortrait()`)
- `StitchPortraitBackend` (future) calling a local `/api/portraits` endpoint

### 2. Fix JSON/Prompt Safety in Portrait Requests

`src/services/PortraitService.ts` currently builds JSON via string interpolation inside a message string.

In implementation, ensure:

- JSON is built with `JSON.stringify()` (so quotes/newlines are escaped).
- Inputs are validated/truncated (name/description).

### 3. Local Endpoint (Optional, But Recommended)

Add a dev-only local server endpoint (Node/Express or Vite dev server middleware) to:

- Start a Stitch job
- Store/serve the generated image under a stable URL (so state stores only the URL)

This aligns with the TODO’s “Stitch/AI backend” phrasing and avoids pushing MCP concerns into the browser.

## UI Polish Opportunities (Optional Enhancements)

- Add a small “style” selector:
  - `Portrait Style`: “Oil painting”, “Ink sketch”, “Pixel portrait”, etc.
- Add a “seed” control for reproducibility.
- Add a subtle animation when the portrait appears (fade + scale-in).
- Add “Use as token” toggle if there’s a token system; store as separate field later.

## Testing Plan

- Unit tests:
  - Reducer transitions for portrait state in `src/components/CharacterCreator/state/__tests__/characterCreatorReducer.test.ts`.
  - Service parsing behavior (already exists for polling): `src/services/__tests__/PortraitService.test.ts`.
- Integration tests (React):
  - Add a test that clicking “Generate Portrait” calls the backend abstraction and updates UI state.
- E2E (Playwright):
  - Update `tests/character-creator-flow.spec.ts` to tolerate the new button and validate it doesn’t block completion.
  - Add a mocked path (feature-flag portrait generation off by default in CI).
- Accessibility:
  - Ensure no new violations in the “Character Creator Accessibility” suite in `tests/character-creator-flow.spec.ts`.

## Rollout / Feature Flag

Add a simple feature flag:

- `VITE_ENABLE_PORTRAITS=true|false`

When disabled:

- Hide the buttons and description UI, but keep the portrait display if `portraitUrl` is already present (future save imports).

## Verification Plan

1. Manual smoke test:
   - Run the app, go through Character Creator, reach `Finalize Legend`, click `Generate Portrait`.
   - Confirm:
     - Loading state appears.
     - On success, the portrait appears.
     - “Begin Adventure!” works and the character in gameplay retains the portrait.
2. Automated checks:
   - Run unit tests relevant to reducer/service changes.
   - Run Playwright Character Creator flow tests.
3. Persistence checks:
   - Refresh mid-creation and ensure the portrait-related state doesn’t break load.
   - Validate localStorage size remains reasonable (no huge base64 payloads).

### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.

