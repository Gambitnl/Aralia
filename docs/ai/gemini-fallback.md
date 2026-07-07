# Gemini fallback (bring-your-own credential)

Aralia generates narrative text (location/wilderness descriptions, NPC replies,
action outcomes, oracle guidance, etc.) with a **local Ollama** model by
default. When Ollama isn't available — not installed, not running, or no model
pulled — the player can opt in to fall back to **Google Gemini** using a
credential **they supply themselves**.

Nothing is baked into the app. No shared API key ships with Aralia. The player's
credential lives only in their browser (localStorage) and is sent only to
Google's API from their own machine.

## Two ways for a player to authenticate

1. **API key** — the player pastes their own key from
   [Google AI Studio](https://aistudio.google.com/apikey). Always available;
   fully self-contained.
2. **Sign in with Google (OAuth)** — the player signs in with their own Google
   account and Aralia receives a short-lived access token. This path is only
   offered when the deployment has configured a public OAuth client ID (see
   below), and requires the player's Google Cloud project to have the Generative
   Language API enabled.

Players configure this in the **Ollama Dependency** pane (shown when Ollama is
detected as unavailable), under *"Prefer not to install Ollama? Use Google
Gemini instead."*

## How the redirect works

All narrative calls funnel through `src/services/ollamaTextService.ts`. When an
Ollama call fails (no model / unreachable), it checks
`isGeminiFallbackReady()` — true only when the player has both opted in **and**
supplied a usable credential — and, if ready, forwards the same prompt +
system instruction to Gemini via `src/services/gemini/core.ts`. Consumers are
unchanged; the redirect is transparent.

Credential resolution for every Gemini-backed service is centralized in
`src/services/aiClient.ts`, which picks (in priority order):

1. the player's runtime credential (API key or OAuth token), else
2. a build-time `GEMINI_API_KEY`, if a deployment chose to bake one in.

## Deployment configuration (optional)

| Env var | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Optional build-time key for the whole deployment. Most setups leave this unset. |
| `VITE_GOOGLE_CLIENT_ID` | Public OAuth 2.0 client ID that enables the "Sign in with Google" button. Not a secret. When unset, only the API-key path is shown. |
| `VITE_GOOGLE_OAUTH_SCOPE` | Override the requested OAuth scopes (defaults to `cloud-platform` + `userinfo.email`). |

### Setting up the OAuth client ID

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** of type *Web
   application*.
2. Add your app's origin to **Authorized JavaScript origins**.
3. Enable the **Generative Language API** on the project.
4. Set `VITE_GOOGLE_CLIENT_ID` to the client ID and rebuild.

## Relevant modules

- `src/services/ai/aiCredentials.ts` — runtime credential store + readiness gate.
- `src/services/ai/googleOAuth.ts` — Google Identity Services sign-in wrapper.
- `src/services/ai/oauthGeminiClient.ts` — REST adapter that calls Gemini with a
  bearer token (the SDK is API-key-only in the browser).
- `src/services/aiClient.ts` — central credential resolver / shared client.
- `src/services/ollamaTextService.ts` — Ollama→Gemini redirect on failure.
- `src/components/ui/GeminiFallbackSettings.tsx` — the opt-in UI.
