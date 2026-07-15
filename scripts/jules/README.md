# Jules spell-icon pipeline

Generate custom, school-colored SVG spell icons with [Jules](https://jules.google)
and pull them back into `public/assets/icons/spells/`. Nothing here touches the
live game; the icons feed the design preview at `misc/design.html?step=icons`.

Design spec: `docs/superpowers/specs/2026-07-13-jules-spell-icons-design.md`.

## What each spell gets

9 SVGs: 3 distinct concepts x 3 versions (draft + two improvements), at
`public/assets/icons/spells/{spell-id}/c{1-3}-v{1-3}.svg`, `viewBox="0 0 100 100"`,
radial gradients + soft glow, colored by the spell's school.

## Operator flow

### 0. Make the key (one time)

Create a Jules API key in Jules Settings. Store it via the operator dashboard PAT
vault at `http://127.0.0.1:3040/pat_vault.html` -> "Jules API key" card. It writes
to Windows Credential Manager target `AgentMatrix/Jules/JULES_API_KEY`. The scripts
read it at run time and never print it. (Env `JULES_API_KEY` also works as a fallback.)

### 1. Build the manifest

```
npm run jules:manifest
```

Enumerates every spell under `public/data/spells/**`, splits into batches of ~10,
writes `.agent/scratch/jules-icons/manifest.json` (gitignored). Safe, read-only.
Override batch size: `node scripts/jules/manifest.mjs --batch-size 12`.

### 2. Sanity-check auth (optional, one read-only call)

```
node scripts/jules/run-batch.mjs --probe
```

Makes ONE `GET /sources` call and prints the source matched to `Gambitnl/Aralia`.
No sessions are created. If no source matches, connect the repo in Jules first.

### 3. Dry-run the batch creation

```
npm run jules:run                       # dry run, ALL batches, no network writes
node scripts/jules/run-batch.mjs --batches 0        # dry run, just batch 0
```

Prints the sessions it *would* create (title, spells, prompt size). No quota used.

### 4. Create sessions for real

```
node scripts/jules/run-batch.mjs --batches 0 --go            # first: ONE batch to verify
node scripts/jules/run-batch.mjs --batches 0-14 --limit 15 --go   # a full wave
```

`--go` is required to actually POST. `--batches` accepts `0,1,2` or `0-14`.
`--limit N` caps how many sessions are created in one run (Jules Pro allows 15
concurrent, 100/day). Each printed session name is what you feed to the fetch step.
Sessions are created with NO pull request (default automation mode); plans
auto-approve.

Verify-before-full-run: do batch 0, look at the results in the preview, check the
school colors / concept variety / that nothing is broken, tune the prompt template,
then run the rest.

### 5. Fetch the SVGs back

After a session finishes, pull its SVGs into the working tree without switching
branches:

```
node scripts/jules/fetch-icons.mjs --session sessions/<id>
node scripts/jules/fetch-icons.mjs --session sessions/<id> --dry-run   # list only
node scripts/jules/fetch-icons.mjs --branch <known-branch>             # skip API lookup
```

It reads the session's output branch from the API, `git fetch`es it, and extracts
only `public/assets/icons/spells/**` from `FETCH_HEAD` into the working tree. You
stay on your current branch the whole time. Review with `git status`.

> NOTE: the exact API field carrying the output branch name (when no PR is created)
> is not fully pinned down in the alpha docs. `fetch-icons.mjs` searches the session
> `outputs`, then activities, for a branch-like field, and falls back to printing
> the raw JSON so you can read the branch and pass `--branch <name>`. See the TODO
> comment in that file.

## Files

- `manifest.mjs` — enumerate spells -> batched manifest.
- `prompt-template.mjs` — `buildPrompt(batch)`; the per-batch Jules prompt + school color map.
- `run-batch.mjs` — create Jules sessions (guarded by `--go`; `--probe` for one read-only call).
- `fetch-icons.mjs` — pull SVGs from a session's branch into the working tree.

## Safety

- No script hits the live API without `--go` (create) or `--probe` (one read-only GET).
- The API key is read at run time and never printed, logged, or written to disk.
- Work stays on `master`; the fetch step never checks out or switches branches.
