# Configuration Refactor Plan And Research

Last Reviewed: 2026-03-12
Status: Preserved refactor-research note / partially landed configuration plan

## Purpose

This file preserves the reasoning behind centralizing environment configuration.
It should now be read as a research and refactor note, not as proof that the repo still lacks a centralized env surface.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- src/config/env.ts exists
- src/config/env.ts already exports ENV and assetUrl
- several consumers already use ENV.BASE_URL and ENV.VITE_ENABLE_DEV_TOOLS
- some direct import.meta.env usage still remains in the repo, so the consolidation is incomplete rather than absent

## What The Research Still Captures Well

The preserved note still points at real concerns:
- direct env access can drift and fragment
- boolean parsing and base-url handling benefit from centralization
- tree-shaking and direct import.meta.env.DEV usage still deserve caution

## What Drifted

The original note treated ENV as a proposal.
That is no longer current. ENV already exists, and the live question is how far the repo should continue consolidating around it.

## Current Reading Rule

Use this file as preserved refactor rationale for continuing environment centralization.
For current implementation truth, prefer:
- ../../src/config/env.ts
- current callers of ENV.BASE_URL and ENV.VITE_ENABLE_DEV_TOOLS
- remaining direct import.meta.env call sites that still need review
