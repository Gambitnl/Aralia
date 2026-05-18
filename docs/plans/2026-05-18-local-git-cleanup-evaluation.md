# Local Git Cleanup Evaluation - 2026-05-18

This note records the local branches, stash, and uncommitted docs output reviewed during the cleanup pass.

## Merged Branches

The following local branches had no remaining diff against `master` and were safe to close after `master` was pushed:

- `codex/dependabot-fast-uri`
- `codex/spell-mechanics-sync-20260514`
- `codex/symphony-middleman-dashboard`

## Kept

- VitePress/TypeDoc documentation scaffold:
  - `package.json` docs scripts
  - `typedoc.json`
  - `docs-site/index.md`
  - `docs-site/.vitepress/config.ts`

The scaffold is small source configuration. The generated API markdown output was not kept because it is reproducible and very large.

## Ignored Generated Output

The following generated documentation folders were removed from the working tree and added to `.gitignore`:

- `docs/api/`
- `docs-site/api/`
- `docs-site/api-test/`
- `docs-site/api-types-test/`
- `docs-site-dist/`

## Deferred Stash

`stash@{0}` from `Sat May 16 23:39:03 2026` was evaluated but not applied.

Summary:

- touched 10 files
- added premade-party dev startup changes
- added inventory weapon icon path handling
- attempted to split `src/components/Glossary/IconRegistry.tsx`

Reason deferred:

The stash was not safe to merge as-is. It reduced `IconRegistry.tsx` to a wrapper importing `./icons/glossaryIconLibrary` and `./icons/glossaryIconTypes`, but those files were not present in the stash or on current `master`. Applying it directly would break the app. The premade-party and weapon-icon ideas may still be worth revisiting as a separate, intentionally scoped task.
