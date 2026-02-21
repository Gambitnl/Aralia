# MCP Integration Guide

This project integrates the Model Context Protocol (MCP) with the lightweight `mcp-cli` tool for efficient tool discovery and execution.

## Overview

The mcp-cli integration provides:
- Dynamic tool discovery (99% reduction in token usage vs. static loading)
- Command-line access to MCP servers
- Automated asset generation pipelines
- Testing utilities for MCP servers

## Installation

### Prerequisites

The `mcp-cli` tool requires **Bun** runtime to be installed.

#### Installing Bun (Windows)

```powershell
# Run in PowerShell
irm bun.sh/install.ps1 | iex
```

After installation, restart your terminal or add Bun to your PATH:
```bash
export PATH="/c/Users/$USER/.bun/bin:$PATH"  # For Git Bash
```

### mcp-cli Package

The `mcp-cli` package is already installed as a dev dependency from GitHub:

```json
"mcp-cli": "github:philschmid/mcp-cli"
```

## Configured MCP Servers

Your project has four MCP servers configured in `.mcp.json`:

### 1. **stitch**
Stitch MCP (UI + image generation)
```bash
npm run mcp inspect stitch
```

### 2. **chrome-devtools**
Browser automation and DevTools access
```bash
npm run mcp inspect chrome-devtools
```

### 3. **github**
GitHub API integration (requires token configuration)
```bash
npm run mcp inspect github
```

### 4. **image-gen**
Custom server for generating images via Google Gemini or Whisk (fallback)
```bash
npm run mcp inspect image-gen
```

## Available npm Scripts

### General MCP Operations

#### List all servers and tools
```bash
npm run mcp list
```

#### Inspect a specific server
```bash
npm run mcp inspect stitch
```

#### Inspect a fallback server
```bash
npm run mcp inspect image-gen
```

#### Get tool schema
```bash
npm run mcp schema image-gen/generate_image
```

#### Call a tool directly
```bash
npm run mcp call image-gen/generate_image '{"prompt":"fantasy dragon"}'
```

### Stitch Setup Helpers

```bash
# Guided Stitch setup (gcloud auth + project + API enablement)
npm run stitch:init

# Verify Stitch health checks
npm run stitch:doctor
```

### Asset Generation

#### Generate race images
```bash
# Generate all missing race images
npm run generate:race-images

# Generate image for a specific race
npm run generate:race-images autognome

# Force regenerate all images
npm run generate:race-images -- --force
```

**Provider selection (optional):**
```bash
# Force fallback to image-gen
IMAGE_GEN_PRIMARY=image-gen npm run generate:race-images

# Override Stitch tool name or extra args
STITCH_IMAGE_TOOL=generate_image STITCH_IMAGE_ARGS='{"style":"fantasy"}' npm run generate:race-images
```

**How it works:**
1. Reads race data from `public/data/glossary/entries/races/*.json`
2. Creates prompts based on race lore and characteristics
3. Uses Stitch to generate fantasy art (fallbacks to image-gen if Stitch is unavailable)
4. Downloads images to `public/assets/images/races/`

### Testing

#### Test all MCP servers
```bash
npm run test:mcp
```

#### Test a specific server
```bash
npm run test:mcp gemini-image
```

This validates that:
- Servers are reachable
- Tools are properly configured
- Tool schemas are valid

## Usage Examples

### Example 1: Generate a Race Image

```bash
# Stitch (primary)
npm run mcp call stitch/<tool> '{"prompt":"A noble elf warrior with silver hair, wielding a mystical bow, fantasy RPG character art"}'

# image-gen (fallback)
npm run mcp call image-gen/generate_image '{"prompt":"A noble elf warrior, fantasy RPG art"}'
npm run mcp call image-gen/download_image '{"outputPath":"C:\\Users\\gambi\\Documents\\Git\\AraliaV4\\Aralia\\public\\assets\\images\\races\\elf.png"}'
```

### Example 2: Batch Generate Race Images

```bash
# Generate all missing race images (safe - skips existing)
npm run generate:race-images

# Generate for a specific race
npm run generate:race-images dragonborn
```

### Example 3: Test MCP Setup

```bash
# Verify all servers are working
npm run test:mcp

# Test Stitch only
npm run test:mcp stitch

# Test just the image-gen server
npm run test:mcp image-gen
```

## Scripts Reference

### `scripts/mcp-util.ts`
General-purpose MCP CLI wrapper for listing servers, inspecting tools, and calling them.

**Commands:**
- `list` - List all configured servers
- `inspect <server>` - Show server details and tools
- `schema <server/tool>` - Display tool JSON schema
- `call <server/tool> <json>` - Execute a tool

### `scripts/workflows/gemini/image-gen/generate-race-images.ts`
Automated race image generation using Gemini.

**Features:**
- Reads race data from JSON files
- Creates contextual prompts from race lore
- Handles image generation and download
- Skips existing images (unless `--force`)
- Rate limiting between generations

### `scripts/test-mcp-servers.ts`
Test suite for validating MCP server configuration and connectivity.

**Features:**
- Tests all configured servers
- Validates tool availability
- Reports detailed results
- Exit code 0 on success, 1 on failure (CI-friendly)

## Development Workflow

### Adding a New MCP Server

1. Add server configuration to `.mcp.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx.cmd",
      "args": ["my-mcp-package"],
      "env": {
        "API_KEY": "<your-key>"
      }
    }
  }
}
```

2. Test the server:
```bash
npm run mcp inspect my-server
npm run test:mcp my-server
```

3. Use in scripts:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const result = await execAsync(
  `npm run mcp call my-server/my-tool '{"arg": "value"}'`
);
```

### Creating Custom Automation Scripts

Follow the pattern in `scripts/workflows/gemini/image-gen/generate-race-images.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);
const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');

async function callMcpTool(server: string, tool: string, args: object) {
  const cmd = `"${MCP_CLI}" ${server}/${tool} '${JSON.stringify(args)}'`;
  const { stdout } = await execAsync(cmd, { shell: true });
  return stdout;
}
```

## Troubleshooting

### "Command not found: mcp-cli"
The CLI is installed locally. Use npm scripts or the full path:
```bash
node_modules/.bin/mcp-cli
```

### "Server connection failed"
1. Check `.mcp.json` configuration
2. Verify required environment variables
3. Test with: `npm run test:mcp <server-name>`

### "Tool invocation timeout"
Some operations (like image generation) take time. Increase timeout in scripts:
```typescript
await execAsync(cmd, {
  shell: true,
  timeout: 180000 // 3 minutes
});
```

### GitHub Token Not Configured
Edit `.mcp.json` and replace `<YOUR_TOKEN_HERE>` with your GitHub personal access token:
```json
{
  "github": {
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourTokenHere"
    }
  }
}
```

## Benefits Over Traditional MCP Integration

### Token Efficiency
- **Before**: Loading 6 servers with 60 tools = ~47,000 tokens
- **After**: Dynamic discovery = ~400 tokens (99% reduction)

### Flexibility
- Call MCP tools from any script or CI pipeline
- No need to load all schemas upfront
- Shell-friendly for chaining with other tools

### Development Speed
- Quick testing of MCP servers
- Easy debugging of tool invocations
- Automated asset generation pipelines

## Resources

- [mcp-cli GitHub](https://github.com/philschmid/mcp-cli)
- [Blog Post](https://www.philschmid.de/mcp-cli)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Next Steps

- Configure GitHub token for GitHub MCP server
- Add more automated generation scripts
- Integrate MCP tools into CI/CD pipeline
- Create custom MCP servers for project-specific needs
