# Underdark System Documentation (Ralph)

## Overview
This folder implements the "Survival Horror" layer of the subterranean world. It manages resource consumption (Torches/Oil), environmental lighting, and the psychological impact of darkness (Sanity/Madness).

## Files
- **UnderdarkMechanics.ts**: The Core Processor. Ticks down Light Source durations, recalculates ambient light levels based on active sources, and processes Sanity Decay/Recovery based on Biome "Scary-ness".
- **FaerzressSystem.ts**: (Not yet commented) Logic for the magical radiation of the Underdark.

## Issues & Opportunities
- **Sanity Clamping**: Sanity recovery is capped at `sanity.max`, but there is no "Sanity Buffer" or "Resilience" stat to slow down decay for experienced delvers beyond the Biome multiplier.
- **Light Source Flickering**: The "Low fuel" warning is a hardcoded 10-minute threshold. High-tier light sources (e.g. lanterns) might benefit from a percentage-based warning instead.
