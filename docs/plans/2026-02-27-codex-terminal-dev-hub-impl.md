# Codex Terminal Dev Hub - Implementation Plan

Date: 2026-02-27
Last Reviewed: 2026-03-12
Status: Preserved implementation plan / historical execution note

## Purpose

This file preserves the original implementation plan for the Codex Terminal dev-hub work.
It is no longer the live step-by-step plan to follow blindly.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- vite.config.ts now contains codexChatManager
- misc/dev_hub.html already contains the Codex Terminal card, cterm UI, and terminal lifecycle code
- the current server path starts codex app-server and bridges messages over WebSocket before streaming them out over SSE
- the current client path also includes PTY and xterm.js behavior plus a dedicated terminal-page flow, which is broader than this original plan described

## What Still Matters From This Plan

The preserved plan still captures the original implementation intent:
- expose Codex through the dev hub
- keep the UI self-contained in the dev-hub surface
- provide a persistent session model instead of one-shot command execution

## What No Longer Matches The Repo Exactly

The current repo has drifted from the original task list in several ways:
- the runtime bridge now uses codex app-server semantics rather than only a raw spawned process with newline writes
- the client implementation now includes PTY and xterm.js logic in addition to the codex-chat flow
- the original exact insertion points and verification commands should be treated as historical execution scaffolding, not as the current safest edit recipe

## Current Reading Rule

Use this file as a historical implementation note showing how the feature was originally meant to land.
For current implementation truth, prefer:
- ../../vite.config.ts
- ../../misc/dev_hub.html
