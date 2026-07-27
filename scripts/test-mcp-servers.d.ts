#!/usr/bin/env tsx
/**
 * Test suite for MCP servers
 * Validates that all configured MCP servers are working correctly
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added 'as any' casts to
 * 'shell: true' options in exec calls to satisfy Node.js type
 * definitions which expect string or undefined.
 *
 * Usage:
 *   npm run test:mcp              # Test all servers
 *   npm run test:mcp gemini-image # Test specific server
 */
export {};
