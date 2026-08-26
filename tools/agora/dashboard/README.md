# Agora dashboard

## Pet pictures (local only)

The `tools/agora/dashboard/pets/` folder is gitignored on purpose (see
`.gitignore:366`). It is not tracked in git and does not arrive with a fresh
clone.

**What is in it.** 51 pet folders plus one top-level manifest
(`pets.json`), 101 files total: 51 `pet.json` records, 48 `.webp` sprite
sheets, and 2 `.png` sprite sheets (`pets.json` counts as one of the 51 JSON
files). Each pet folder holds one `pet.json` and one spritesheet image.

**Where it comes from.** `pets.json` records its own provenance:
`"source": "https://petdex.dev/api/manifest"`, generated 2026-07-18. Each
pet entry also carries a `petJsonUrl` and `spritesheetUrl` pointing at
`https://assets.petdex.dev/pets/<slug>-<id>/...`. No generator script exists
in this repo — nothing under `tools/`, `scripts/`, or `docs/` fetches or
rebuilds this folder. The files were placed here manually (a one-time
download/export from the Petdex manifest, reviewed down to 50 humanoid
pets), not produced by any tracked automation.

**Restore step on a fresh clone.** There is no scripted restore yet. Until
one exists, pull the files back by hand:
1. Fetch the manifest at `https://petdex.dev/api/manifest`.
2. For each of the 51 pets already recorded in a known-good copy of
   `pets.json`, download its `petJsonUrl` to
   `tools/agora/dashboard/pets/<slug>/pet.json` and its `spritesheetUrl` to
   `tools/agora/dashboard/pets/<slug>/spritesheet.png` (or `.webp`, matching
   the original extension).
3. Copy `pets.json` itself into `tools/agora/dashboard/pets/pets.json`.

If you have access to a checkout that still has this folder, the fastest
restore is simply copying `tools/agora/dashboard/pets/` across rather than
re-fetching from Petdex.

**What the dashboard shows when it is absent.** The server
(`tools/agora/store.mjs`, `loadPetCatalog()`) reads
`./dashboard/pets/pets.json` at startup; a missing or malformed file is
caught and treated as an empty catalog, so Agora itself still starts. In the
dashboard UI, the Pets tab then shows 0 pets (`No pets found` if the `/pets`
request itself fails), and agent cards fall back to "missing registration
pet" instead of a picture. Nothing else in the dashboard breaks.
