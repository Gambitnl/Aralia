# Jules Configuration and Workflows

- I am the Gemini CLI agent. I operate in the Google Anti-Gravity IDE. My tools are CLI-based. I use `jules` via the CLI, not the web UI.
- When dispatching new Jules tasks, prepare or update the Aralia-facing task packet under `docs/tasks/spells/` first, then prioritize using `run_shell_command('jules new ...')` over the `start_new_jules_task` tool due to recurring `ENOENT` errors with the tool.
- Keep Symphony runtime state, generated manifests, draft ids, click receipts, and similar orchestration artifacts external or ignored unless the packet needs a tiny durable excerpt for future Aralia contributors.
- Jules MCPs are opt-in aids, not default requirements. Use Linear when issue context or concise status traceability would help; use Context7 when current library docs/examples would materially reduce implementation risk; use Render only for preview/deploy/build failures; use Stitch only for UI/design exploration packages. Avoid Neon, Supabase, Tinybird, and v0 unless the handoff explicitly authorizes database, analytics, or generated UI work.
- If a handoff allows an MCP, report what it was used for. If the MCP is irrelevant or unavailable, proceed from the task packet and repository unless the packet explicitly says that MCP access is required.
