# Spell data authoring and browser delivery

Date: 2026-10-03
Status: Accepted

## Context

The browser loads spells from static URLs under `public/data`. Existing implementation documents describe this arrangement, but the investigation did not establish its original decision rationale. This record documents the choice made now, rather than attributing a historical decision.

Canonical prose and structured migration documents remain reference and audit inputs. They do not yet generate every runtime definition automatically. The individual JSON definitions are the authority for generating runtime delivery artifacts.

## Decision

Keep authored runtime definitions in `public/data/spells/level-N/id.json`. Keep existing browser URLs and preserve every authored field, including extension fields not interpreted by the schema.

Use `npm run spells:generate` to validate definitions and derive the manifest, full bundle, racial preview subset, and class lists. Use `npm run spells:check` to check these outputs without writing. Build preparation runs the check before other generators can conceal stale spell output.

Reject malformed definitions, schema failures, duplicate IDs, incorrect source paths, and new missing racial references. Retain the nine known unresolved racial references as explicit debt in the Spells gap registry. The manifest, bundle, and subset are derived before writes; failed writes trigger restoration of outputs already attempted. Class lists continue to use their existing generator.

## Consequences and alternatives

Static delivery fits the existing GitHub Pages deployment and runtime loader. It requires no authenticated data service and allows spells to load separately from application JavaScript. Public delivery means visitors can retrieve these game definitions. A directory named `public` does not itself make a GitHub repository public.

Moving authoring files elsewhere and copying generated output during deployment is possible, but would add migration work without changing what the browser can retrieve. An authenticated service would be needed if restricting access to definitions becomes a product requirement. Revisit the location when multiple delivery targets or automatic canonical-to-runtime generation justify that separation.

This decision does not remove canonical or structured migration material or settle their remaining fidelity work.
