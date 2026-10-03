/**
 * @file iconSetGearCombat.tsx
 * Weapon, armor, shield, tool and physical-combat icons.
 *
 * Split out of IconRegistry.tsx (MOD-3.1) so the ~200-entry icon table is no
 * longer one 1200-line literal inside the component body. The JSX for each
 * icon is unchanged; it now arrives through a factory that takes the caller's
 * className so every SVG keeps sizing itself from GlossaryIcon's prop.
 *
 * Called by: components/Glossary/IconRegistry.tsx (spread-merged into `icons`).
 * Depends on: React for the SVG elements.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: components/Glossary/IconRegistry.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';

export const iconSetGearCombat = (className: string): Record<string, React.ReactNode> => ({
    shield: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
    ),
    // Weapon concept: Symmetrical fantasy longsword pointing up-right.
    // Styled with a hollow-outline leaf blade, center fuller ridge,
    // perpendicular crossguard, grip, and circular pommel.
    sword: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M6 16 L16 6 L21 3 L18 8 L8 18 Z" />
            <line x1="7" y1="17" x2="17.5" y2="6.5" />
            <line x1="4" y1="14" x2="10" y2="20" />
            <line x1="7" y1="17" x2="4" y2="20" />
            <circle cx="3" cy="21" r="1" />
        </svg>
    ),
    // Pictogrammers/MDI Weapon Icons
    // Reworked to unified 24x24 line-art strokes for better small-size clarity
    // Weapon concept: Two crossed symmetrical fantasy longswords.
    // Provides a balanced emblem for dueling or martial prowess,
    // mirroring their guard, grip, and pommel shapes.
    sword_cross: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M8 14 L17 5 L20 4 L19 7 L10 16 Z" />
            <line x1="6" y1="12" x2="12" y2="18" />
            <line x1="9" y1="15" x2="5" y2="19" />
            <circle cx="4" cy="20" r="1" />

            <path d="M16 14 L7 5 L4 4 L5 7 L14 16 Z" />
            <line x1="18" y1="12" x2="12" y2="18" />
            <line x1="15" y1="15" x2="19" y2="19" />
            <circle cx="20" cy="20" r="1" />
        </svg>
    ),
    // Weapon concept: Symmetrical fantasy bearded handaxe / hatchet.
    // Features a shaft with leather pommel wrap and a curved
    // bearded blade socketed cleanly onto the handle.
    axe: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 19 L16 8" />
            <path d="M12.5 11.5 L14.5 9.5 L19.5 7.5 C21 10.5 21 12 18 14.5 C15.5 13.5 14 13 12.5 11.5 Z" />
            <path d="M4 20 C3.5 20.5 4.5 21.5 5 21" />
        </svg>
    ),
    // Weapon concept: Symmetrical double-bitted fantasy battle axe.
    // Features hollow-ground inner arcs, central reinforcing socket diamond,
    // and sharp spikes on both ends of the vertical shaft.
    axe_battle: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <g transform="rotate(45 12 12)">
                <line x1="12" y1="3" x2="12" y2="21" />
                <path d="M12 7 L18 4 C20.5 8 20.5 14 18 18 L12 15 C14.5 13 14.5 9 12 7 Z" />
                <path d="M12 7 L6 4 C3.5 8 3.5 14 6 18 L12 15 C9.5 13 9.5 9 12 7 Z" />
                <path d="M12 9.5 L13.5 11 L12 12.5 L10.5 11 Z" />
                <path d="M12 3 L12 1.5" />
                <path d="M11.5 21 L12 23 L12.5 21 Z" />
            </g>
        </svg>
    ),
    // Weapon concept: Heavy spiked morningstar / combat mace.
    // Consists of a long shaft with grip details and a central spherical
    // core studded with sharp, triangular radiating spikes.
    mace: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="4" y1="20" x2="15" y2="9" />
            <circle cx="17" cy="7" r="3" />
            <path d="M14.5 8 L11.5 6.5 L15.5 6" />
            <path d="M15 5.5 L14 2 L17 4.5" />
            <path d="M17.5 4 L19.5 1 L19 4.5" />
            <path d="M19 6 L22 4.5 L19.5 7.5" />
            <path d="M19.8 8 L23 9.5 L19 10" />
            <path d="M18 9.5 L19.5 13 L16.5 10" />
            <circle cx="3" cy="21" r="1" />
        </svg>
    ),
    // MDI Weapons
    // Weapon concept: Fully drawn elven recurve bow with nocked arrow.
    // Showcases double-curved flexed limbs, a V-shaped drawn string,
    // and an arrow with fletching and a solid arrowhead.
    bow_arrow: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <g transform="rotate(45 12 12)">
                <path d="M12 7 Q8 5 6 9 T4 11" />
                <path d="M12 7 Q16 5 18 9 T20 11" />
                <path d="M11 6.5 L13 6.5 L12 8.5 Z" fill="currentColor" />
                <path d="M4 11 L12 18 L20 11" />
                <line x1="12" y1="18" x2="12" y2="3" />
                <path d="M10 5 L12 2 L14 5 Z" fill="currentColor" />
                <path d="M10 16.5 L12 15 L14 16.5" />
                <path d="M10 17.5 L12 16 L14 17.5" />
            </g>
        </svg>
    ),
    // Weapon concept: Asymmetrical fantasy war pick / military pickaxe.
    // Showcases a curved armor-piercing beak on the left, a flat hammer
    // poll on the right, and a protective collar socket with top spike.
    pickaxe: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <g transform="rotate(45 12 12)">
                <line x1="12" y1="6" x2="12" y2="23" />
                <path d="M12 6 Q7 6 3 11 Q7 8.5 11.5 8.5 L12 6 Z" />
                <path d="M12 6 Q15 6 18 8.5 L16.5 10 Q14.5 9 12 8.5 Z" />
                <path d="M10 5.5 L14 5.5 L13.5 9.5 L10.5 9.5 Z" />
                <line x1="12" y1="5.5" x2="12" y2="2" />
            </g>
        </svg>
    ),
    // Weapon concept: Symmetrical crossed fencing foils / rapiers.
    // Elegantly crosses two thin, flexible duelists' blades from the
    // bottom corners, with detailed swept guards, quillons, and pommels.
    fencing: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="8" y1="16" x2="20" y2="4" />
            <path d="M7 14 C9 13.5 10 15 9.5 16.5 C9 18 7.5 17 7 14 Z" fill="none" />
            <line x1="6.5" y1="14.5" x2="9.5" y2="17.5" />
            <line x1="8.5" y1="15.5" x2="5" y2="19" />
            <circle cx="4" cy="20" r="1" />

            <line x1="16" y1="16" x2="4" y2="4" />
            <path d="M17 14 C15 13.5 14 15 14.5 16.5 C15 18 16.5 17 17 14 Z" fill="none" />
            <line x1="17.5" y1="14.5" x2="14.5" y2="17.5" />
            <line x1="15.5" y1="15.5" x2="19" y2="19" />
            <circle cx="20" cy="20" r="1" />
        </svg>
    ),
    // Weapon concept: Winged fantasy spear / hunting partisan.
    // Features a leaf-shaped blade with a center ridge, dual wing spurs
    // to prevent over-penetration, and a textured shaft grip wrap.
    spear: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="3" y1="21" x2="16" y2="8" />
            <path d="M15 9 C15.5 6.5 18.5 3.5 22 2 C20.5 5.5 17.5 8.5 15 9 Z" />
            <line x1="15" y1="9" x2="22" y2="2" />
            <path d="M15 9 L12 9 L14 7 Z" />
            <path d="M15 9 L15 12 L17 10 Z" />
            <path d="M12.5 11.5 Q14 13 13.5 12.5" />
        </svg>
    ),
    hammer: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M2 19.63L13.43 8.2L12.72 7.5L14.14 6.07L12 3.89C13.2 2.7 15.09 2.7 16.27 3.89L19.87 7.5L18.45 8.91H21.29L22 9.62L18.45 13.21L17.74 12.5V9.62L16.27 11.04L15.56 10.33L4.13 21.76L2 19.63Z" />
        </svg>
    ),
    wrench: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
        </svg>
    ),
    cog: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
        </svg>
    ),
    tools: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M21.71 20.29L20.29 21.71A1 1 0 0 1 18.88 21.71L7 9.85A3.81 3.81 0 0 1 6 10A4 4 0 0 1 2.22 4.7L4.76 7.24L5.29 6.71L6.71 5.29L7.24 4.76L4.7 2.22A4 4 0 0 1 10 6A3.81 3.81 0 0 1 9.85 7L21.71 18.88A1 1 0 0 1 21.71 20.29M2.29 18.88A1 1 0 0 0 2.29 20.29L3.71 21.71A1 1 0 0 0 5.12 21.71L10.59 16.25L7.76 13.42M20 2L16 4V6L13.83 8.17L15.83 10.17L18 8H20L22 4Z" />
        </svg>
    ),
    // Official Material Icons (from Google's repository)
    // Note: These use fill="currentColor" instead of stroke for proper rendering
    build: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
    ),
    hardware: (
        <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
            <path d="M400-120q-17 0-28.5-11.5T360-160v-480H160q0-83 58.5-141.5T360-840h240v120l120-120h80v320h-80L600-640v480q0 17-11.5 28.5T560-120H400Zm40-80h80v-240h-80v240Zm0-320h80v-240H360q-26 0-49 10.5T271-720h169v200Zm40 40Z" />
        </svg>
    ),
    ring: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12,10L8,4.4L9.6,2H14.4L16,4.4L12,10M15.5,6.8L14.3,8.5C16.5,9.4 18,11.5 18,14A6,6 0 0,1 12,20A6,6 0 0,1 6,14C6,11.5 7.5,9.4 9.7,8.5L8.5,6.8C5.8,8.1 4,10.8 4,14A8,8 0 0,0 12,22A8,8 0 0,0 20,14C20,10.8 18.2,8.1 15.5,6.8Z" />
        </svg>
    ),
    package: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M2,10.96C1.5,10.68 1.35,10.07 1.63,9.59L3.13,7C3.24,6.8 3.41,6.66 3.6,6.58L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.66,6.72 20.82,6.88 20.91,7.08L22.36,9.6C22.64,10.08 22.47,10.69 22,10.96L21,11.54V16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V10.96C2.7,11.13 2.32,11.14 2,10.96M12,4.15V4.15L12,10.85V10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V12.69L14,15.59C13.67,15.77 13.3,15.76 13,15.6V19.29L19,15.91M13.85,13.36L20.13,9.73L19.55,8.72L13.27,12.35L13.85,13.36Z" />
        </svg>
    ),
    armor: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21Z" />
        </svg>
    ),
    crown: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
        </svg>
    ),
    lock: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
        </svg>
    ),
    gavel: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
            <path d="m16 16 6-6" />
            <path d="m8 8 6-6" />
            <path d="m9 7 8 8" />
            <path d="m21 11-8-8" />
        </svg>
    ),
    // Weapon concept: Double-sided fantasy warhammer / combat gavel.
    // A heavy flanged striking head on one side, an armor-piercing
    // rear pick beak on the other, topped with a central shaft spike.
    fa_gavel: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <g transform="rotate(45 12 12)">
                <line x1="12" y1="7.5" x2="12" y2="22" />
                <path d="M12 7.5 L17 7 L18 8 L18 9.5 L17 10.5 L12 10 Z" fill="none" />
                <line x1="17" y1="7" x2="17" y2="10.5" />
                <path d="M12 7.5 Q7.5 7.5 4 10.5 Q7.5 9 12 10 Z" fill="none" />
                <path d="M10 7.5 L14 7.5 L14 10 L10 10 Z" />
                <line x1="12" y1="7.5" x2="12" y2="3.5" />
                <path d="M11.5 22 L12 24 L12.5 22 Z" />
            </g>
        </svg>
    ),
    fist: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
    ),
    fa_hand_fist: (
        <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
            <path d="M192 0c17.7 0 32 14.3 32 32l0 112-64 0 0-112c0-17.7 14.3-32 32-32zM64 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 80-64 0 0-80zm192 0c0-17.7 14.3-32 32-32s32 14.3 32 32l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96zm96 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 64c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-64zm-96 88l0-.6c9.4 5.4 20.3 8.6 32 8.6c13.2 0 25.4-4 35.6-10.8c8.7 24.9 32.5 42.8 60.4 42.8c11.7 0 22.6-3.1 32-8.6l0 8.6c0 52.3-25.1 98.8-64 128l0 96c0 17.7-14.3 32-32 32l-160 0c-17.7 0-32-14.3-32-32l0-78.4c-17.3-7.9-33.2-18.8-46.9-32.5L69.5 357.5C45.5 333.5 32 300.9 32 267l0-27c0-35.3 28.7-64 64-64l88 0c22.1 0 40 17.9 40 40s-17.9 40-40 40l-56 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l56 0c39.8 0 72-32.2 72-72z" />
        </svg>
    ),
    hand: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M3 9.25V15.75C3 20.31 6.69 24 11.25 24S19.5 20.31 19.5 15.75V5.75C19.5 5.06 18.94 4.5 18.25 4.5S17 5.06 17 5.75V12H16V2.75C16 2.06 15.44 1.5 14.75 1.5S13.5 2.06 13.5 2.75V11H12.5V1.25C12.5 .56 11.94 0 11.25 0S10 .56 10 1.25V11H9V3.25C9 2.56 8.44 2 7.75 2C7.06 2 6.5 2.56 6.5 3.25V14.03C8.47 14.28 10 15.96 10 18H9C9 16.35 7.65 15 6 15H5.5V9.25C5.5 8.56 4.94 8 4.25 8S3 8.56 3 9.25Z" />
        </svg>
    ),
    hand_back_right: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M13 24C9.74 24 6.81 22 5.6 19L2.57 11.37C2.26 10.58 3 9.79 3.81 10.05L4.6 10.31C5.16 10.5 5.62 10.92 5.84 11.47L7.25 15H8V3.25C8 2.56 8.56 2 9.25 2S10.5 2.56 10.5 3.25V12H11.5V1.25C11.5 .56 12.06 0 12.75 0S14 .56 14 1.25V12H15V2.75C15 2.06 15.56 1.5 16.25 1.5C16.94 1.5 17.5 2.06 17.5 2.75V12H18.5V5.75C18.5 5.06 19.06 4.5 19.75 4.5S21 5.06 21 5.75V16C21 20.42 17.42 24 13 24Z" />
        </svg>
    ),
    arms: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z" />
        </svg>
    ),
    strength: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M3 18.34C3 18.34 4 7.09 7 3L12 4L11 7.09H9V14.25H10C12 11.18 16.14 10.06 18.64 11.18C21.94 12.71 21.64 17.32 18.64 19.36C16.24 21 9 22.43 3 18.34Z" />
        </svg>
    ),
    fitness_center: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 5C10.89 5 10 5.89 10 7S10.89 9 12 9 14 8.11 14 7 13.11 5 12 5M22 1V6H20V4H4V6H2V1H4V3H20V1H22M15 11.26V23H13V18H11V23H9V11.26C6.93 10.17 5.5 8 5.5 5.5L5.5 5H7.5L7.5 5.5C7.5 8 9.5 10 12 10S16.5 8 16.5 5.5L16.5 5H18.5L18.5 5.5C18.5 8 17.07 10.17 15 11.26Z" />
        </svg>
    ),
    martial_arts: (
        <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
            <path d="m400-80-20-360-127-73-14 52 81 141-69 40-99-170 48-172 230-132-110-110 56-56 184 183-144 83 48 42 328-268 48 56-340 344-20 400h-80ZM200-680q-33 0-56.5-23.5T120-760q0-33 23.5-56.5T200-840q33 0 56.5 23.5T280-760q0 33-23.5 56.5T200-680Z" />
        </svg>
    ),
    security: (
        <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
            <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q97-30 162-118.5T718-480H480v-315l-240 90v207q0 7 2 18h238v316Z" />
        </svg>
    ),
    verified_user: (
        <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
            <path d="m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z" />
        </svg>
    ),
    fa_shield_halved: (
        <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
            <path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0zm0 66.8l0 378.1C394 378 431.1 230.1 432 141.4L256 66.8s0 0 0 0z" />
        </svg>
    ),
    // MDI Shields
    shield_sun: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M12 8.89C13.6 8.89 14.89 10.18 14.89 11.78S13.6 14.67 12 14.67 9.11 13.37 9.11 11.78 10.41 8.89 12 8.89M12 6L13.38 8C12.96 7.82 12.5 7.73 12 7.73S11.05 7.82 10.62 8L12 6M7 8.89L9.4 8.69C9.06 9 8.74 9.34 8.5 9.76C8.25 10.18 8.1 10.62 8 11.08L7 8.89M7 14.67L8.03 12.5C8.11 12.93 8.27 13.38 8.5 13.8C8.75 14.23 9.06 14.59 9.4 14.88L7 14.67M17 8.89L16 11.08C15.9 10.62 15.74 10.18 15.5 9.76C15.26 9.34 14.95 9 14.6 8.68L17 8.89M17 14.67L14.6 14.87C14.94 14.58 15.25 14.22 15.5 13.8C15.74 13.38 15.89 12.93 15.97 12.5L17 14.67M12 17.55L10.61 15.57C11.04 15.72 11.5 15.82 12 15.82C12.5 15.82 12.95 15.72 13.37 15.57L12 17.55Z" />
        </svg>
    ),
    shield_sun_outline: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M21 11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5L12 1L21 5V11M12 21C15.75 20 19 15.54 19 11.22V6.3L12 3.18L5 6.3V11.22C5 15.54 8.25 20 12 21M12 8.89C13.6 8.89 14.89 10.18 14.89 11.78S13.6 14.67 12 14.67 9.11 13.37 9.11 11.78 10.41 8.89 12 8.89M12 6L13.38 8C12.96 7.82 12.5 7.73 12 7.73S11.05 7.82 10.62 8L12 6M7 8.89L9.4 8.69C9.06 9 8.74 9.34 8.5 9.76C8.25 10.18 8.1 10.62 8 11.08L7 8.89M7 14.67L8.03 12.5C8.11 12.93 8.27 13.38 8.5 13.8C8.75 14.23 9.06 14.59 9.4 14.88L7 14.67M17 8.89L16 11.08C15.9 10.62 15.74 10.18 15.5 9.76C15.26 9.34 14.95 9 14.6 8.68L17 8.89M17 14.67L14.6 14.87C14.94 14.58 15.25 14.22 15.5 13.8C15.74 13.38 15.89 12.93 15.97 12.5L17 14.67M12 17.55L10.61 15.57C11.04 15.72 11.5 15.82 12 15.82C12.5 15.82 12.95 15.72 13.37 15.57L12 17.55Z" />
        </svg>
    ),
    shield_sword: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L3 5V11C3 16.5 6.8 21.7 12 23C17.2 21.7 21 16.5 21 11V5L12 1M15 15H13V18H11V15H9V13H11L10 7.1L12 5.5L14 7.1L13 13H15V15Z" />
        </svg>
    ),
    shield_sword_outline: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L21 5V11C21 16.5 17.2 21.7 12 23C6.8 21.7 3 16.5 3 11V5L12 1M12 3.2L5 6.3V11.2C5 15.5 8.2 20 12 21C15.8 20 19 15.5 19 11.2V6.3L12 3.2M12 5.5L14 7.1L13 13H15V15H13V18H11V15H9V13H11L10 7.1L12 5.5Z" />
        </svg>
    ),
    shield_cross: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12,1L3,5V11C3,16.5 6.8,21.7 12,23C17.2,21.7 21,16.5 21,11V5L12,1M16,10H13V18H11V10H8V8H11V5H13V8H16V10Z" />
        </svg>
    ),
    shield_cross_outline: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M21,11C21,16.5 17.2,21.7 12,23C6.8,21.7 3,16.5 3,11V5L12,1L21,5V11M12,21C15.8,20 19,15.5 19,11.2V6.3L12,3.2L5,6.3V11.2C5,15.5 8.3,20 12,21M16,9H13V6H11V9H8V11H11V19H13V11H16V9Z" />
        </svg>
    ),
    shield_crown: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L21 5V11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5L12 1M16 14H8V15.5C8 15.77 8.19 15.96 8.47 16L8.57 16H15.43C15.74 16 15.95 15.84 16 15.59L16 15.5V14M17 8L17 8L14.33 10.67L12 8.34L9.67 10.67L7 8L7 8L8 13H16L17 8Z" />
        </svg>
    ),
    shield_crown_outline: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L21 5V11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5L12 1M12 3.18L5 6.3V11.22C5 15.54 8.25 20 12 21C15.75 20 19 15.54 19 11.22V6.3L12 3.18M16 14V15.5L16 15.59C15.96 15.81 15.78 15.96 15.53 16L15.43 16H8.57L8.47 16C8.22 15.96 8.04 15.81 8 15.59L8 15.5V14H16M17 8L16 13H8L7 8L7 8L9.67 10.67L12 8.34L14.33 10.67L17 8L17 8Z" />
        </svg>
    ),
    shield_moon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M15.97 14.41C14.13 16.58 10.76 16.5 9 14.34C6.82 11.62 8.36 7.62 11.7 7C12.04 6.95 12.33 7.28 12.21 7.61C11.75 8.84 11.82 10.25 12.53 11.47C13.24 12.69 14.42 13.46 15.71 13.67C16.05 13.72 16.2 14.14 15.97 14.41Z" />
        </svg>
    ),
    shield_moon_outline: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M21 11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5L12 1L21 5V11M12 21C15.75 20 19 15.54 19 11.22V6.3L12 3.18L5 6.3V11.22C5 15.54 8.25 20 12 21M9 14.33C10.76 16.5 14.13 16.57 15.97 14.4C16.2 14.13 16.05 13.72 15.71 13.66C14.42 13.45 13.23 12.68 12.53 11.46C11.82 10.24 11.75 8.83 12.21 7.6C12.33 7.27 12.05 6.94 11.7 7C8.36 7.62 6.81 11.61 9 14.33" />
        </svg>
    ),
    shield_star: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M15.08 16L12 14.15L8.93 16L9.74 12.5L7.03 10.16L10.61 9.85L12 6.55L13.39 9.84L16.97 10.15L14.26 12.5L15.08 16Z" />
        </svg>
    ),
    // Weapon concept: Stylized elven/ranger's mark fantasy reticle.
    // Replaces modern sniper scope crosshairs with a runic theme,
    // using four inward-pointing compass arrowheads and reticle ticks.
    crosshairs: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <path d="M10 2 L12 5 L14 2" />
            <path d="M10 22 L12 19 L14 22" />
            <path d="M2 10 L5 12 L2 14" />
            <path d="M22 10 L19 12 L22 14" />
            <line x1="12" y1="5" x2="12" y2="8" />
            <line x1="12" y1="19" x2="12" y2="16" />
            <line x1="5" y1="12" x2="8" y2="12" />
            <line x1="19" y1="12" x2="16" y2="12" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
    ),
    // Weapon concept: Archery bullseye target pierced by a diagonal ranger arrow.
    // Visually distinct from the compass reticle, featuring concentric target rings,
    // arrowhead, shaft, and fletching crossing the center.
    fa_crosshairs: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="4" />
            <line x1="3" y1="21" x2="20" y2="4" />
            <path d="M17 5 L21 3 L19 7 Z" fill="currentColor" />
            <line x1="5" y1="17" x2="7" y2="19" />
            <line x1="3.5" y1="18.5" x2="5.5" y2="20.5" />
        </svg>
    ),
    crosshair: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M3.05,13H1V11H3.05C3.5,6.83 6.83,3.5 11,3.05V1H13V3.05C17.17,3.5 20.5,6.83 20.95,11H23V13H20.95C20.5,17.17 17.17,20.5 13,20.95V23H11V20.95C6.83,20.5 3.5,17.17 3.05,13M12,5A7,7 0 0,0 5,12A7,7 0 0,0 12,19A7,7 0 0,0 19,12A7,7 0 0,0 12,5Z" />
        </svg>
    ),
    target: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M11,2V4.07C7.38,4.53 4.53,7.38 4.07,11H2V13H4.07C4.53,16.62 7.38,19.47 11,19.93V22H13V19.93C16.62,19.47 19.47,16.62 19.93,13H22V11H19.93C19.47,7.38 16.62,4.53 13,4.07V2M11,6.08V8H13V6.09C15.5,6.5 17.5,8.5 17.92,11H16V13H17.91C17.5,15.5 15.5,17.5 13,17.92V16H11V17.91C8.5,17.5 6.5,15.5 6.08,13H8V11H6.09C6.5,8.5 8.5,6.5 11,6.08M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11Z" />
        </svg>
    ),
    protect: (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z" />
        </svg>
    ),
});
