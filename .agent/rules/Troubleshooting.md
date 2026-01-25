# Troubleshooting Guide

This guide provides solutions to common issues and debugging tips.

## Authentication

- **Error: `Failed to login. Message: Request contains an invalid argument`**
  - Users with Google Workspace accounts, or users with Google Cloud accounts associated with their Gmail accounts may not be able to activate the free tier of the Google Code Assist plan.
  - For Google Cloud accounts, you can work around this by setting `GOOGLE_CLOUD_PROJECT` to your project ID.
  - You can also grab an API key from [AI Studio](http://aistudio.google.com/app/apikey), which also includes a separate free tier.

## Authentication

- **Error: `Failed to login. Message: Request contains an invalid argument`**
  - Users with Google Workspace accounts, or users with Google Cloud accounts associated with their Gmail accounts may not be able to activate the free tier of the Google Code Assist plan.
  - For Google Cloud accounts, you can work around this by setting `GOOGLE_CLOUD_PROJECT` to your project ID.
  - You can also grab an API key from [AI Studio](http://aistudio.google.com/app/apikey), which also includes a separate free tier.

## Debugging Tips

- **CLI debugging:**
  - Use the `--verbose` flag (if available) with CLI commands for more detailed output.
  - Check the CLI logs, often found in a user-specific configuration or cache directory.

- **Core debugging:**
  - Check the server console output for error messages or stack traces.
  - Increase log verbosity if configurable.
  - Use Node.js debugging tools (e.g., `node --inspect`) if you need to step through server-side code.

- **Tool issues:**
  - If a specific tool is failing, try to isolate the issue by running the simplest possible version of the command or operation the tool performs.
  - For `run_shell_command`, check that the command works directly in your shell first.
  - For file system tools, double-check paths and permissions.

- **Pre-flight checks:**
  - Always run `npm run preflight` before committing code. This can catch many common issues related to formatting, linting, and type errors.

If you encounter an issue not covered here, consider searching the project's issue tracker on GitHub or reporting a new issue with detailed information.
