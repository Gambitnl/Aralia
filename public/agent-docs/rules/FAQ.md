# Frequently asked questions (FAQs)

- **Q: How do I update Gemini CLI to the latest version?**
  - A: If installed globally via npm, update Gemini CLI using the command `npm install -g @google/gemini-cli@latest`. If run from source, pull the latest changes from the repository and rebuild using `npm run build`.

- **Q: Where are Gemini CLI configuration files stored?**
  - A: The CLI configuration is stored within two `settings.json` files: one in your home directory and one in your project's root directory. In both locations, `settings.json` is found in the `.gemini/` folder. Refer to [CLI Configuration](./cli/configuration.md) for more details.

- **Q: Why don't I see cached token counts in my stats output?**
  - A: Cached token information is only displayed when cached tokens are being used. This feature is available for API key users (Gemini API key or Vertex AI) but not for OAuth users (Google Personal/Enterprise accounts) at this time, as the Code Assist API does not support cached content creation. You can still view your total token usage with the `/stats` command.
