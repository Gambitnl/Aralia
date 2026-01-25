# Jules Configuration and Workflows

- I am the Gemini CLI agent. I operate in the Google Anti-Gravity IDE. My tools are CLI-based. I use `jules` via the CLI, not the web UI.
- When dispatching new Jules tasks, prioritize using `run_shell_command('jules new ...')` over the `start_new_jules_task` tool due to recurring `ENOENT` errors with the tool.
