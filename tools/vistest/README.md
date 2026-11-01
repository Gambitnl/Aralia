# Visual capture proof

Use `tools/vistest/shoot.ts` for maintained visual scenarios. It refuses to
capture without `--fresh-module <repo-relative-path>`. That check compares the
source file on disk with Vite's `?raw` response and records their hashes. It
proves freshness, but an A/B comparison also needs to prove which *variant*
the browser executes.

For a before/after run, add `--expect-served-code "<unique code expression>"`.
Choose an expression that appears in the transformed JavaScript for **only**
that variant. Use a different expression for the other run. The runner checks
the transformed module after the raw-source freshness check and before it
starts the browser or creates a capture directory. A missing expression fails
the run with `SERVED_VARIANT_FAILURE` and writes no new PNG. If an older PNG
already exists at that path, do not treat it as proof for the failed run.

Do not use a source comment as the marker. Vite can strip comments during
transformation, even while serving the right code. A comment found in the
`?raw` response says nothing about the JavaScript the page executes. Check
the ordinary module URL without `?raw` when choosing each marker, and run a
negative control: the before marker must fail on the after build, and vice
versa. Keep the marker and the raw-source hash with the screenshot receipt.

The historical roof A/B rig at
`.agent/scratch/w8e-20260920/shootRoof.mjs` follows this rule. Its `before`
and `after` labels check different roof-height expressions before Chrome
launches. An ad hoc `shoot.mjs` should make the same pre-capture check against
its transformed module URL. If the implementation changes, update the marker
to a new variant-specific code expression; do not replace it with a comment or
skip the assertion.

## Ignored Scratch Builds (WF-G347)

Vite deliberately ignores `.agent/` to avoid excessive watcher handles. Editing
an already served scratch file can leave its ordinary transformed URL cached,
even when `?raw` matches the new disk contents. `shoot.ts` therefore requires
`--expect-served-code` for any `--fresh-module` path containing `.agent`.

Use a new file or directory name for every revised scratch build. Update the
viewer imports and any routed scratch dependencies to those new paths. Verify
the current expression at the ordinary URL that the page imports. The capture
probe does not add a cache-busting query: that would test a different module
cache entry and could approve a stale page. A query, a fresh raw hash, or a new
entry filename alone does not prove that every imported dependency is fresh.

Before batched saves or captures, check each build's transformed expression
and a negative control for the previous build. Keep the shared watcher exclusion
and do not restart another agent's development server to refresh scratch work.
This verifies served code, not rendered appearance or GPU behavior; those still
need their own visual proof.

Run the capture-tool safety tests in their Node-only lane:

```powershell
npx.cmd vitest run --config tools/vistest/vitest.config.ts
```

The real isolated Vite fixture edits the same ignored file twice, confirms that
raw source updates while its ordinary transform stays stale, rejects both stale
variants, and accepts each new filename. It closes its private server afterward.
