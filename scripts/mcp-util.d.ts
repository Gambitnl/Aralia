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
export {};
