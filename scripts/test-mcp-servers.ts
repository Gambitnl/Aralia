#!/usr/bin/env tsx
/**
 * Test suite for MCP servers
 * Validates that all configured MCP servers are working correctly
 *
 * Usage:
 *   npm run test:mcp              # Test all servers
 *   npm run test:mcp gemini-image # Test specific server
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface McpConfig {
  mcpServers: {
    [serverName: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

interface TestResult {
  server: string;
  passed: boolean;
  message: string;
  tools?: string[];
  error?: string;
}

const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');
const MCP_CONFIG = path.resolve(process.cwd(), '.mcp.json');

async function loadMcpConfig(): Promise<McpConfig> {
  const content = fs.readFileSync(MCP_CONFIG, 'utf-8');
  return JSON.parse(content);
}

async function testServerConnection(serverName: string): Promise<TestResult> {
  try {
    console.log(`\n🔍 Testing ${serverName}...`);

    // Try to list tools for this server
    const cmd = `"${MCP_CLI}" --config "${MCP_CONFIG}" ${serverName} -d`;
    console.log(`  Command: ${cmd}`);

    const { stdout, stderr } = await execAsync(cmd, {
      shell: true,
      timeout: 30000 // 30 seconds
    });

    if (stderr && !stderr.includes('debug')) {
      console.warn('  Warning:', stderr);
    }

    // Parse output to extract tool names
    const tools = parseToolsFromOutput(stdout);

    if (tools.length === 0) {
      return {
        server: serverName,
        passed: false,
        message: 'Server responded but no tools found',
        error: 'No tools available'
      };
    }

    console.log(`  ✓ Found ${tools.length} tool(s): ${tools.join(', ')}`);

    return {
      server: serverName,
      passed: true,
      message: `Server is working (${tools.length} tools available)`,
      tools
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Error: ${errorMsg}`);

    return {
      server: serverName,
      passed: false,
      message: 'Server connection failed',
      error: errorMsg
    };
  }
}

function parseToolsFromOutput(output: string): string[] {
  const tools: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Look for tool names (simplified parsing - adjust based on actual output format)
    const match = line.match(/(?:^|\s)([a-z_]+)\s*-/i);
    if (match) {
      tools.push(match[1]);
    }
  }

  return tools;
}

async function testToolInvocation(serverName: string, toolName: string, args: object): Promise<boolean> {
  try {
    console.log(`\n  🧪 Testing ${serverName}/${toolName}...`);

    const cmd = `"${MCP_CLI}" ${serverName}/${toolName} '${JSON.stringify(args)}'`;
    const { stdout, stderr } = await execAsync(cmd, {
      shell: true,
      timeout: 30000
    });

    if (stderr) console.warn('    stderr:', stderr);
    console.log(`    Response: ${stdout.substring(0, 100)}...`);

    return true;
  } catch (error) {
    console.error('    ✗ Tool invocation failed:', error);
    return false;
  }
}

async function runServerTests(serverName: string): Promise<TestResult> {
  const result = await testServerConnection(serverName);

  // If server is working, test a sample tool invocation
  if (result.passed && result.tools && result.tools.length > 0) {
    console.log(`\n  Testing sample tool invocation...`);

    // Define test cases for known servers
    const testCases: Record<string, { tool: string; args: object }> = {
      'image-gen': {
        tool: 'generate_image',
        args: { prompt: 'test prompt - do not actually generate' }
      }
      // Add more test cases for other servers as needed
    };

    const testCase = testCases[serverName];
    if (testCase) {
      // Note: We don't actually run the test to avoid side effects
      console.log(`  (Skipping actual invocation test to avoid side effects)`);
    }
  }

  return result;
}

function printSummary(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${icon} ${result.server}`);
    console.log(`   ${result.message}`);

    if (result.tools && result.tools.length > 0) {
      console.log(`   Tools: ${result.tools.join(', ')}`);
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed}/${total} servers passed`);
  console.log('='.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  const specificServer = args[0];

  console.log('🧪 MCP Server Test Suite');
  console.log('========================\n');

  // Load MCP configuration
  const config = await loadMcpConfig();
  const servers = Object.keys(config.mcpServers);

  console.log(`Found ${servers.length} configured server(s): ${servers.join(', ')}`);

  // Filter to specific server if requested
  const serversToTest = specificServer
    ? servers.filter(s => s === specificServer)
    : servers;

  if (serversToTest.length === 0) {
    console.error(`\nError: Server "${specificServer}" not found in configuration`);
    console.error(`Available servers: ${servers.join(', ')}`);
    process.exit(1);
  }

  // Run tests
  const results: TestResult[] = [];

  for (const server of serversToTest) {
    const result = await runServerTests(server);
    results.push(result);
  }

  // Print summary
  printSummary(results);

  // Exit with error code if any tests failed
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
