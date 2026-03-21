# MCP Integration Guide

Last Updated: 2026-03-11
Purpose: Describe the current MCP tooling surface in this repo without overcommitting to older installation or server assumptions.

## Verified Current MCP Surface

This pass confirmed these repo anchors:
- .mcp.json
- scripts/mcp-util.ts
- scripts/test-mcp-servers.ts
- scripts/workflows/gemini/image-gen/generate-race-images.ts
- package scripts in package.json for mcp, test:mcp, stitch:init, stitch:doctor, and generate:race-images

## Configured Servers

The current .mcp.json file defines these server entries:
- chrome-devtools
- github
- image-gen
- stitch

That file is the practical source of truth for which MCP servers are configured locally.

## Current Package Script Surface

The verified npm scripts for MCP work are:
- npm run mcp
- npm run test:mcp
- npm run stitch:init
- npm run stitch:doctor
- npm run generate:race-images

Use those scripts as the supported entry points before inventing custom wrappers.

## What scripts/mcp-util.ts Actually Does

scripts/mcp-util.ts is the local wrapper around the installed mcp-cli binary and .mcp.json.

It currently supports:
- list
- inspect
- schema
- call

That makes it the current developer-facing command bridge for repo-local MCP usage.

## Race Image Workflow

The generate-race-images workflow is real and still relevant.

The verified anchor is:
- scripts/workflows/gemini/image-gen/generate-race-images.ts

Use that workflow when the task is race-image generation rather than trying to treat this MCP guide as a general image-generation tutorial.

## What This Guide Should Not Overclaim

This rewrite intentionally avoids repeating older assumptions that were not re-verified in this pass, including:
- detailed installation promises beyond the current package and script surfaces
- server-health claims beyond the existence of the local config and scripts
- broader MCP architecture claims that are not needed for day-to-day repo use

## Practical Rule Going Forward

If you need MCP in this repo:
1. check .mcp.json first
2. use npm run mcp or npm run test:mcp second
3. use the specific workflow script if the task already has one, such as generate-race-images
4. only add new MCP guidance after verifying the local config and package scripts still support it
