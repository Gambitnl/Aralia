# Codex Terminal - Dev Hub Integration

Date: 2026-02-27
Last Reviewed: 2026-03-12
Status: Preserved approved design note

## Purpose

This file preserves the original design intent for adding a Codex Terminal surface to the dev hub.
It should now be read as historical design context, not as the literal description of the current implementation.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- misc/dev_hub.html contains a CODEX TERMINAL card plus cterm CSS, window chrome, and terminal lifecycle code
- vite.config.ts contains codexChatManager and the /api/codex-chat start, stream, send, and kill endpoints
- the current start endpoint launches codex app-server and bridges over WebSocket before exposing the SSE stream
- misc/dev_hub.html now also contains a PTY and xterm.js lane plus a dedicated terminal-page flow, so the current implementation has evolved beyond the narrow raw-stdin design captured here

## What To Preserve From The Original Design

The original design intent is still useful:
- expose Codex from the dev hub as a persistent tool surface
- keep a movable terminal-like UI rather than a one-shot button
- preserve session continuity while the user interacts with the rest of the hub

## What Drifted

The repo no longer matches the original design exactly.
Most importantly:
- the current codex-chat server flow uses codex app-server plus WebSocket bridging, not a plain persistent stdin chat proc
- the current dev hub also includes a PTY and xterm.js path, so the terminal surface is broader than this design assumed
- the implementation now contains launch-flag toggles and a dedicated terminal-page path that were not part of this original brief

## Current Reading Rule

Use this file as the preserved approved design note for why the Codex Terminal surface exists.
For current implementation truth, prefer:
- ../../misc/dev_hub.html
- ../../vite.config.ts
