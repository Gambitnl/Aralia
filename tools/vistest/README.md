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
