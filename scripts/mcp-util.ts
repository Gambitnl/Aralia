#!/usr/bin/env tsx
/**
 * MCP Utility Wrapper
 * Provides convenient access to MCP CLI operations
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'as any' casts to 
 * 'shell: true' options in exec calls to satisfy Node.js type 
 * definitions which expect string or undefined.
 *
 * Usage:
 *   npm run mcp list                           # List all servers and tools
 *   npm run mcp inspect gemini-image           # Inspect a server
 *   npm run mcp schema gemini-image/generate   # Get tool schema
 *   npm run mcp call <server/tool> <json>      # Call a tool
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');
const MCP_CONFIG = path.resolve(process.cwd(), '.mcp.json');

interface McpConfig {
  mcpServers: {
    [serverName: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

async function loadMcpConfig(): Promise<McpConfig> {
  const content = fs.readFileSync(MCP_CONFIG, 'utf-8');
  return JSON.parse(content);
}

async function listServers(): Promise<void> {
  console.log('📋 Available MCP Servers');
  console.log('========================\n');

  const config = await loadMcpConfig();
  const servers = Object.entries(config.mcpServers);

  for (const [name, serverConfig] of servers) {
    console.log(`🔧 ${name}`);
    console.log(`   Command: ${serverConfig.command} ${serverConfig.args.join(' ')}`);

    if (serverConfig.env) {
      const envKeys = Object.keys(serverConfig.env);
      console.log(`   Environment: ${envKeys.join(', ')}`);
    }

    // Try to get tools
    try {
      const { stdout } = await execAsync(`"${MCP_CLI}" --config "${MCP_CONFIG}" ${name} -d`, {
        shell: true as any,
        timeout: 10000
      });

      const toolCount = (stdout.match(/\n\s+\w+/g) || []).length;
      console.log(`   Tools: ${toolCount} available`);
    } catch {
      console.log(`   Tools: (unable to fetch)`);
    }

    console.log();
  }
}

async function inspectServer(serverName: string): Promise<void> {
  console.log(`🔍 Inspecting ${serverName}`);
  console.log('='.repeat(40) + '\n');

  try {
    const { stdout } = await execAsync(`"${MCP_CLI}" --config "${MCP_CONFIG}" ${serverName} -d`, {
      shell: true as any,
      timeout: 30000
    });

    console.log(stdout);
  } catch (error) {
    console.error('Error inspecting server:', error);
    process.exit(1);
  }
}

async function getToolSchema(toolPath: string): Promise<void> {
  console.log(`📄 Tool Schema: ${toolPath}`);
  console.log('='.repeat(40) + '\n');

  try {
    const { stdout } = await execAsync(`"${MCP_CLI}" --config "${MCP_CONFIG}" ${toolPath}`, {
      shell: true as any,
      timeout: 30000
    });

    console.log(stdout);
  } catch (error) {
    console.error('Error getting tool schema:', error);
    process.exit(1);
  }
}

async function callTool(toolPath: string, argsJson: string): Promise<void> {
  console.log(`🚀 Calling ${toolPath}`);
  console.log(`📥 Arguments: ${argsJson}`);
  console.log('='.repeat(40) + '\n');

  try {
    const { stdout, stderr } = await execAsync(
      `"${MCP_CLI}" --config "${MCP_CONFIG}" ${toolPath} '${argsJson}'`,
      {
        shell: true as any,
        timeout: 180000 // 3 minutes for long operations
      }
    );

    if (stderr) {
      console.error('stderr:', stderr);
    }

    console.log('📤 Response:');
    console.log(stdout);
  } catch (error) {
    console.error('Error calling tool:', error);
    process.exit(1);
  }
}

async function showHelp(): void {
  console.log(`
MCP Utility Wrapper
===================

Usage:
  npm run mcp list                           # List all servers and tools
  npm run mcp inspect <server>               # Inspect a server's tools
  npm run mcp schema <server/tool>           # Get tool schema
  npm run mcp call <server/tool> <json>      # Call a tool

Examples:
  npm run mcp list
  npm run mcp inspect image-gen
  npm run mcp schema image-gen/generate_image
  npm run mcp call image-gen/generate_image '{"prompt":"test"}'

Available Commands:
  list      - List all configured MCP servers
  inspect   - Show detailed information about a server
  schema    - Display the JSON schema for a tool
  call      - Execute a tool with JSON arguments
  help      - Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    await showHelp();
    return;
  }

  switch (command) {
    case 'list':
      await listServers();
      break;

    case 'inspect':
      if (!args[1]) {
        console.error('Error: Server name required');
        console.error('Usage: npm run mcp inspect <server>');
        process.exit(1);
      }
      await inspectServer(args[1]);
      break;

    case 'schema':
      if (!args[1]) {
        console.error('Error: Tool path required');
        console.error('Usage: npm run mcp schema <server/tool>');
        process.exit(1);
      }
      await getToolSchema(args[1]);
      break;

    case 'call':
      if (!args[1] || !args[2]) {
        console.error('Error: Tool path and arguments required');
        console.error('Usage: npm run mcp call <server/tool> <json>');
        process.exit(1);
      }
      await callTool(args[1], args[2]);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "npm run mcp help" for usage information');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
