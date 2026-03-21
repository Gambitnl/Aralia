# Guide: Briefing AI Collaborators On Aralia

**Last Updated**: 2026-03-11  
**Purpose**: Help humans brief AI collaborators effectively for the current Aralia repository, using the repo's actual architecture and workflow constraints instead of the older static-app assumptions.

## What Makes A Good Request

The best requests explain intent, not just surface edits.

Good requests usually include:
- the goal
- the affected surface or file area
- any constraints about preserving behavior, unfinished systems, or visual style
- how much freedom the AI should have to restructure, reuse, or propose alternatives

Strong example:
- "Refine the battle-map tooltip flow so it is easier to scan in combat, but preserve existing combat behavior and reuse the current styling patterns."

Weak example:
- "Make this better."

## Aralia-Specific Ground Rules

Aralia is not a blank project. It is a large, evolving web game with unfinished systems and roadmap-heavy context.

Before asking an AI to implement something new, expect it to check:
- existing related systems in `src/`
- shared UI patterns and local conventions
- docs or roadmap/task surfaces that already describe the feature area

Important repo bias:
- preserve unfinished intent and future feature space
- do not assume cleanup is automatically progress
- prefer extending existing systems over inventing parallel ones

These expectations come from the repo-root [AGENTS.md](../AGENTS.md).

## Current Technical Reality

Use the current repo shape when briefing an AI.

### Verified stack

- React 19
- TypeScript
- Vite
- Vitest
- ESLint
- Tailwind CSS and PostCSS
- Gemini integrations via `@google/genai`

These are all verified in `package.json`.

### Important consequences

- This is not an import-map-only static app.
- The repo does have local dependencies and a build/test toolchain.
- New work should assume a normal TypeScript/React repo structure rather than a single-file HTML application.
- Verification can use repo-local commands such as `npm run test`, `npm run typecheck`, `npm run lint`, or narrower targeted checks when appropriate.

## What Context To Provide

The AI working inside this repo can inspect files directly, so you do not need to paste every file by default.

Still, it helps to provide:
- relevant file paths
- screenshots or UI context when the issue is visual
- exact error messages
- expected behavior
- examples of what should stay unchanged

If you are briefing a stateless external model that cannot inspect the repo directly, then include the relevant file contents and surrounding context explicitly.

## What To Ask For Explicitly

If you care about any of these, say so up front:

- preserve existing behavior
- preserve unfinished systems or scaffolds
- stay close to current UI language
- prefer local fixes over broad refactors
- propose options before implementation
- update nearby docs if behavior or workflow changes

Examples:
- "Keep the fix local unless the broader refactor is unavoidable."
- "Search for an existing implementation before building a new system."
- "Preserve current gameplay behavior; this is a UX cleanup, not a mechanics change."

## Visual And UX Requests

For UI work, rendered output is the source of truth.

When briefing an AI about a visual problem:
- include the route, screen, or component name
- say what looks wrong
- say what good looks like
- include screenshots if possible

Useful phrasing:
- "Verify this visually, not just structurally."
- "Preserve the existing art direction and component vocabulary."

## Documentation And Workflow Requests

When the task touches docs, be explicit about the document class:
- canonical root doc
- workflow guide
- work-item/task doc
- registry
- archive/history

This matters because Aralia is actively normalizing its documentation system, and not every root doc should remain a root doc forever.

## Good Prompt Patterns

### Goal + constraints

"Update the spell-system docs so the current workflow is easier to follow, but preserve historical context and do not delete planning material unless it is clearly duplicated elsewhere."

### Goal + reuse instruction

"Add this UI behavior by extending the existing panel and button patterns. Search the repo first for a close implementation before creating a new component."

### Goal + verification target

"Fix this regression and verify it with the relevant local test or runtime check. If you cannot verify it fully, say exactly what remains unverified."

## Related Docs

- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for current dev workflow orientation
- [ARCHITECTURE.md](./ARCHITECTURE.md) for subsystem mapping
- [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md) for doc-system structure and scope
