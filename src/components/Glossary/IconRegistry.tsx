import React from 'react';

export type GlossaryIconName =
    | 'eye'
    | 'heart'
    | 'shield'
    | 'sword'
    | 'wind'
    | 'flame'
    | 'water'
    | 'mountain'
    | 'stars'
    | 'skull'
    | 'sun'
    | 'moon'
    | 'magic'
    | 'feather'
    | 'claw'
    | 'brain'
    | 'lightbulb'
    | 'clock'
    | 'book'
    // Class icons (custom)
    | 'flask'
    | 'gavel'
    | 'music'
    | 'pray'
    | 'leaf'
    | 'fist'
    | 'crosshairs'
    | 'mask'
    | 'wizard_hat'
    // Material Icons
    | 'build'
    | 'hardware'
    | 'auto_awesome'
    | 'spa'
    | 'security'
    | 'martial_arts'
    | 'verified_user'
    // Font Awesome Icons (official class icons)
    | 'fa_flask'
    | 'fa_gavel'
    | 'fa_music'
    | 'fa_hands_praying'
    | 'fa_leaf'
    | 'fa_shield_halved'
    | 'fa_hand_fist'
    | 'fa_sun'
    | 'fa_crosshairs'
    | 'fa_mask'
    | 'fa_fire'
    | 'fa_skull'
    | 'fa_hat_wizard'
    | 'fa_eye'
    | 'fa_lightbulb'
    | 'fa_brain'
    | 'fa_book'
    | 'fa_feather'
    // Pictogrammers/MDI Icons
    | 'sword_cross'
    | 'axe'
    | 'mace'
    | 'eye_mdi'
    | 'lightbulb_mdi'
    | 'brain_mdi'
    | 'book_mdi'
    | 'feather_mdi'
    | 'claw_mdi'
    // MDI Weapons
    | 'bow_arrow' | 'axe_battle' | 'pickaxe' | 'fencing' | 'spear'
    // MDI Shields
    | 'shield_sun' | 'shield_sun_outline'
    | 'shield_sword' | 'shield_sword_outline'
    | 'shield_cross' | 'shield_cross_outline'
    | 'shield_crown' | 'shield_crown_outline'
    | 'shield_moon' | 'shield_moon_outline'
    | 'shield_star' | 'shield_star_outline'
    // MDI Magic & Death
    | 'magic_staff' | 'wizard_hat_mdi'
    | 'bottle_tonic_skull' | 'bottle_tonic_skull_outline'
    | 'skull_mdi' | 'skull_outline_mdi'
    | 'skull_crossbones' | 'skull_crossbones_outline'
    // MDI Weather
    | 'weather_hail' | 'weather_hazy' | 'weather_lightning' | 'weather_lightning_rainy'
    | 'weather_pouring' | 'weather_cloudy' | 'weather_rainy' | 'weather_sunny' | 'weather_fog'
    | 'weather_snowy' | 'weather_snowy_heavy' | 'weather_snowy_rainy'
    // MDI Nature
    | 'tree' | 'tree_outline'
    | 'flower' | 'flower_outline'
    // MDI Dice
    | 'dice_d4' | 'dice_d4_outline'
    | 'dice_d6' | 'dice_d6_outline'
    | 'dice_d8' | 'dice_d8_outline'
    | 'dice_d10' | 'dice_d10_outline'
    | 'dice_d12' | 'dice_d12_outline'
    | 'dice_d20' | 'dice_d20_outline'
    // MDI Animals/Creatures
    | 'horse' | 'horse_variant' | 'horse_variant_fast'
    | 'fish'
    | 'paw' | 'paw_outline' | 'paw_off' | 'paw_off_outline'
    | 'spider' | 'spider_outline'
    // MDI Luck & Conditions
    | 'clover' | 'clover_outline' | 'horseshoe'
    | 'emoticon_sick' | 'emoticon_sick_outline'
    | 'emoticon_kiss' | 'emoticon_kiss_outline'
    | 'emoticon_devil' | 'emoticon_devil_outline';

interface GlossaryIconProps {
    name: GlossaryIconName | string;
    className?: string;
}

/**
 * A centralized registry of SVG icons for the glossary.
 * This component maps simple string IDs to complex SVG paths.
 */
export const GlossaryIcon: React.FC<GlossaryIconProps> = ({ name, className = "w-4 h-4" }) => {
    const icons: Record<string, React.ReactNode> = {
        eye: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        ),
        heart: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
        ),
        shield: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            </svg>
        ),
        sword: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L11.92,16.67L3,7.75V3H7.75L16.67,11.92L18.09,10.5L19.5,11.91L16.83,14.58L19.95,17.7C20.35,18.1 20.35,18.73 19.96,19.12Z" />
            </svg>
        ),
        wind: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
            </svg>
        ),
        moon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M2 12A10 10 0 0 0 15 21.54A10 10 0 0 1 15 2.46A10 10 0 0 0 2 12Z" />
            </svg>
        ),
        water: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z" />
            </svg>
        ),
        flame: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
            </svg>
        ),
        magic: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M15 4V2" />
                <path d="M15 16v-2" />
                <path d="M8 9h2" />
                <path d="M20 9h2" />
                <path d="M17.8 11.8 19 13" />
                <path d="M15 9h0" />
                <path d="M17.8 6.2 19 5" />
                <path d="m3 21 9-9" />
                <path d="M12.2 6.2 11 5" />
            </svg>
        ),
        sun: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
            </svg>
        ),
        lightbulb: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
                <path d="M9 18h6" />
                <path d="M10 22h4" />
            </svg>
        ),
        book: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6.5 2H20v20H6.5" />
            </svg>
        ),
        clock: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        feather: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                <line x1="16" y1="8" x2="2" y2="22" />
                <line x1="17.5" y1="15" x2="9" y2="15" />
            </svg>
        ),
        claw: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12c0-1.8.48-3.5 1.31-4.96" />
                <path d="m14 10-2 2" />
                <path d="m10 10 2 2" />
                <path d="m12 18v-4" />
            </svg>
        ),
        brain: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.125A5 5 0 1 0 14 18a5 5 0 0 0 3-8.89V9a5 5 0 0 0-5-4Z" />
                <path d="M9 13a4.5 4.5 0 1 1 6 0" />
                <path d="M12 13v4" />
            </svg>
        ),
        mountain: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
        ),
        stars: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="m12 3 1.912 5.886h6.19l-5.008 3.639 1.912 5.886L12 14.772l-5.006 3.639 1.912-5.886-5.008-3.639h6.19L12 3z" />
            </svg>
        ),
        skull: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                {/* Skull shape */}
                <circle cx="12" cy="10" r="7" />
                {/* Eye sockets */}
                <circle cx="9" cy="9" r="1.5" />
                <circle cx="15" cy="9" r="1.5" />
                {/* Nose */}
                <path d="M12 12v2" />
                {/* Jaw/Teeth */}
                <path d="M8 17h8" />
                <path d="M9 17v3" />
                <path d="M12 17v3" />
                <path d="M15 17v3" />
            </svg>
        ),
        // Class Icons
        flask: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
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
        music: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
            </svg>
        ),
        pray: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                {/* Praying hands */}
                <path d="M12 22V12" />
                <path d="M9 12c0-3 3-6 3-10" />
                <path d="M15 12c0-3-3-6-3-10" />
                <path d="M9 12H6c-1 0-2 1-2 2v2c0 1 1 2 2 2h3" />
                <path d="M15 12h3c1 0 2 1 2 2v2c0 1-1 2-2 2h-3" />
                <path d="M9 18l3 4 3-4" />
            </svg>
        ),
        leaf: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
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
        crosshairs: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
        ),
        mask: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z" />
                <path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2Z" />
                <path d="M18 11c-1.5 0-3 .5-3 2 2 0 3 0 3-2Z" />
            </svg>
        ),
        wizard_hat: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
                {/* Pointy wizard hat */}
                <path d="M12 2L6 18h12L12 2z" />
                {/* Brim */}
                <path d="M3 18c0 1 2 3 9 3s9-2 9-3" />
                <path d="M6 18c0 .5 2.5 2 6 2s6-1.5 6-2" />
                {/* Star decoration */}
                <path d="M10 10l1 .5-.5 1 .5-1 1-.5-1-.5.5-1-.5 1z" />
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
        auto_awesome: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="m19 9-1.25-2.75L15 5l2.75-1.25L19 1l1.25 2.75L23 5l-2.75 1.25Zm0 14-1.25-2.75L15 19l2.75-1.25L19 15l1.25 2.75L23 19l-2.75 1.25ZM9 20l-2.5-5.5L1 12l5.5-2.5L9 4l2.5 5.5L17 12l-5.5 2.5Zm0-4.85L10 13l2.15-1L10 11 9 8.85 8 11l-2.15 1L8 13ZM9 12Z" />
            </svg>
        ),
        spa: (
            <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
                <path d="M480-80q-73-9-145-39.5T206.5-207Q150-264 115-351T80-560v-40h40q51 0 105 13t101 39q12-86 54.5-176.5T480-880q57 65 99.5 155.5T634-548q47-26 101-39t105-13h40v40q0 122-35 209t-91.5 144q-56.5 57-128 87.5T480-80Zm-2-82q-11-166-98.5-251T162-518q11 171 101.5 255T478-162Zm2-254q15-22 36.5-45.5T558-502q-2-57-22.5-119T480-742q-35 59-55.5 121T402-502q20 17 42 40.5t36 45.5Zm78 236q37-12 77-35t74.5-62.5q34.5-39.5 59-98.5T798-518q-94 14-165 62.5T524-332q12 32 20.5 70t13.5 82Zm-78-236Zm78 236Zm-80 18Zm46-170ZM480-80Z" />
            </svg>
        ),
        security: (
            <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
                <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q97-30 162-118.5T718-480H480v-315l-240 90v207q0 7 2 18h238v316Z" />
            </svg>
        ),
        martial_arts: (
            <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
                <path d="m400-80-20-360-127-73-14 52 81 141-69 40-99-170 48-172 230-132-110-110 56-56 184 183-144 83 48 42 328-268 48 56-340 344-20 400h-80ZM200-680q-33 0-56.5-23.5T120-760q0-33 23.5-56.5T200-840q33 0 56.5 23.5T280-760q0 33-23.5 56.5T200-680Z" />
            </svg>
        ),
        verified_user: (
            <svg viewBox="0 -960 960 960" fill="currentColor" className={className}>
                <path d="m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z" />
            </svg>
        ),
        // Font Awesome 6 Icons (official class icons from https://fontawesome.com)
        fa_flask: (
            <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
                <path d="M288 0L160 0 128 0C110.3 0 96 14.3 96 32s14.3 32 32 32l0 132.8c0 11.8-3.3 23.5-9.5 33.5L10.3 406.2C3.6 417.2 0 429.7 0 442.6C0 480.9 31.1 512 69.4 512l309.2 0c38.3 0 69.4-31.1 69.4-69.4c0-12.8-3.6-25.4-10.3-36.4L329.5 230.4c-6.2-10.1-9.5-21.7-9.5-33.5L320 64c17.7 0 32-14.3 32-32s-14.3-32-32-32L288 0zM192 196.8L192 64l64 0 0 132.8c0 23.7 6.6 46.9 19 67.1L309.5 320l-171 0L173 263.9c12.4-20.2 19-43.4 19-67.1z" />
            </svg>
        ),
        fa_gavel: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M318.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-120 120c-12.5 12.5-12.5 32.8 0 45.3l16 16c12.5 12.5 32.8 12.5 45.3 0l4-4L325.4 293.4l-4 4c-12.5 12.5-12.5 32.8 0 45.3l16 16c12.5 12.5 32.8 12.5 45.3 0l120-120c12.5-12.5 12.5-32.8 0-45.3l-16-16c-12.5-12.5-32.8-12.5-45.3 0l-4 4L330.6 74.6l4-4c12.5-12.5 12.5-32.8 0-45.3l-16-16zm-152 288c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3l48 48c12.5 12.5 32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-1.4-1.4L272 285.3 226.7 240 168 298.7l-1.4-1.4z" />
            </svg>
        ),
        fa_music: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M499.1 6.3c8.1 6 12.9 15.6 12.9 25.7l0 72 0 264c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L448 147 192 223.8 192 432c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L128 200l0-72c0-14.1 9.3-26.6 22.8-30.7l320-96c9.7-2.9 20.2-1.1 28.3 5z" />
            </svg>
        ),
        fa_hands_praying: (
            <svg viewBox="0 0 640 512" fill="currentColor" className={className}>
                <path d="M351.2 4.8c3.2-2 6.6-3.3 10-4.1c4.7-1 9.6-.9 14.1 .1c7.7 1.8 14.8 6.5 19.4 13.6L514.6 194.2c8.8 13.1 13.4 28.6 13.4 44.4l0 73.5c0 6.9 4.4 13 10.9 15.2l79.2 26.4C631.2 358 640 370.2 640 384l0 96c0 9.9-4.6 19.3-12.5 25.4s-18.1 8.1-27.7 5.5L431 465.9c-56-14.9-95-65.7-95-123.7L336 224c0-17.7 14.3-32 32-32s32 14.3 32 32l0 80c0 8.8 7.2 16 16 16s16-7.2 16-16l0-84.9c0-7-1.8-13.8-5.3-19.8L340.3 48.1c-1.7-3-2.9-6.1-3.6-9.3c-1-4.7-1-9.6 .1-14.1c1.9-8 6.8-15.2 14.3-19.9zm-62.4 0c7.5 4.6 12.4 11.9 14.3 19.9c1.1 4.6 1.2 9.4 .1 14.1c-.7 3.2-1.9 6.3-3.6 9.3L213.3 199.3c-3.5 6-5.3 12.9-5.3 19.8l0 84.9c0 8.8 7.2 16 16 16s16-7.2 16-16l0-80c0-17.7 14.3-32 32-32s32 14.3 32 32l0 118.2c0 58-39 108.7-95 123.7l-168.7 45c-9.6 2.6-19.9 .5-27.7-5.5S0 490 0 480l0-96c0-13.8 8.8-26 21.9-30.4l79.2-26.4c6.5-2.2 10.9-8.3 10.9-15.2l0-73.5c0-15.8 4.7-31.2 13.4-44.4L245.2 14.5c4.6-7.1 11.7-11.8 19.4-13.6c4.6-1.1 9.4-1.2 14.1-.1c3.5 .8 6.9 2.1 10 4.1z" />
            </svg>
        ),
        fa_leaf: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M272 96c-78.6 0-145.1 51.5-167.7 122.5c33.6-17 71.5-26.5 111.7-26.5l88 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-16 0-72 0s0 0 0 0c-16.6 0-32.7 1.9-48.3 5.4c-25.9 5.9-49.9 16.4-71.4 30.7c0 0 0 0 0 0C38.3 298.8 0 364.9 0 440l0 16c0 13.3 10.7 24 24 24s24-10.7 24-24l0-16c0-48.7 20.7-92.5 53.8-123.2C121.6 392.3 190.3 448 272 448l1 0c132.1-.7 239-130.9 239-291.4c0-42.6-7.5-83.1-21.1-119.6c-2.6-6.9-12.7-6.6-16.2-.1C455.9 72.1 418.7 96 376 96L272 96z" />
            </svg>
        ),
        fa_shield_halved: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0zm0 66.8l0 378.1C394 378 431.1 230.1 432 141.4L256 66.8s0 0 0 0z" />
            </svg>
        ),
        fa_hand_fist: (
            <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
                <path d="M192 0c17.7 0 32 14.3 32 32l0 112-64 0 0-112c0-17.7 14.3-32 32-32zM64 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 80-64 0 0-80zm192 0c0-17.7 14.3-32 32-32s32 14.3 32 32l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96zm96 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 64c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-64zm-96 88l0-.6c9.4 5.4 20.3 8.6 32 8.6c13.2 0 25.4-4 35.6-10.8c8.7 24.9 32.5 42.8 60.4 42.8c11.7 0 22.6-3.1 32-8.6l0 8.6c0 52.3-25.1 98.8-64 128l0 96c0 17.7-14.3 32-32 32l-160 0c-17.7 0-32-14.3-32-32l0-78.4c-17.3-7.9-33.2-18.8-46.9-32.5L69.5 357.5C45.5 333.5 32 300.9 32 267l0-27c0-35.3 28.7-64 64-64l88 0c22.1 0 40 17.9 40 40s-17.9 40-40 40l-56 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l56 0c39.8 0 72-32.2 72-72z" />
            </svg>
        ),
        fa_sun: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm224 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z" />
            </svg>
        ),
        fa_crosshairs: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M256 0c17.7 0 32 14.3 32 32l0 34.7C368.4 80.1 431.9 143.6 445.3 224l34.7 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-34.7 0C431.9 368.4 368.4 431.9 288 445.3l0 34.7c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-34.7C143.6 431.9 80.1 368.4 66.7 288L32 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l34.7 0C80.1 143.6 143.6 80.1 224 66.7L224 32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z" />
            </svg>
        ),
        fa_mask: (
            <svg viewBox="0 0 576 512" fill="currentColor" className={className}>
                <path d="M288 64C64 64 0 160 0 272S80 448 176 448l8.4 0c24.2 0 46.4-13.7 57.2-35.4l23.2-46.3c4.4-8.8 13.3-14.3 23.2-14.3s18.8 5.5 23.2 14.3l23.2 46.3c10.8 21.7 33 35.4 57.2 35.4l8.4 0c96 0 176-64 176-176s-64-208-288-208zM96 256a64 64 0 1 1 128 0A64 64 0 1 1 96 256zm320-64a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" />
            </svg>
        ),
        fa_fire: (
            <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
                <path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z" />
            </svg>
        ),
        fa_skull: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M416 398.9c58.5-41.1 96-104.1 96-174.9C512 100.3 397.4 0 256 0S0 100.3 0 224c0 70.7 37.5 133.8 96 174.9c0 .4 0 .7 0 1.1l0 64c0 26.5 21.5 48 48 48l48 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 64 0 0-48c0-8.8 7.2-16 16-16s16 7.2 16 16l0 48 48 0c26.5 0 48-21.5 48-48l0-64c0-.4 0-.7 0-1.1zM96 256a64 64 0 1 1 128 0A64 64 0 1 1 96 256zm256-64a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" />
            </svg>
        ),
        fa_hat_wizard: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M64 416L168.6 180.7c15.3-34.4 40.3-63.5 72-83.7l146.9-94c3-1.9 6.5-2.9 10-2.9C407.7 0 416 8.3 416 18.6l0 1.6c0 2.6-.5 5.1-1.4 7.5L354.8 176.9c-1.9 4.7-2.8 9.7-2.8 14.7c0 5.5 1.2 11 3.4 16.1L448 416l-207.1 0 11.8-35.4 40.4-13.5c6.5-2.2 10.9-8.3 10.9-15.2s-4.4-13-10.9-15.2l-40.4-13.5-13.5-40.4C237 276.4 230.9 272 224 272s-13 4.4-15.2 10.9l-13.5 40.4-40.4 13.5C148.4 339 144 345.1 144 352s4.4 13 10.9 15.2l40.4 13.5L207.1 416 64 416zM279.6 141.5c-1.1-3.3-4.1-5.5-7.6-5.5s-6.5 2.2-7.6 5.5l-6.7 20.2-20.2 6.7c-3.3 1.1-5.5 4.1-5.5 7.6s2.2 6.5 5.5 7.6l20.2 6.7 6.7 20.2c1.1 3.3 4.1 5.5 7.6 5.5s6.5-2.2 7.6-5.5l6.7-20.2 20.2-6.7c3.3-1.1 5.5-4.1 5.5-7.6s-2.2-6.5-5.5-7.6l-20.2-6.7-6.7-20.2zM32 448l448 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 512c-17.7 0-32-14.3-32-32s14.3-32 32-32z" />
            </svg>
        ),
        // Pictogrammers/MDI Weapon Icons
        sword_cross: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z" />
            </svg>
        ),
        axe: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2L22,8C22,12 20,14 16,15L13,10L9,6L12,2M4.11,19.84L2.12,18.33L9.19,9L11,10.81L4.11,19.84Z" />
            </svg>
        ),
        mace: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19.92 9.27C19.97 9 20 8.76 20 8.5S19.97 8 19.92 7.73L23 8.5L19.92 9.27M14.69 12.92L15.5 16.16L16.31 12.92C16.05 12.97 15.78 13 15.5 13S14.95 12.97 14.69 12.92M11.7 10.89L6.79 15.79L6.09 15.09L1 20.17L3.83 23L8.91 17.91L8.21 17.21L13.11 12.3C12.54 11.94 12.06 11.46 11.7 10.89M16.27 4.08L15.5 1L14.73 4.08C15 4.03 15.24 4 15.5 4S16 4.03 16.27 4.08M8 8.5L11.08 9.27C11.03 9 11 8.76 11 8.5S11.03 8 11.08 7.73L8 8.5M18.63 10.04C18.86 9.58 19 9.06 19 8.5S18.86 7.42 18.63 6.96L21 3L17.04 5.37C16.58 5.14 16.06 5 15.5 5S14.42 5.14 13.96 5.37L10 3L12.37 6.96C12.14 7.42 12 7.94 12 8.5C12 10.43 13.57 12 15.5 12C16.06 12 16.58 11.86 17.04 11.63L21 14L18.63 10.04Z" />
            </svg>
        ),
        // Font Awesome replacement icons
        fa_eye: (
            <svg viewBox="0 0 576 512" fill="currentColor" className={className}>
                <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" />
            </svg>
        ),
        fa_lightbulb: (
            <svg viewBox="0 0 384 512" fill="currentColor" className={className}>
                <path d="M272 384c9.6-31.9 29.5-59.1 49.2-86.2c0 0 0 0 0 0c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c0 0 0 0 0 0c19.8 27.1 39.7 54.4 49.2 86.2l160 0zM192 512c44.2 0 80-35.8 80-80l0-16-160 0 0 16c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z" />
            </svg>
        ),
        fa_brain: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M184 0c30.9 0 56 25.1 56 56l0 400c0 30.9-25.1 56-56 56c-28.9 0-52.7-21.9-55.7-50.1c-5.2 1.4-10.7 2.1-16.3 2.1c-35.3 0-64-28.7-64-64c0-7.4 1.3-14.6 3.6-21.2C21.4 367.4 0 338.2 0 304c0-31.9 18.7-59.5 45.8-72.3C37.1 220.8 32 207 32 192c0-30.7 21.6-56.3 50.4-62.6C80.8 123.9 80 118 80 112c0-29.9 20.6-55.1 48.3-62.1C131.3 21.9 155.1 0 184 0zM328 0c28.9 0 52.6 21.9 55.7 49.9c27.8 7 48.3 32.1 48.3 62.1c0 6-.8 11.9-2.4 17.4c28.8 6.2 50.4 31.9 50.4 62.6c0 15-5.1 28.8-13.8 39.7C493.3 244.5 512 272.1 512 304c0 34.2-21.4 63.4-51.6 74.8c2.3 6.6 3.6 13.8 3.6 21.2c0 35.3-28.7 64-64 64c-5.6 0-11.1-.7-16.3-2.1c-3 28.2-26.8 50.1-55.7 50.1c-30.9 0-56-25.1-56-56l0-400c0-30.9 25.1-56 56-56z" />
            </svg>
        ),
        fa_book: (
            <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
                <path d="M96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96l288 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-64c17.7 0 32-14.3 32-32l0-320c0-17.7-14.3-32-32-32L384 0 96 0zm0 384l256 0 0 64L96 448c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16zm16 48l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z" />
            </svg>
        ),
        fa_feather: (
            <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
                <path d="M278.5 215.6L23 471c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l57-57 68 0c49.7 0 97.9-14.4 139-41c11.1-7.2 5.5-23-7.8-23c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l81-24.3c2.5-.8 4.8-2.1 6.7-4l22.4-22.4c10.1-10.1 2.9-27.3-11.3-27.3l-32.2 0c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l112-33.6c4-1.2 7.4-3.9 9.3-7.7C506.4 207.6 512 184.1 512 160c0-41-16.3-80.3-45.3-109.3l-5.5-5.5C432.3 16.3 393 0 352 0s-80.3 16.3-109.3 45.3L139 149C91 197 64 262.1 64 330l0 55.3L253.6 195.8c6.2-6.2 16.4-6.2 22.6 0c5.4 5.4 6.1 13.6 2.2 19.8z" />
            </svg>
        ),
        // MDI replacement icons  
        eye_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
            </svg>
        ),
        lightbulb_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z" />
            </svg>
        ),
        brain_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M21.33,12.91C21.42,14.46 20.71,15.95 19.44,16.86L20.21,18.35C20.44,18.8 20.47,19.33 20.27,19.8C20.08,20.27 19.69,20.64 19.21,20.8L18.42,21.05C18.25,21.11 18.06,21.14 17.88,21.14C17.37,21.14 16.89,20.91 16.56,20.5L14.44,18C13.55,17.85 12.71,17.47 12,16.9C11.5,17.05 11,17.13 10.5,17.13C9.62,17.13 8.74,16.86 8,16.34C7.47,16.5 6.93,16.57 6.38,16.56C5.59,16.57 4.81,16.41 4.08,16.11C2.65,15.47 1.7,14.07 1.65,12.5C1.57,11.78 1.69,11.05 2,10.39C1.71,9.64 1.68,8.82 1.93,8.06C2.3,7.11 3,6.32 3.87,5.82C4.45,4.13 6.08,3 7.87,3.12C9.47,1.62 11.92,1.46 13.7,2.75C14.12,2.64 14.56,2.58 15,2.58C16.36,2.55 17.65,3.15 18.5,4.22C20.54,4.75 22,6.57 22.08,8.69C22.13,9.8 21.83,10.89 21.22,11.82C21.29,12.18 21.33,12.54 21.33,12.91M16.33,11.5C16.9,11.57 17.35,12 17.35,12.57A1,1 0 0,1 16.35,13.57H15.72C15.4,14.47 14.84,15.26 14.1,15.86C14.35,15.95 14.61,16 14.87,16.07C20,16 19.4,12.87 19.4,12.82C19.34,11.39 18.14,10.27 16.71,10.33A1,1 0 0,1 15.71,9.33A1,1 0 0,1 16.71,8.33C17.94,8.36 19.12,8.82 20.04,9.63C20.09,9.34 20.12,9.04 20.12,8.74C20.06,7.5 19.5,6.42 17.25,6.21C16,3.25 12.85,4.89 12.85,5.81V5.81C12.82,6.04 13.06,6.53 13.1,6.56A1,1 0 0,1 14.1,7.56C14.1,8.11 13.65,8.56 13.1,8.56V8.56C12.57,8.54 12.07,8.34 11.67,8C11.19,8.31 10.64,8.5 10.07,8.56V8.56C9.5,8.61 9.03,8.21 9,7.66C8.92,7.1 9.33,6.61 9.88,6.56C10.04,6.54 10.82,6.42 10.82,5.79V5.79C10.82,5.13 11.07,4.5 11.5,4C10.58,3.75 9.59,4.08 8.59,5.29C6.75,5 6,5.25 5.45,7.2C4.5,7.67 4,8 3.78,9C4.86,8.78 5.97,8.87 7,9.25C7.5,9.44 7.78,10 7.59,10.54C7.4,11.06 6.82,11.32 6.3,11.13C5.57,10.81 4.75,10.79 4,11.07C3.68,11.34 3.68,11.9 3.68,12.34C3.68,13.08 4.05,13.77 4.68,14.17C5.21,14.44 5.8,14.58 6.39,14.57C6.24,14.31 6.11,14.04 6,13.76C5.81,13.22 6.1,12.63 6.64,12.44C7.18,12.25 7.77,12.54 7.96,13.08C8.36,14.22 9.38,15 10.58,15.13C11.95,15.06 13.17,14.25 13.77,13C14,11.62 15.11,11.5 16.33,11.5M18.33,18.97L17.71,17.67L17,17.83L18,19.08L18.33,18.97M13.68,10.36C13.7,9.83 13.3,9.38 12.77,9.33C12.06,9.29 11.37,9.53 10.84,10C10.27,10.58 9.97,11.38 10,12.19A1,1 0 0,0 11,13.19C11.57,13.19 12,12.74 12,12.19C12,11.92 12.07,11.65 12.23,11.43C12.35,11.33 12.5,11.28 12.66,11.28C13.21,11.31 13.68,10.9 13.68,10.36Z" />
            </svg>
        ),
        book_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19 2L14 6.5V17.5L19 13V2M6.5 5C4.55 5 2.45 5.4 1 6.5V21.16C1 21.41 1.25 21.66 1.5 21.66C1.6 21.66 1.65 21.59 1.75 21.59C3.1 20.94 5.05 20.5 6.5 20.5C8.45 20.5 10.55 20.9 12 22C13.35 21.15 15.8 20.5 17.5 20.5C19.15 20.5 20.85 20.81 22.25 21.56C22.35 21.61 22.4 21.59 22.5 21.59C22.75 21.59 23 21.34 23 21.09V6.5C22.4 6.05 21.75 5.75 21 5.5V19C19.9 18.65 18.7 18.5 17.5 18.5C15.8 18.5 13.35 19.15 12 20V6.5C10.55 5.4 8.45 5 6.5 5Z" />
            </svg>
        ),
        feather_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22,2C22,2 14.36,1.63 8.34,9.88C3.72,16.21 2,22 2,22L3.94,21C5.38,18.5 6.13,17.47 7.54,16C10.07,16.74 12.71,16.65 15,14C13,13.44 11.4,13.57 9.04,13.81C11.69,12 13.5,11.6 16,12L17,10C15.2,9.66 14,9.63 12.22,10.04C14.19,8.65 15.56,7.87 18,8L19.21,6.07C17.65,5.96 16.71,6.13 14.92,6.57C16.53,5.11 18,4.45 20.14,4.32C20.14,4.32 21.19,2.43 22,2Z" />
            </svg>
        ),
        claw_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M8.35,3C9.53,2.83 10.78,4.12 11.14,5.9C11.5,7.67 10.85,9.25 9.67,9.43C8.5,9.61 7.24,8.32 6.87,6.54C6.5,4.77 7.17,3.19 8.35,3M15.5,3C16.69,3.19 17.35,4.77 17,6.54C16.62,8.32 15.37,9.61 14.19,9.43C13,9.25 12.35,7.67 12.72,5.9C13.08,4.12 14.33,2.83 15.5,3M3,7.6C4.14,7.11 5.69,8 6.5,9.55C7.26,11.13 7,12.79 5.87,13.28C4.74,13.77 3.2,12.89 2.41,11.32C1.62,9.75 1.9,8.08 3,7.6M21,7.6C22.1,8.08 22.38,9.75 21.59,11.32C20.8,12.89 19.26,13.77 18.13,13.28C17,12.79 16.74,11.13 17.5,9.55C18.31,8 19.86,7.11 21,7.6M19.33,18.38C19.37,19.32 18.65,20.36 17.79,20.75C16,21.57 13.88,19.87 11.89,19.87C9.9,19.87 7.76,21.64 6,20.75C5,20.26 4.31,18.96 4.44,17.88C4.62,16.39 6.41,15.59 7.47,14.5C8.88,13.09 9.88,10.44 11.89,10.44C13.89,10.44 14.95,13.05 16.3,14.5C17.41,15.72 19.26,16.75 19.33,18.38Z" />
            </svg>
        ),
        // MDI Weapons
        bow_arrow: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19.03 6.03L20 7L22 2L17 4L17.97 4.97L16.15 6.79C10.87 2.16 3.3 3.94 2.97 4L2 4.26L2.5 6.2L3.29 6L10.12 12.82L6.94 16H5L2 19L4 20L5 22L8 19V17.06L11.18 13.88L18 20.71L17.81 21.5L19.74 22L20 21.03C20.06 20.7 21.84 13.13 17.21 7.85L19.03 6.03M4.5 5.78C6.55 5.5 11.28 5.28 14.73 8.21L10.82 12.12L4.5 5.78M18.22 19.5L11.88 13.18L15.79 9.27C18.72 12.72 18.5 17.45 18.22 19.5Z" />
            </svg>
        ),
        axe_battle: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M21.47 12.43C19.35 14.55 15.82 13.84 15.82 13.84V9.6L3.41 22L2 20.59L14.4 8.18H10.16C10.16 8.18 9.45 4.65 11.57 2.53C13.69 .406 17.23 1.11 17.23 1.11V5.36L17.94 4.65L19.35 6.06L18.64 6.77H22.89C22.89 6.77 23.59 10.31 21.47 12.43Z" />
            </svg>
        ),
        pickaxe: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M14.79,10.62L3.5,21.9L2.1,20.5L13.38,9.21L14.79,10.62M19.27,7.73L19.86,7.14L19.07,6.35L19.71,5.71L18.29,4.29L17.65,4.93L16.86,4.14L16.27,4.73C14.53,3.31 12.57,2.17 10.47,1.37L9.64,3.16C11.39,4.08 13,5.19 14.5,6.5L14,7L17,10L17.5,9.5C18.81,11 19.92,12.61 20.84,14.36L22.63,13.53C21.83,11.43 20.69,9.47 19.27,7.73Z" />
            </svg>
        ),
        fencing: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M4.5 17.42L5.58 18.5L3.28 20.78C3 21.07 2.5 21.07 2.22 20.78S1.93 20 2.22 19.72L4.5 17.42M18.29 5.42L18.29 4L12 10.29L5.71 4L5.71 5.42L11.29 11L7.5 14.81C6.32 13.97 4.68 14.07 3.63 15.12L7.88 19.37C8.93 18.32 9.03 16.68 8.2 15.5L18.29 5.42M21.78 19.72L19.5 17.42L18.42 18.5L20.72 20.78C21 21.07 21.5 21.07 21.78 20.78S22.07 20 21.78 19.72M16.5 14.81L13.42 11.71L12.71 12.42L15.81 15.5C14.97 16.68 15.07 18.32 16.12 19.37L20.37 15.12C19.32 14.07 17.68 13.97 16.5 14.81Z" />
            </svg>
        ),
        spear: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M16 9H16.41L3.41 22L2 20.59L15 7.59V9H16M16 4V8H20L22 2L16 4Z" />
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
        // MDI Magic & Death
        magic_staff: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M17.5 9C16.12 9 15 7.88 15 6.5S16.12 4 17.5 4 20 5.12 20 6.5 18.88 9 17.5 9M14.43 8.15L2 20.59L3.41 22L15.85 9.57C15.25 9.24 14.76 8.75 14.43 8.15M13 5L13.63 3.63L15 3L13.63 2.37L13 1L12.38 2.37L11 3L12.38 3.63L13 5M21 5L21.63 3.63L23 3L21.63 2.37L21 1L20.38 2.37L19 3L20.38 3.63L21 5M21 9L20.38 10.37L19 11L20.38 11.63L21 13L21.63 11.63L23 11L21.63 10.37L21 9Z" />
            </svg>
        ),
        wizard_hat_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M21 22H3V20H21V22M19 19H5L11.1 2.6C11.3 2.2 11.6 2 12 2L18 5H13.9L19 19M10 7.5L11.04 7.97L11.5 9L11.97 7.97L13 7.5L11.97 7.03L11.5 6L11.04 7.03L10 7.5M13 15L10.94 14.07L10 12L9.07 14.07L7 15L9.07 15.93L10 18L10.94 15.93L13 15M13.97 11.97L15 11.5L13.97 11.03L13.5 10L13.04 11.03L12 11.5L13.04 11.97L13.5 13L13.97 11.97M15.97 15.97L17 15.5L15.97 15.03L15.5 14L15.04 15.03L14 15.5L15.04 15.97L15.5 17L15.97 15.97Z" />
            </svg>
        ),
        bottle_tonic_skull: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19 13V22H5V13C5 10.24 7.24 8 10 8V6H9V5H15V6H14V8C16.76 8 19 10.24 19 13M13 4L14 2H10L11 4H13M12 11C9.79 11 8 12.79 8 15C8 16 8.39 16.9 9 17.59V19H10.25V17.5H11.38V19H12.63V17.5H13.75V19H15V17.59C15.61 16.9 16 16 16 15C16 12.79 14.21 11 12 11M10.5 15C9.95 15 9.5 14.55 9.5 14S9.95 13 10.5 13 11.5 13.45 11.5 14 11.05 15 10.5 15M11.25 16.25L12 15L12.75 16.25H11.25M13.5 15C12.95 15 12.5 14.55 12.5 14S12.95 13 13.5 13 14.5 13.45 14.5 14 14.05 15 13.5 15Z" />
            </svg>
        ),
        bottle_tonic_skull_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M13 4H11L10 2H14L13 4M14 8V6H15V5H9V6H10V8C7.24 8 5 10.24 5 13V22H19V13C19 10.24 16.76 8 14 8M17 20H7V13C7 11.35 8.35 10 10 10H14C15.65 10 17 11.35 17 13V20M12 11C9.79 11 8 12.79 8 15C8 16 8.39 16.9 9 17.59V19H10.25V17.5H11.38V19H12.63V17.5H13.75V19H15V17.59C15.61 16.9 16 16 16 15C16 12.79 14.21 11 12 11M10.5 15C9.95 15 9.5 14.55 9.5 14S9.95 13 10.5 13 11.5 13.45 11.5 14 11.05 15 10.5 15M11.25 16.25L12 15L12.75 16.25H11.25M13.5 15C12.95 15 12.5 14.55 12.5 14S12.95 13 13.5 13 14.5 13.45 14.5 14 14.05 15 13.5 15Z" />
            </svg>
        ),
        skull_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2A9,9 0 0,0 3,11C3,14.03 4.53,16.82 7,18.47V22H9V19H11V22H13V19H15V22H17V18.46C19.47,16.81 21,14 21,11A9,9 0 0,0 12,2M8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11M16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11M12,14L13.5,17H10.5L12,14Z" />
            </svg>
        ),
        skull_outline_mdi: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15M10.5,17L12,14L13.5,17H10.5M16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15M22,11A10,10 0 0,0 12,1A10,10 0 0,0 2,11C2,13.8 3.2,16.3 5,18.1V22H19V18.1C20.8,16.3 22,13.8 22,11M17,20H15V18H13V20H11V18H9V20H7V17.2C5.2,15.7 4,13.5 4,11A8,8 0 0,1 12,3A8,8 0 0,1 20,11C20,13.5 18.8,15.8 17,17.2V20Z" />
            </svg>
        ),
        skull_crossbones: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M15.8,18.5L21.8,20.1L21.4,22L12,19.5L2.6,22L2.1,20.1L8.1,18.5L2,16.9L2.5,15L11.9,17.5L21.3,15L21.8,16.9L15.8,18.5M18,8C18,9.8 17.2,11.3 16,12.4V15H14V13.7L14,13H13V15H11V13H10V13.7L10,15H8V12.4C6.8,11.3 6,9.8 6,8A6,6 0 0,1 12,2A6,6 0 0,1 18,8M11,7.5C11,6.7 10.3,6 9.5,6C8.7,6 8,6.7 8,7.5C8,8.3 8.7,9 9.5,9C10.3,9 11,8.3 11,7.5M13,11L12,9L11,11H13M16,7.5C16,6.7 15.3,6 14.5,6C13.7,6 13,6.7 13,7.5C13,8.3 13.7,9 14.5,9C15.3,9 16,8.3 16,7.5Z" />
            </svg>
        ),
        skull_crossbones_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M15.8,18.5L21.8,20.1L21.4,22L12,19.5L2.6,22L2.1,20.1L8.1,18.5L2,16.9L2.5,15L11.9,17.5L21.3,15L21.8,16.9L15.8,18.5M9.5,6C8.7,6 8,6.7 8,7.5C8,8.3 8.7,9 9.5,9C10.3,9 11,8.3 11,7.5C11,6.7 10.3,6 9.5,6M14.5,6C13.7,6 13,6.7 13,7.5C13,8.3 13.7,9 14.5,9C15.3,9 16,8.3 16,7.5C16,6.7 15.3,6 14.5,6M13,11L12,9L11,11H13M12,1C8.1,1 5,4.1 5,8C5,9.9 5.8,11.6 7,12.9V16H17V12.9C18.2,11.6 19,9.9 19,8C19,4.1 15.9,1 12,1M15,12V14H14V12H13V14H11V12H10V14H9V12H9C7.8,11.1 7,9.7 7,8C7,5.2 9.2,3 12,3C14.8,3 17,5.2 17,8C17,9.6 16.2,11.1 15,12Z" />
            </svg>
        ),
        // MDI Weather
        weather_hail: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6,14A1,1 0 0,1 7,15A1,1 0 0,1 6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14M10,18A2,2 0 0,1 12,20A2,2 0 0,1 10,22A2,2 0 0,1 8,20A2,2 0 0,1 10,18M14.5,16A1.5,1.5 0 0,1 16,17.5A1.5,1.5 0 0,1 14.5,19A1.5,1.5 0 0,1 13,17.5A1.5,1.5 0 0,1 14.5,16M10.5,12A1.5,1.5 0 0,1 12,13.5A1.5,1.5 0 0,1 10.5,15A1.5,1.5 0 0,1 9,13.5A1.5,1.5 0 0,1 10.5,12Z" />
            </svg>
        ),
        weather_hazy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64M14,15A1,1 0 0,0 13,14H3A1,1 0 0,0 2,15A1,1 0 0,0 3,16H13A1,1 0 0,0 14,15M22,15A1,1 0 0,0 21,14H17A1,1 0 0,0 16,15A1,1 0 0,0 17,16H21A1,1 0 0,0 22,15M10,19A1,1 0 0,0 11,20H20A1,1 0 0,0 21,19A1,1 0 0,0 20,18H11A1,1 0 0,0 10,19M3,19A1,1 0 0,0 4,20H7A1,1 0 0,0 8,19A1,1 0 0,0 7,18H4A1,1 0 0,0 3,19M12,9A3,3 0 0,1 15,12H17A5,5 0 0,0 12,7A5,5 0 0,0 7,12H9A3,3 0 0,1 12,9Z" />
            </svg>
        ),
        weather_lightning: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14H7A1,1 0 0,1 8,15A1,1 0 0,1 7,16H6M12,11H15L13,15H15L11.25,22L12,17H9.5L12,11Z" />
            </svg>
        ),
        weather_lightning_rainy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M4.5,13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.44 4,15.6 3.5,15.33V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16A1,1 0 0,1 18,15A1,1 0 0,1 19,14A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59M9.5,11H12.5L10.5,15H12.5L8.75,22L9.5,17H7L9.5,11M17.5,18.67C17.5,19.96 16.5,21 15.25,21C14,21 13,19.96 13,18.67C13,17.12 15.25,14.5 15.25,14.5C15.25,14.5 17.5,17.12 17.5,18.67Z" />
            </svg>
        ),
        weather_pouring: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z" />
            </svg>
        ),
        weather_cloudy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z" />
            </svg>
        ),
        weather_rainy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6,14.03A1,1 0 0,1 7,15.03C7,15.58 6.55,16.03 6,16.03C3.24,16.03 1,13.79 1,11.03C1,8.27 3.24,6.03 6,6.03C7,3.68 9.3,2.03 12,2.03C15.43,2.03 18.24,4.69 18.5,8.06L19,8.03A4,4 0 0,1 23,12.03C23,14.23 21.21,16.03 19,16.03H18C17.45,16.03 17,15.58 17,15.03C17,14.47 17.45,14.03 18,14.03H19A2,2 0 0,0 21,12.03A2,2 0 0,0 19,10.03H17V9.03C17,6.27 14.76,4.03 12,4.03C9.5,4.03 7.45,5.84 7.06,8.21C6.73,8.09 6.37,8.03 6,8.03A3,3 0 0,0 3,11.03A3,3 0 0,0 6,14.03M12,14.15C12.18,14.39 12.37,14.66 12.56,14.94C13,15.56 14,17.03 14,18C14,19.11 13.1,20 12,20A2,2 0 0,1 10,18C10,17.03 11,15.56 11.44,14.94C11.63,14.66 11.82,14.4 12,14.15M12,11.03L11.5,11.59C11.5,11.59 10.65,12.55 9.79,13.81C8.93,15.06 8,16.56 8,18A4,4 0 0,0 12,22A4,4 0 0,0 16,18C16,16.56 15.07,15.06 14.21,13.81C13.35,12.55 12.5,11.59 12.5,11.59" />
            </svg>
        ),
        weather_snowy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M6,14A1,1 0 0,1 7,15A1,1 0 0,1 6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14M7.88,18.07L10.07,17.5L8.46,15.88C8.07,15.5 8.07,14.86 8.46,14.46C8.85,14.07 9.5,14.07 9.88,14.46L11.5,16.07L12.07,13.88C12.21,13.34 12.76,13.03 13.29,13.17C13.83,13.31 14.14,13.86 14,14.4L13.41,16.59L15.6,16C16.14,15.86 16.69,16.17 16.83,16.71C16.97,17.24 16.66,17.79 16.12,17.93L13.93,18.5L15.54,20.12C15.93,20.5 15.93,21.15 15.54,21.54C15.15,21.93 14.5,21.93 14.12,21.54L12.5,19.93L11.93,22.12C11.79,22.66 11.24,22.97 10.71,22.83C10.17,22.69 9.86,22.14 10,21.6L10.59,19.41L8.4,20C7.86,20.14 7.31,19.83 7.17,19.29C7.03,18.76 7.34,18.21 7.88,18.07Z" />
            </svg>
        ),
        weather_snowy_heavy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M4,16.36C3.86,15.82 4.18,15.25 4.73,15.11L7,14.5L5.33,12.86C4.93,12.46 4.93,11.81 5.33,11.4C5.73,11 6.4,11 6.79,11.4L8.45,13.05L9.04,10.8C9.18,10.24 9.75,9.92 10.29,10.07C10.85,10.21 11.17,10.78 11,11.33L10.42,13.58L12.67,13C13.22,12.83 13.79,13.15 13.93,13.71C14.08,14.25 13.76,14.82 13.2,14.96L10.95,15.55L12.6,17.21C13,17.6 13,18.27 12.6,18.67C12.2,19.07 11.54,19.07 11.15,18.67L9.5,17L8.89,19.27C8.75,19.83 8.18,20.14 7.64,20C7.08,19.86 6.77,19.29 6.91,18.74L7.5,16.5L5.26,17.09C4.71,17.23 4.14,16.92 4,16.36M1,10A5,5 0 0,1 6,5C7,2.65 9.3,1 12,1C15.43,1 18.24,3.66 18.5,7.03L19,7A4,4 0 0,1 23,11A4,4 0 0,1 19,15A1,1 0 0,1 18,14A1,1 0 0,1 19,13A2,2 0 0,0 21,11A2,2 0 0,0 19,9H17V8A5,5 0 0,0 12,3C9.5,3 7.45,4.82 7.06,7.19C6.73,7.07 6.37,7 6,7A3,3 0 0,0 3,10C3,10.85 3.35,11.61 3.91,12.16C4.27,12.55 4.26,13.16 3.88,13.54C3.5,13.93 2.85,13.93 2.47,13.54C1.56,12.63 1,11.38 1,10M14.03,20.43C14.13,20.82 14.5,21.04 14.91,20.94L16.5,20.5L16.06,22.09C15.96,22.5 16.18,22.87 16.57,22.97C16.95,23.08 17.35,22.85 17.45,22.46L17.86,20.89L19.03,22.05C19.3,22.33 19.77,22.33 20.05,22.05C20.33,21.77 20.33,21.3 20.05,21.03L18.89,19.86L20.46,19.45C20.85,19.35 21.08,18.95 20.97,18.57C20.87,18.18 20.5,17.96 20.09,18.06L18.5,18.5L18.94,16.91C19.04,16.5 18.82,16.13 18.43,16.03C18.05,15.92 17.65,16.15 17.55,16.54L17.14,18.11L15.97,16.95C15.7,16.67 15.23,16.67 14.95,16.95C14.67,17.24 14.67,17.7 14.95,17.97L16.11,19.14L14.54,19.55C14.15,19.65 13.92,20.05 14.03,20.43Z" />
            </svg>
        ),
        weather_snowy_rainy: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M18.5,18.67C18.5,19.96 17.5,21 16.25,21C15,21 14,19.96 14,18.67C14,17.12 16.25,14.5 16.25,14.5C16.25,14.5 18.5,17.12 18.5,18.67M4,17.36C3.86,16.82 4.18,16.25 4.73,16.11L7,15.5L5.33,13.86C4.93,13.46 4.93,12.81 5.33,12.4C5.73,12 6.4,12 6.79,12.4L8.45,14.05L9.04,11.8C9.18,11.24 9.75,10.92 10.29,11.07C10.85,11.21 11.17,11.78 11,12.33L10.42,14.58L12.67,14C13.22,13.83 13.79,14.15 13.93,14.71C14.08,15.25 13.76,15.82 13.2,15.96L10.95,16.55L12.6,18.21C13,18.6 13,19.27 12.6,19.67C12.2,20.07 11.54,20.07 11.15,19.67L9.5,18L8.89,20.27C8.75,20.83 8.18,21.14 7.64,21C7.08,20.86 6.77,20.29 6.91,19.74L7.5,17.5L5.26,18.09C4.71,18.23 4.14,17.92 4,17.36M1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16A1,1 0 0,1 18,15A1,1 0 0,1 19,14A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,11.85 3.35,12.61 3.91,13.16C4.27,13.55 4.26,14.16 3.88,14.54C3.5,14.93 2.85,14.93 2.47,14.54C1.56,13.63 1,12.38 1,11Z" />
            </svg>
        ),
        weather_sunny: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z" />
            </svg>
        ),
        weather_fog: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M3,15H13A1,1 0 0,1 14,16A1,1 0 0,1 13,17H3A1,1 0 0,1 2,16A1,1 0 0,1 3,15M16,15H21A1,1 0 0,1 22,16A1,1 0 0,1 21,17H16A1,1 0 0,1 15,16A1,1 0 0,1 16,15M1,12A5,5 0 0,1 6,7C7,4.65 9.3,3 12,3C15.43,3 18.24,5.66 18.5,9.03L19,9C21.19,9 22.97,10.76 23,13H21A2,2 0 0,0 19,11H17V10A5,5 0 0,0 12,5C9.5,5 7.45,6.82 7.06,9.19C6.73,9.07 6.37,9 6,9A3,3 0 0,0 3,12C3,12.35 3.06,12.69 3.17,13H1.1L1,12M3,19H5A1,1 0 0,1 6,20A1,1 0 0,1 5,21H3A1,1 0 0,1 2,20A1,1 0 0,1 3,19M8,19H21A1,1 0 0,1 22,20A1,1 0 0,1 21,21H8A1,1 0 0,1 7,20A1,1 0 0,1 8,19Z" />
            </svg>
        ),
        // MDI Nature
        tree: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M11,21V16.74C10.53,16.91 10.03,17 9.5,17C7,17 5,15 5,12.5C5,11.23 5.5,10.09 6.36,9.27C6.13,8.73 6,8.13 6,7.5C6,5 8,3 10.5,3C12.06,3 13.44,3.8 14.25,5C14.33,5 14.41,5 14.5,5A5.5,5.5 0 0,1 20,10.5A5.5,5.5 0 0,1 14.5,16C14,16 13.5,15.93 13,15.79V21H11Z" />
            </svg>
        ),
        flower: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M3,13A9,9 0 0,0 12,22C12,17 7.97,13 3,13M12,5.5A2.5,2.5 0 0,1 14.5,8A2.5,2.5 0 0,1 12,10.5A2.5,2.5 0 0,1 9.5,8A2.5,2.5 0 0,1 12,5.5M5.6,10.25A2.5,2.5 0 0,0 8.1,12.75C8.63,12.75 9.12,12.58 9.5,12.31C9.5,12.37 9.5,12.43 9.5,12.5A2.5,2.5 0 0,0 12,15A2.5,2.5 0 0,0 14.5,12.5C14.5,12.43 14.5,12.37 14.5,12.31C14.88,12.58 15.37,12.75 15.9,12.75C17.28,12.75 18.4,11.63 18.4,10.25C18.4,9.25 17.81,8.4 16.97,8C17.81,7.6 18.4,6.74 18.4,5.75C18.4,4.37 17.28,3.25 15.9,3.25C15.37,3.25 14.88,3.41 14.5,3.69C14.5,3.63 14.5,3.56 14.5,3.5A2.5,2.5 0 0,0 12,1A2.5,2.5 0 0,0 9.5,3.5C9.5,3.56 9.5,3.63 9.5,3.69C9.12,3.41 8.63,3.25 8.1,3.25A2.5,2.5 0 0,0 5.6,5.75C5.6,6.74 6.19,7.6 7.03,8C6.19,8.4 5.6,9.25 5.6,10.25M12,22A9,9 0 0,0 21,13C16,13 12,17 12,22Z" />
            </svg>
        ),
        flower_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M8.66,13.07C6.92,13.07 5.5,11.66 5.5,9.93C5.5,9.22 5.76,8.54 6.19,8C5.77,7.46 5.5,6.78 5.5,6.07C5.5,4.34 6.93,2.93 8.66,2.93L9.09,2.96C9.56,1.81 10.69,1 12,1C13.31,1 14.44,1.81 14.91,2.96L15.34,2.93C17.07,2.93 18.5,4.34 18.5,6.07C18.5,6.78 18.24,7.46 17.81,8C18.23,8.54 18.5,9.22 18.5,9.93C18.5,11.66 17.07,13.07 15.34,13.07C14.88,13.07 14.45,12.96 14.06,12.77C13.43,14.65 13.91,17.27 15.63,18.91C16.92,18.06 18.66,18.17 19.82,19.33C21.12,20.63 21.12,22.74 19.82,24.04C18.5,25.32 16.41,25.32 15.11,24.04C13.95,22.88 13.84,21.14 14.69,19.85C11.96,18.63 11.23,14.73 11.23,12.5C11.23,14.73 10.5,18.63 7.77,19.85C8.62,21.14 8.5,22.88 7.35,24.04C6.05,25.32 3.96,25.32 2.64,24.04C1.34,22.74 1.34,20.63 2.64,19.33C3.8,18.17 5.54,18.06 6.83,18.91C8.55,17.27 9.03,14.65 8.4,12.77C8,12.96 7.58,13.07 7.12,13.07H8.66M12,2.5C11.17,2.5 10.5,3.17 10.5,4C10.5,4.83 11.17,5.5 12,5.5C12.83,5.5 13.5,4.83 13.5,4C13.5,3.17 12.83,2.5 12,2.5M8.66,4.43C7.76,4.43 7,5.16 7,6.07C7,6.97 7.76,7.71 8.66,7.71C9.56,7.71 10.32,6.97 10.32,6.07C10.32,5.16 9.56,4.43 8.66,4.43M15.34,4.43C14.44,4.43 13.68,5.16 13.68,6.07C13.68,6.97 14.44,7.71 15.34,7.71C16.24,7.71 16.97,6.97 16.97,6.07C16.97,5.16 16.24,4.43 15.34,4.43M5.09,21.59C5.09,20.24 6.19,19.14 7.54,19.14C8.89,19.14 9.99,20.24 9.99,21.59C9.99,22.94 8.89,24.04 7.54,24.04C6.19,24.04 5.09,22.94 5.09,21.59M12.47,21.59C12.47,20.24 13.57,19.14 14.92,19.14C16.27,19.14 17.37,20.24 17.37,21.59C17.37,22.94 16.27,24.04 14.92,24.04C13.57,24.04 12.47,22.94 12.47,21.59M8.66,9.5C7.76,9.5 7,10.23 7,11.14C7,12.05 7.76,12.79 8.66,12.79C9.56,12.79 10.29,12.05 10.29,11.14C10.29,10.23 9.56,9.5 8.66,9.5M15.34,9.5C14.44,9.5 13.71,10.23 13.71,11.14C13.71,12.05 14.44,12.79 15.34,12.79C16.24,12.79 16.97,12.05 16.97,11.14C16.97,10.23 16.24,9.5 15.34,9.5Z" />
            </svg>
        ),
        // MDI Dice
        dice_d4: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M10.25 15.15L11.92 12.47V15.15H10.25M21.92 21H2.08C1.24 21 .72 20.08 1.16 19.36L11.08 3.13C11.5 2.44 12.5 2.44 12.92 3.13L22.84 19.36C23.28 20.08 22.76 21 21.92 21M14.29 15.15H13.43V10.42H11.91L8.75 15.41L8.82 16.36H11.92V18H13.43V16.36H14.29V15.15Z" />
            </svg>
        ),
        dice_d4_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M13.43,15.15H14.29V16.36H13.43V18H11.92V16.36H8.82L8.75,15.41L11.91,10.42H13.43V15.15M10.25,15.15H11.92V12.47L10.25,15.15M22,21H2C1.64,21 1.31,20.81 1.13,20.5C0.95,20.18 0.96,19.79 1.15,19.5L11.15,3C11.5,2.38 12.5,2.38 12.86,3L22.86,19.5C23.04,19.79 23.05,20.18 22.87,20.5C22.69,20.81 22.36,21 22,21M3.78,19H20.23L12,5.43L3.78,19Z" />
            </svg>
        ),
        dice_d6: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M13.05 13.5C13.05 14.27 12.61 14.83 12 14.83S10.85 14.27 10.85 13.5L10.83 12.78C10.83 12.78 11.21 12 11.95 12.1C12.56 12.1 13.05 12.73 13.05 13.5M21 5V19C21 20.11 20.11 21 19 21H5C3.9 21 3 20.11 3 19V5C3 3.9 3.9 3 5 3H19C20.11 3 21 3.9 21 5M14.55 13.41C14.5 11.45 13.19 10.87 12.53 10.87C11.41 10.87 10.86 11.53 10.86 11.53S10.89 9.5 13.39 9.53V8.33C13.39 8.33 9.33 7.94 9.3 12.66C9.27 16.86 12.77 16 12.77 16S14.61 15.47 14.55 13.41Z" />
            </svg>
        ),
        dice_d6_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M5,5V19H19V5H5M13.39,9.53C10.89,9.5 10.86,11.53 10.86,11.53C10.86,11.53 11.41,10.87 12.53,10.87C13.19,10.87 14.5,11.45 14.55,13.41C14.61,15.47 12.77,16 12.77,16C12.77,16 9.27,16.86 9.3,12.66C9.33,7.94 13.39,8.33 13.39,8.33V9.53M11.95,12.1C11.21,12 10.83,12.78 10.83,12.78L10.85,13.5C10.85,14.27 11.39,14.83 12,14.83C12.61,14.83 13.05,14.27 13.05,13.5C13.05,12.73 12.56,12.1 11.95,12.1Z" />
            </svg>
        ),
        dice_d8: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41L10.59 21.41C11.37 22.2 12.63 22.2 13.41 21.41L21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2M12 8.25C13.31 8.25 14.38 9.2 14.38 10.38C14.38 11.07 14 11.68 13.44 12.07C14.14 12.46 14.6 13.13 14.6 13.9C14.6 15.12 13.44 16.1 12 16.1C10.56 16.1 9.4 15.12 9.4 13.9C9.4 13.13 9.86 12.46 10.56 12.07C10 11.68 9.63 11.07 9.63 10.38C9.63 9.2 10.69 8.25 12 8.25M12 9.5C11.5 9.5 11.1 9.95 11.1 10.5C11.1 11.05 11.5 11.5 12 11.5C12.5 11.5 12.9 11.05 12.9 10.5C12.9 9.95 12.5 9.5 12 9.5M12 12.65C11.39 12.65 10.9 13.14 10.9 13.75C10.9 14.36 11.39 14.85 12 14.85C12.61 14.85 13.1 14.36 13.1 13.75C13.1 13.14 12.61 12.65 12 12.65Z" />
            </svg>
        ),
        dice_d8_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41L10.59 21.41C11.37 22.2 12.63 22.2 13.41 21.41L21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2M12 4L20 12L12 20L4 12M12 8.25C13.31 8.25 14.38 9.2 14.38 10.38C14.38 11.07 14 11.68 13.44 12.07C14.14 12.46 14.6 13.13 14.6 13.9C14.6 15.12 13.44 16.1 12 16.1C10.56 16.1 9.4 15.12 9.4 13.9C9.4 13.13 9.86 12.46 10.56 12.07C10 11.68 9.63 11.07 9.63 10.38C9.63 9.2 10.69 8.25 12 8.25M12 12.65C11.39 12.65 10.9 13.14 10.9 13.75C10.9 14.36 11.39 14.85 12 14.85C12.61 14.85 13.1 14.36 13.1 13.75C13.1 13.14 12.61 12.65 12 12.65M12 9.5C11.5 9.5 11.1 9.95 11.1 10.5C11.1 11.05 11.5 11.5 12 11.5C12.5 11.5 12.9 11.05 12.9 10.5C12.9 9.95 12.5 9.5 12 9.5" />
            </svg>
        ),
        dice_d10: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41L10.59 21.41C11.37 22.2 12.63 22.2 13.41 21.41L21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2M14.07 8.21C15.5 8.21 16.64 9.36 16.64 10.78V13.42C16.64 14.84 15.5 16 14.07 16C12.64 16 11.5 14.84 11.5 13.42V10.78C11.5 9.36 12.65 8.21 14.07 8.21M10.36 8.41H10.5V16H9V10.21L7.22 10.76V9.53L10.36 8.41M14.06 9.65C13.47 9.65 13 10.13 13 10.71V13.5C13 14.07 13.47 14.54 14.06 14.54C14.64 14.54 15.14 14.06 15.14 13.5V10.71C15.14 10.12 14.64 9.65 14.06 9.65Z" />
            </svg>
        ),
        dice_d10_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M10.5 16H9V10.21L7.22 10.76V9.53L10.36 8.41H10.5V16M14.07 8.21C15.5 8.21 16.64 9.36 16.64 10.78V13.42C16.64 14.84 15.5 16 14.07 16C12.64 16 11.5 14.84 11.5 13.42V10.78C11.5 9.36 12.65 8.21 14.07 8.21M14.06 9.65C13.47 9.65 13 10.13 13 10.71V13.5C13 14.07 13.47 14.54 14.06 14.54C14.64 14.54 15.14 14.06 15.14 13.5V10.71C15.14 10.12 14.64 9.65 14.06 9.65M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41L10.59 21.41C11.37 22.2 12.63 22.2 13.41 21.41L21.41 13.41C22.2 12.63 22.2 11.37 21.41 10.59L13.41 2.59C13 2.19 12.5 2 12 2M12 4L20 12L12 20L4 12Z" />
            </svg>
        ),
        dice_d12: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12 2L1.5 9.64L5.5 22H18.5L22.5 9.64L12 2M10.5 17H8.89V10.89L7 11.47V10.19L10.31 9H10.5V17M17 17H11.66V15.91C11.66 15.91 15.23 12.45 15.23 11.4C15.23 10.12 14.18 10.25 14.18 10.25C13.5 10.3 13 10.87 13 11.55H11.44C11.5 10.09 12.72 8.94 14.27 9C16.74 9 16.77 10.85 16.77 11.3C16.77 13.07 13.58 15.77 13.58 15.77L17 15.75V17Z" />
            </svg>
        ),
        dice_d12_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2L1.5,9.64L5.5,22H18.5L22.5,9.64L12,2M17,20H7L3.85,10.4L12,4.47L20.15,10.4L17,20M17,15.75V17H11.66V15.91C11.66,15.91 15.23,12.45 15.23,11.4C15.23,10.12 14.18,10.25 14.18,10.25C13.5,10.3 13,10.87 13,11.55H11.44C11.5,10.09 12.72,8.94 14.27,9C16.74,9 16.77,10.85 16.77,11.3C16.77,13.07 13.58,15.77 13.58,15.77L17,15.75M10.5,17H8.89V10.89L7,11.47V10.19L10.31,9H10.5V17Z" />
            </svg>
        ),
        dice_d20: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62M11.45 15.96L6.31 15.93V14.91C6.31 14.91 9.74 11.58 9.75 10.57C9.75 9.33 8.73 9.46 8.73 9.46S7.75 9.5 7.64 10.71L6.14 10.76C6.14 10.76 6.18 8.26 8.83 8.26C11.2 8.26 11.23 10.04 11.23 10.5C11.23 12.18 8.15 14.77 8.15 14.77L11.45 14.76V15.96M17.5 13.5C17.5 14.9 16.35 16.05 14.93 16.05C13.5 16.05 12.36 14.9 12.36 13.5V10.84C12.36 9.42 13.5 8.27 14.93 8.27S17.5 9.42 17.5 10.84V13.5M16 10.77V13.53C16 14.12 15.5 14.6 14.92 14.6C14.34 14.6 13.86 14.12 13.86 13.53V10.77C13.86 10.18 14.34 9.71 14.92 9.71C15.5 9.71 16 10.18 16 10.77Z" />
            </svg>
        ),
        // MDI Animals/Creatures
        horse: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22 6V9.5L20.5 10L18.96 7.54C18.83 7.33 18.5 7.42 18.5 7.67V11.25C18.5 12.23 18.11 13.11 17.5 13.78V21H15V15C14.92 15 14.84 15 14.75 15C14.54 15 14.33 14.97 14.13 14.94L9.69 14.2L8.57 16.21L9.53 21H7L6 16.25C5.97 15.95 6 15.65 6.16 15.39L7.18 13.58C6.2 13.03 5.53 12 5.5 10.81C5.46 10.96 5.44 11.18 5.47 11.5C5.5 11.94 5.61 12.59 5.54 13.31C5.5 14.03 5.17 14.77 4.75 15.26C4.32 15.75 3.85 16.09 3.35 16.35L2.65 15.65C2.84 15.18 3.03 14.76 3.07 14.37C3.13 14 3.06 13.7 2.95 13.43L2.42 12.3C2.21 11.79 1.95 11.05 2 10.18C2.03 9.33 2.5 8.22 3.39 7.61C4.29 7 5.26 6.92 6.05 7.08C6.55 7.18 7.06 7.42 7.5 7.76C7.87 7.59 8.3 7.5 8.75 7.5H14.5V7C14.5 4.79 16.29 3 18.5 3H22L21.11 4.34C21.65 4.7 22 5.31 22 6Z" />
            </svg>
        ),
        horse_variant: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M20 8V16L17 17L13.91 11.5C13.65 11.04 12.92 11.27 13 11.81L14 21L4 17L5.15 8.94C5.64 5.53 8.56 3 12 3H20L18.42 5.37C19.36 5.88 20 6.86 20 8Z" />
            </svg>
        ),
        horse_variant_fast: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M23 8V16L20 17L16.91 11.5C16.65 11.04 15.92 11.27 16 11.81L17 21L7 17L8.15 8.94C8.64 5.53 11.56 3 15 3H23L21.42 5.37C22.36 5.88 23 6.86 23 8M4 5H7.58C8.08 4.24 8.7 3.57 9.41 3H4C3.45 3 3 3.45 3 4S3.45 5 4 5M5.84 11H2C1.45 11 1 11.45 1 12S1.45 13 2 13H5.55L5.84 11M3 9H6.12L6.17 8.66C6.25 8.08 6.39 7.53 6.58 7H3C2.45 7 2 7.45 2 8S2.45 9 3 9Z" />
            </svg>
        ),
        fish: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,20L12.76,17C9.5,16.79 6.59,15.4 5.75,13.58C5.66,14.06 5.53,14.5 5.33,14.83C4.67,16 3.33,16 2,16C3.1,16 3.5,14.43 3.5,12.5C3.5,10.57 3.1,9 2,9C3.33,9 4.67,9 5.33,10.17C5.53,10.5 5.66,10.94 5.75,11.42C6.4,10 8.32,8.85 10.66,8.32L9,5C11,5 13,5 14.33,5.67C15.46,6.23 16.11,7.27 16.69,8.38C19.61,9.08 22,10.66 22,12.5C22,14.38 19.5,16 16.5,16.66C15.67,17.76 14.86,18.78 14.17,19.33C13.33,20 12.67,20 12,20M17,11A1,1 0 0,0 16,12A1,1 0 0,0 17,13A1,1 0 0,0 18,12A1,1 0 0,0 17,11Z" />
            </svg>
        ),
        paw: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M8.35,3C9.53,2.83 10.78,4.12 11.14,5.9C11.5,7.67 10.85,9.25 9.67,9.43C8.5,9.61 7.24,8.32 6.87,6.54C6.5,4.77 7.17,3.19 8.35,3M15.5,3C16.69,3.19 17.35,4.77 17,6.54C16.62,8.32 15.37,9.61 14.19,9.43C13,9.25 12.35,7.67 12.72,5.9C13.08,4.12 14.33,2.83 15.5,3M3,7.6C4.14,7.11 5.69,8 6.5,9.55C7.26,11.13 7,12.79 5.87,13.28C4.74,13.77 3.2,12.89 2.41,11.32C1.62,9.75 1.9,8.08 3,7.6M21,7.6C22.1,8.08 22.38,9.75 21.59,11.32C20.8,12.89 19.26,13.77 18.13,13.28C17,12.79 16.74,11.13 17.5,9.55C18.31,8 19.86,7.11 21,7.6M19.33,18.38C19.37,19.32 18.65,20.36 17.79,20.75C16,21.57 13.88,19.87 11.89,19.87C9.9,19.87 7.76,21.64 6,20.75C5,20.26 4.31,18.96 4.44,17.88C4.62,16.39 6.41,15.59 7.47,14.5C8.88,13.09 9.88,10.44 11.89,10.44C13.89,10.44 14.95,13.05 16.3,14.5C17.41,15.72 19.26,16.75 19.33,18.38Z" />
            </svg>
        ),
        paw_off: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M2,4.27L3.28,3L21.5,21.22L20.23,22.5L18.23,20.5C18.09,20.6 17.94,20.68 17.79,20.75C16,21.57 13.88,19.87 11.89,19.87C9.9,19.87 7.76,21.64 6,20.75C5,20.26 4.31,18.96 4.44,17.88C4.62,16.39 6.41,15.59 7.47,14.5C8.21,13.77 8.84,12.69 9.55,11.82L2,4.27M8.35,3C9.53,2.83 10.78,4.12 11.14,5.9C11.32,6.75 11.26,7.56 11,8.19L7.03,4.2C7.29,3.55 7.75,3.1 8.35,3M15.5,3C16.69,3.19 17.35,4.77 17,6.54C16.62,8.32 15.37,9.61 14.19,9.43C13,9.25 12.35,7.67 12.72,5.9C13.08,4.12 14.33,2.83 15.5,3M3,7.6C4.14,7.11 5.69,8 6.5,9.55C7.26,11.13 7,12.79 5.87,13.28C4.74,13.77 3.2,12.89 2.41,11.32C1.62,9.75 1.9,8.08 3,7.6M21,7.6C22.1,8.08 22.38,9.75 21.59,11.32C20.8,12.89 19.26,13.77 18.13,13.28C17,12.79 16.74,11.13 17.5,9.55C18.31,8 19.86,7.11 21,7.6Z" />
            </svg>
        ),
        paw_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22.83 8.25C22.56 7.5 22.05 6.96 21.4 6.68C20.23 6.18 18.81 6.6 17.7 7.66C17.81 7.37 17.91 7.06 18 6.73C18.25 5.38 18.03 4.03 17.38 3.12C16.95 2.5 16.33 2.11 15.64 2C14.1 1.78 12.57 3.08 11.93 5C11.29 3.05 9.74 1.76 8.19 2C7.5 2.12 6.88 2.53 6.45 3.16C5.81 4.09 5.61 5.39 5.89 6.74C5.94 7 6 7.24 6.09 7.47C5 6.56 3.7 6.2 2.6 6.68C1.94 6.97 1.44 7.53 1.17 8.27C.794 9.31 .92 10.58 1.5 11.77C2.34 13.4 3.82 14.41 5.21 14.41C5.57 14.41 5.93 14.34 6.27 14.2C6.93 13.91 7.44 13.35 7.71 12.63C8.03 11.79 8 10.77 7.64 9.76C8.19 10.19 8.81 10.45 9.45 10.45C9.57 10.45 9.7 10.44 9.82 10.42C10.5 10.32 11.12 9.92 11.55 9.3C11.7 9.08 11.83 8.84 11.93 8.58C12.03 8.84 12.15 9.08 12.3 9.29C12.73 9.91 13.35 10.31 14.04 10.42C14.16 10.44 14.29 10.45 14.41 10.45C15.13 10.45 15.83 10.12 16.43 9.57C16 10.64 15.96 11.73 16.29 12.63C16.56 13.36 17.07 13.91 17.73 14.2C18.07 14.34 18.43 14.41 18.8 14.41C20.18 14.41 21.66 13.4 22.5 11.77C23.08 10.58 23.21 9.3 22.83 8.25M5.84 11.93C5.72 12.26 5.53 12.34 5.47 12.36C4.92 12.6 3.88 12 3.3 10.87C2.9 10.06 2.91 9.35 3.05 8.94C3.13 8.73 3.25 8.58 3.4 8.5C3.5 8.5 3.58 8.46 3.68 8.46C4.26 8.46 5.1 9.03 5.6 10C5.93 10.68 6.03 11.43 5.84 11.93M9.91 8.16C9.79 8.32 9.66 8.42 9.5 8.44C9 8.5 8.14 7.73 7.85 6.34C7.65 5.38 7.85 4.66 8.1 4.29C8.22 4.12 8.36 4 8.5 4C9 3.91 9.88 4.69 10.16 6.1C10.36 7.07 10.16 7.8 9.91 8.16M16 6.33C15.72 7.73 14.83 8.5 14.34 8.44C14.28 8.43 14.12 8.41 13.94 8.15C13.69 7.79 13.5 7.07 13.7 6.1C13.97 4.76 14.8 4 15.29 4C15.32 4 15.34 4 15.36 4C15.5 4 15.63 4.11 15.75 4.27C16.07 4.73 16.18 5.54 16 6.33M20.7 10.87C20.12 12 19.08 12.6 18.53 12.36C18.47 12.34 18.28 12.26 18.16 11.93C18 11.43 18.07 10.68 18.39 10C18.9 9.04 19.75 8.47 20.33 8.47C20.43 8.47 20.5 8.5 20.6 8.5H20.61C20.76 8.58 20.87 8.72 20.95 8.94C21.1 9.34 21.11 10.06 20.7 10.87M16.3 14.5C14.95 13.05 13.89 10.44 11.89 10.44C9.88 10.44 8.88 13.09 7.47 14.5C6.41 15.59 4.62 16.39 4.44 17.88C4.31 18.96 5 20.26 6 20.75C6.35 20.93 6.72 21 7.1 21C8.61 21 10.3 19.87 11.89 19.87C13.5 19.87 15.18 20.97 16.71 20.97C17.08 20.97 17.44 20.91 17.79 20.75C18.65 20.36 19.37 19.32 19.33 18.38C19.26 16.75 17.41 15.72 16.3 14.5M16.96 18.93C16.92 18.95 16.85 18.97 16.71 18.97C16.29 18.97 15.63 18.75 15 18.54C14.08 18.23 13.03 17.87 11.89 17.87C10.75 17.87 9.7 18.24 8.78 18.56C8.15 18.77 7.5 19 7.1 19C6.97 19 6.92 19 6.88 18.95C6.66 18.84 6.4 18.37 6.43 18.12C6.5 17.89 7.23 17.31 7.59 17C8.03 16.68 8.5 16.33 8.89 15.91C9.44 15.36 9.89 14.73 10.33 14.12C10.78 13.5 11.53 12.44 11.89 12.44C12.29 12.44 13.08 13.56 13.56 14.22C13.95 14.78 14.36 15.35 14.82 15.85C15.21 16.27 15.62 16.64 16 17C16.54 17.45 17.32 18.14 17.33 18.44C17.32 18.58 17.12 18.86 16.96 18.93Z" />
            </svg>
        ),
        paw_off_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22.83 8.25C22.56 7.5 22.05 6.96 21.39 6.68C20.22 6.18 18.8 6.6 17.7 7.66C17.81 7.37 17.91 7.06 18 6.73C18.25 5.38 18 4.03 17.38 3.12C16.95 2.5 16.33 2.11 15.64 2C14.1 1.78 12.57 3.08 11.93 5C11.28 3.05 9.74 1.76 8.19 2C7.5 2.12 6.88 2.53 6.45 3.16C6.44 3.18 6.43 3.2 6.42 3.22L7.91 4.71C7.96 4.54 8 4.4 8.1 4.29C8.22 4.12 8.36 4 8.5 4C9 3.91 9.88 4.69 10.16 6.1C10.23 6.44 10.24 6.75 10.22 7L11.88 8.68C11.89 8.65 11.91 8.62 11.93 8.58C11.97 8.69 12.04 8.78 12.09 8.89L13.43 10.23C13.63 10.32 13.83 10.39 14.04 10.42C14.16 10.44 14.29 10.45 14.41 10.45C15.13 10.45 15.83 10.12 16.43 9.57C16 10.64 15.96 11.73 16.29 12.63C16.56 13.35 17.07 13.91 17.73 14.2C18.07 14.34 18.43 14.41 18.8 14.41C20.18 14.41 21.66 13.4 22.5 11.77C23.08 10.58 23.21 9.3 22.83 8.25M16 6.33C15.72 7.73 14.83 8.5 14.34 8.44C14.28 8.43 14.12 8.41 13.94 8.15C13.69 7.79 13.5 7.07 13.7 6.1C13.97 4.76 14.8 4 15.29 4C15.31 4 15.34 4 15.36 4C15.5 4 15.63 4.11 15.75 4.27C16.07 4.73 16.18 5.54 16 6.33M20.7 10.87C20.12 12 19.08 12.6 18.53 12.36C18.47 12.34 18.28 12.26 18.16 11.93C18 11.43 18.07 10.68 18.39 10C18.9 9.04 19.74 8.47 20.33 8.47C20.43 8.47 20.5 8.5 20.6 8.5H20.6C20.75 8.58 20.87 8.72 20.95 8.94C21.09 9.34 21.1 10.06 20.7 10.87M1.11 3L4.8 6.69C4.06 6.41 3.29 6.39 2.6 6.68C1.94 6.97 1.43 7.53 1.17 8.27C.793 9.31 .919 10.58 1.5 11.77C2.34 13.4 3.82 14.41 5.21 14.41C5.57 14.41 5.93 14.34 6.27 14.2C6.93 13.91 7.44 13.35 7.71 12.63C8 11.79 8 10.77 7.64 9.76C7.83 9.91 8.04 10.03 8.24 10.13L9.73 11.62C8.94 12.5 8.27 13.7 7.47 14.5C6.41 15.59 4.62 16.39 4.44 17.88C4.31 18.96 5 20.26 6 20.75C6.35 20.93 6.72 21 7.1 21C8.61 21 10.3 19.87 11.89 19.87C13.5 19.87 15.18 20.97 16.71 20.97C17.08 20.97 17.44 20.91 17.79 20.75C18 20.65 18.23 20.5 18.43 20.32L20.84 22.73L22.11 21.46L2.39 1.73L1.11 3M11.15 13.04L17 18.9C17 18.91 16.97 18.92 16.96 18.93C16.92 18.95 16.85 18.97 16.71 18.97C16.28 18.97 15.63 18.75 15 18.54C14.08 18.23 13.03 17.87 11.89 17.87C10.75 17.87 9.7 18.24 8.78 18.56C8.15 18.77 7.5 19 7.1 19C6.97 19 6.92 19 6.88 18.95C6.66 18.84 6.4 18.37 6.43 18.12C6.5 17.89 7.23 17.31 7.59 17C8.03 16.68 8.5 16.33 8.89 15.91C9.44 15.36 9.89 14.73 10.33 14.12C10.55 13.8 10.86 13.38 11.15 13.04M5.6 10C5.93 10.68 6 11.43 5.84 11.93C5.71 12.26 5.53 12.34 5.47 12.36C4.92 12.6 3.88 12 3.3 10.87C2.9 10.06 2.91 9.35 3.05 8.94C3.13 8.73 3.25 8.58 3.4 8.5C3.5 8.5 3.57 8.46 3.68 8.46C4.26 8.46 5.1 9.03 5.6 10Z" />
            </svg>
        ),
        spider: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M21.29 16.71L22.71 15.29L19.5 12.11L16.5 11.26L18.41 11L22.6 7.8L21.4 6.2L17.59 9.05L14.91 9.5L18.11 6.31L17 1.76L15 2.24L15.86 5.69L14.76 6.83A3 3 0 0 0 9.24 6.83L8.11 5.69L9 2.24L7 1.76L5.89 6.31L9.09 9.5L6.4 9.05L2.6 6.2L1.4 7.8L5.6 11L7.46 11.31L4.46 12.16L1.29 15.29L2.71 16.71L5.5 13.89L7.87 13.22L4 16.54V22H6V17.46L7.56 16.12A4.5 4.5 0 0 0 16.44 16.12L18 17.46V22H20V16.54L16.13 13.22L18.5 13.89Z" />
            </svg>
        ),
        // Updated/Researched MDI Icons
        auto_awesome: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19,8L15,12H19V21L21,12L25,8L21,4L19,8M19,4L15,8V12L19,8L21,4M9,4L7,8L9,12L11,8L9,4M9,12L7,16L9,20L11,16L9,12M19,21L15,25V29L19,25L21,29L19,25L15,21Z" />
            </svg>
        ),
        creation: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19,12C19,10.66 18.53,9.45 17.74,8.5C17.43,8.13 17.25,7.66 17.25,7.15C17.25,6.1 18.1,5.25 19.15,5.25C19.66,5.25 20.13,5.43 20.5,5.74C21.45,6.53 22.66,7 24,7C26.76,7 29,4.76 29,2C29,1.15 28.78,0.35 28.39,-0.36L26.77,1.26C26.92,1.48 27,1.73 27,2C27,3.66 25.66,5 24,5C23.73,5 23.48,4.92 23.26,4.77L21.64,6.39C22.35,6.78 23.15,7 24,7C26.76,7 29,9.24 29,12C29,14.76 26.76,17 24,17C23.15,17 22.35,16.78 21.64,16.39L23.26,18.01C23.48,17.86 23.73,17.78 24,17.78C25.66,17.78 27,19.12 27,20.78C27,21.05 26.92,21.3 26.77,21.52L28.39,23.14C28.78,22.43 29,21.63 29,20.78C29,18.02 26.76,15.78 24,15.78C22.66,15.78 21.45,16.25 20.5,17.04C20.13,17.35 19.66,17.53 19.15,17.53C18.1,17.53 17.25,16.68 17.25,15.63C17.25,15.12 17.43,14.65 17.74,14.28C18.53,13.33 19,12.12 19,10.78C19,9.44 18.53,8.23 17.74,7.28L16.28,8.74C16.89,9.3 17.25,10.11 17.25,11C17.25,12.66 15.91,14 14.25,14C13.36,14 12.55,13.64 11.99,13.03L10.53,14.49C11.48,15.28 12.69,15.75 14.03,15.75C16.79,15.75 19.03,13.51 19.03,10.75C19.03,9.41 18.56,8.2 17.77,7.25C17.46,6.88 17.28,6.41 17.28,5.9C17.28,4.85 18.13,4 19.18,4C19.69,4 20.16,4.18 20.53,4.49C21.48,5.28 22.69,5.75 24.03,5.75C26.79,5.75 29.03,3.51 29.03,0.75S26.79,-4.25 24.03,-4.25C23.18,-4.25 22.38,-4.03 21.67,-3.64L23.29,-2.02C23.51,-2.17 23.76,-2.25 24.03,-2.25C25.69,-2.25 27.03,-0.91 27.03,0.75S25.69,3.75 24.03,3.75C23.76,3.75 23.51,3.67 23.29,3.52L21.67,5.14C22.38,5.53 23.18,5.75 24.03,5.75C25.37,5.75 26.58,5.28 27.53,4.49C27.9,4.18 28.37,4 28.88,4C29.93,4 30.78,4.85 30.78,5.9C30.78,6.41 30.6,6.88 30.29,7.25C29.5,8.2 29.03,9.41 29.03,10.75C29.03,12.09 29.5,13.3 30.29,14.25L31.75,12.79C31.14,12.23 30.78,11.42 30.78,10.53C30.78,8.87 32.12,7.53 33.78,7.53C34.67,7.53 35.48,7.89 36.04,8.5L37.5,7.04C36.55,6.25 35.34,5.78 34,5.78C31.24,5.78 29,8.02 29,10.78C29,12.12 29.47,13.33 30.26,14.28C30.57,14.65 30.75,15.12 30.75,15.63C30.75,16.68 29.9,17.53 28.85,17.53C28.34,17.53 27.87,17.35 27.5,17.04C27.13,16.74 26.66,16.56 26.15,16.56H26.12L24.5,18.18C25.21,18.57 26.01,18.79 26.86,18.79C28.2,18.79 29.41,18.32 30.36,17.53C30.73,17.22 31.2,17.04 31.71,17.04C32.76,17.04 33.61,17.89 33.61,18.94C33.61,19.45 33.43,19.92 33.12,20.29C32.33,21.24 31.86,22.45 31.86,23.79C31.86,25.13 32.33,26.34 33.12,27.29L34.58,25.83C33.97,25.27 33.61,24.46 33.61,23.57C33.61,21.91 34.95,20.57 36.61,20.57C37.5,20.57 38.31,20.93 38.87,21.54L40.33,20.08C39.38,19.29 38.17,18.82 36.83,18.82C34.07,18.82 31.83,21.06 31.83,23.82C31.83,25.16 32.3,26.37 33.09,27.32C33.4,27.69 33.58,28.16 33.58,28.67C33.58,29.72 32.73,30.57 31.68,30.57C31.17,30.57 30.7,30.39 30.33,30.08C29.38,29.29 28.17,28.82 26.83,28.82C24.07,28.82 21.83,31.06 21.83,33.82C21.83,36.58 24.07,38.82 26.83,38.82C27.68,38.82 28.48,38.6 29.19,38.21L27.57,36.59C27.35,36.74 27.1,36.82 26.83,36.82C25.17,36.82 23.83,35.48 23.83,33.82S25.17,30.82 26.83,30.82C27.1,30.82 27.35,30.9 27.57,31.05L29.19,29.43C28.48,29.04 27.68,28.82 26.83,28.82C25.49,28.82 24.28,29.29 23.33,30.08C22.96,30.39 22.49,30.57 21.98,30.57C20.93,30.57 20.08,29.72 20.08,28.67C20.08,28.16 20.26,27.69 20.57,27.32C21.36,26.37 21.83,25.16 21.83,23.82C21.83,22.48 21.36,21.27 20.57,20.32L19.11,21.78C19.72,22.34 20.08,23.15 20.08,24.04C20.08,25.7 18.74,27.04 17.08,27.04C16.19,27.04 15.38,26.68 14.82,26.07L13.36,27.53C14.31,28.32 15.52,28.79 16.86,28.79C19.62,28.79 21.86,26.55 21.86,23.79C21.86,22.45 21.39,21.24 20.6,20.29C20.29,19.92 20.11,19.45 20.11,18.94C20.11,17.89 20.96,17.04 22.01,17.04C22.52,17.04 22.99,17.22 23.36,17.53C24.31,18.32 25.52,18.79 26.86,18.79H26.89L28.51,17.17C27.8,16.78 27,16.56 26.15,16.56C24.81,16.56 23.6,17.03 22.65,17.82C22.28,18.13 21.81,18.31 21.3,18.31C20.25,18.31 19.4,17.46 19.4,16.41C19.4,15.9 19.58,15.43 19.89,15.06C20.68,14.11 21.15,12.9 21.15,11.56C21.15,10.22 20.68,9.01 19.89,8.06L18.43,9.52C19.04,10.08 19.4,10.89 19.4,11.78C19.4,13.44 18.06,14.78 16.4,14.78C15.51,14.78 14.7,14.42 14.14,13.81L12.68,15.27C13.63,16.06 14.84,16.53 16.18,16.53C18.94,16.53 21.18,14.29 21.18,11.53C21.18,10.19 20.71,8.98 19.92,8.03C19.61,7.66 19.43,7.19 19.43,6.68C19.43,5.63 20.28,4.78 21.33,4.78C21.84,4.78 22.31,4.96 22.68,5.27C23.63,6.06 24.84,6.53 26.18,6.53C28.94,6.53 31.18,4.29 31.18,1.53S28.94,-3.47 26.18,-3.47C25.33,-3.47 24.53,-3.25 23.82,-2.86L25.44,-1.24C25.66,-1.39 25.91,-1.47 26.18,-1.47C27.84,-1.47 29.18,-0.13 29.18,1.53S27.84,4.53 26.18,4.53C25.91,4.53 25.66,4.45 25.44,4.3L23.82,5.92C24.53,6.31 25.33,6.53 26.18,6.53C27.52,6.53 28.73,6.06 29.68,5.27C30.05,4.96 30.52,4.78 31.03,4.78C32.08,4.78 32.93,5.63 32.93,6.68C32.93,7.19 32.75,7.66 32.44,8.03C31.65,8.98 31.18,10.19 31.18,11.53C31.18,12.87 31.65,14.08 32.44,15.03L33.9,13.57C33.29,13.01 32.93,12.2 32.93,11.31C32.93,9.65 31.59,8.31 29.93,8.31C29.04,8.31 28.23,8.67 27.67,9.28L26.21,7.82C27.16,7.03 28.37,6.56 29.71,6.56C32.47,6.56 34.71,8.8 34.71,11.56C34.71,12.9 34.24,14.11 33.45,15.06C33.14,15.43 32.96,15.9 32.96,16.41C32.96,17.46 33.81,18.31 34.86,18.31C35.37,18.31 35.84,18.13 36.21,17.82C37.16,17.03 38.37,16.56 39.71,16.56H39.74L41.36,18.18C40.65,18.57 39.85,18.79 39,18.79Z" />
            </svg>
        ),
        spa: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z" />
            </svg>
        ),
        sprout: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z" />
            </svg>
        ),

        mountain: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z" />
            </svg>
        ),
        summit: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M15,3H17L22,5L17,7V10.17L22,21H2L8,13L11.5,17.7L15,10.17V3Z" />
            </svg>
        ),
        // Conditions Icons
        eye_off: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z" />
            </svg>
        ),
        ear_hearing_off: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M1,4.27L2.28,3L20,20.72L18.73,22L12.91,16.18C12.19,16.74 11.67,17.19 11.37,18.1C10.77,19.92 10,20.94 8.64,21.65C8.13,21.88 7.57,22 7,22A4,4 0 0,1 3,18H5A2,2 0 0,0 7,20C7.29,20 7.56,19.94 7.76,19.85C8.47,19.5 8.97,18.97 9.47,17.47C9.91,16.12 10.69,15.39 11.5,14.76L5.04,8.31C5,8.54 5,8.77 5,9H3C3,8.17 3.14,7.39 3.39,6.66L1,4.27M14.18,11.94C14.71,11 15,9.93 15,9C15,6.2 12.8,4 10,4C8.81,4 7.74,4.39 6.89,5.06L5.46,3.63C6.67,2.61 8.25,2 10,2C13.93,2 17,5.07 17,9C17,10.26 16.62,11.65 15.93,12.9L15.47,13.65L14.03,12.2L14.18,11.94M16.36,2.64L17.78,1.22C19.77,3.21 21,5.96 21,9C21,11.83 19.93,14.41 18.18,16.36L16.77,14.94C18.15,13.36 19,11.28 19,9C19,6.5 18,4.26 16.36,2.64M12.5,9C12.5,9.5 12.36,9.93 12.13,10.31L8.69,6.87C9.07,6.64 9.5,6.5 10,6.5A2.5,2.5 0 0,1 12.5,9Z" />
            </svg>
        ),
        hand_back_right: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M13 24C9.74 24 6.81 22 5.6 19L2.57 11.37C2.26 10.58 3 9.79 3.81 10.05L4.6 10.31C5.16 10.5 5.62 10.92 5.84 11.47L7.25 15H8V3.25C8 2.56 8.56 2 9.25 2S10.5 2.56 10.5 3.25V12H11.5V1.25C11.5 .56 12.06 0 12.75 0S14 .56 14 1.25V12H15V2.75C15 2.06 15.56 1.5 16.25 1.5C16.94 1.5 17.5 2.06 17.5 2.75V12H18.5V5.75C18.5 5.06 19.06 4.5 19.75 4.5S21 5.06 21 5.75V16C21 20.42 17.42 24 13 24Z" />
            </svg>
        ),
        wheelchair_accessibility: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M18.4,11.2L14.3,11.4L16.6,8.8C16.8,8.5 16.9,8 16.8,7.5C16.7,7.2 16.6,6.9 16.3,6.7L10.9,3.5C10.5,3.2 9.9,3.3 9.5,3.6L6.8,6.1C6.3,6.6 6.2,7.3 6.7,7.8C7.1,8.3 7.9,8.3 8.4,7.9L10.4,6.1L12.3,7.2L8.1,11.5C8,11.6 8,11.7 7.9,11.7C7.4,11.9 6.9,12.1 6.5,12.4L8,13.9C8.5,13.7 9,13.5 9.5,13.5C11.4,13.5 13,15.1 13,17C13,17.6 12.9,18.1 12.6,18.5L14.1,20C14.7,19.1 15,18.1 15,17C15,15.8 14.6,14.6 13.9,13.7L17.2,13.4L17,18.2C16.9,18.9 17.4,19.4 18.1,19.5H18.2C18.8,19.5 19.3,19.3 19.4,18.4L19.6,12.5C19.6,12.2 19.5,11.8 19.3,11.6C19,11.3 18.7,11.2 18.4,11.2M18,5.5A2,2 0 0,0 20,3.5A2,2 0 0,0 18,1.5A2,2 0 0,0 16,3.5A2,2 0 0,0 18,5.5M12.5,21.6C11.6,22.2 10.6,22.5 9.5,22.5C6.5,22.5 4,20 4,17C4,15.9 4.3,14.9 4.9,14L6.4,15.5C6.2,16 6,16.5 6,17C6,18.9 7.6,20.5 9.5,20.5C10.1,20.5 10.6,20.4 11,20.1L12.5,21.6Z" />
            </svg>
        ),
        eye_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z" />
            </svg>
        ),
        flash_off: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M17,10H13L17,2H7V4.18L15.46,12.64M3.27,3L2,4.27L7,9.27V13H10V22L13.58,15.86L17.73,20L19,18.73L3.27,3Z" />
            </svg>
        ),
        account_box_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M16.5,16.25C16.5,14.75 13.5,14 12,14C10.5,14 7.5,14.75 7.5,16.25V17H16.5M12,12.25A2.25,2.25 0 0,0 14.25,10A2.25,2.25 0 0,0 12,7.75A2.25,2.25 0 0,0 9.75,10A2.25,2.25 0 0,0 12,12.25Z" />
            </svg>
        ),
        human_prone: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22,11V13H9V7H18A4,4 0 0,1 22,11M2,14V16H8V18H16V16H22V14M7.14,12.1C8.3,10.91 8.28,9 7.1,7.86C5.91,6.7 4,6.72 2.86,7.9C1.7,9.09 1.72,11 2.9,12.14C4.09,13.3 6,13.28 7.14,12.1Z" />
            </svg>
        ),
        speedometer_slow: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12 16C13.66 16 15 14.66 15 13C15 11.88 14.39 10.9 13.5 10.39L3.79 4.77L9.32 14.35C9.82 15.33 10.83 16 12 16M12 3C10.19 3 8.5 3.5 7.03 4.32L9.13 5.53C10 5.19 11 5 12 5C16.42 5 20 8.58 20 13C20 15.21 19.11 17.21 17.66 18.65H17.65C17.26 19.04 17.26 19.67 17.65 20.06C18.04 20.45 18.68 20.45 19.07 20.07C20.88 18.26 22 15.76 22 13C22 7.5 17.5 3 12 3M2 13C2 15.76 3.12 18.26 4.93 20.07C5.32 20.45 5.95 20.45 6.34 20.06C6.73 19.67 6.73 19.04 6.34 18.65C4.89 17.2 4 15.21 4 13C4 12 4.19 11 4.54 10.1L3.33 8C2.5 9.5 2 11.18 2 13Z" />
            </svg>
        ),
        terrain: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z" />
            </svg>
        ),
        claw: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22.83 8.25C22.56 7.5 22.05 6.96 21.4 6.68C20.23 6.18 18.81 6.6 17.7 7.66C17.81 7.37 17.91 7.06 18 6.73C18.25 5.38 18.03 4.03 17.38 3.12C16.95 2.5 16.33 2.11 15.64 2C14.1 1.78 12.57 3.08 11.93 5C11.29 3.05 9.74 1.76 8.19 2C7.5 2.12 6.88 2.53 6.45 3.16C5.81 4.09 5.61 5.39 5.89 6.74C5.94 7 6 7.24 6.09 7.47C5 6.56 3.7 6.2 2.6 6.68C1.94 6.97 1.44 7.53 1.17 8.27C.794 9.31 .92 10.58 1.5 11.77C2.34 13.4 3.82 14.41 5.21 14.41C5.57 14.41 5.93 14.34 6.27 14.2C6.93 13.91 7.44 13.35 7.71 12.63C8.03 11.79 8 10.77 7.64 9.76C8.19 10.19 8.81 10.45 9.45 10.45C9.57 10.45 9.7 10.44 9.82 10.42C10.5 10.32 11.12 9.92 11.55 9.3C11.7 9.08 11.83 8.84 11.93 8.58C12.03 8.84 12.15 9.08 12.3 9.29C12.73 9.91 13.35 10.31 14.04 10.42C14.16 10.44 14.29 10.45 14.41 10.45C15.13 10.45 15.83 10.12 16.43 9.57C16 10.64 15.96 11.73 16.29 12.63C16.56 13.36 17.07 13.91 17.73 14.2C18.07 14.34 18.43 14.41 18.8 14.41C20.18 14.41 21.66 13.4 22.5 11.77C23.08 10.58 23.21 9.3 22.83 8.25M5.84 11.93C5.72 12.26 5.53 12.34 5.47 12.36C4.92 12.6 3.88 12 3.3 10.87C2.9 10.06 2.91 9.35 3.05 8.94C3.13 8.73 3.25 8.58 3.4 8.5C3.5 8.5 3.58 8.46 3.68 8.46C4.26 8.46 5.1 9.03 5.6 10C5.93 10.68 6.03 11.43 5.84 11.93M9.91 8.16C9.79 8.32 9.66 8.42 9.5 8.44C9 8.5 8.14 7.73 7.85 6.34C7.65 5.38 7.85 4.66 8.1 4.29C8.22 4.12 8.36 4 8.5 4C9 3.91 9.88 4.69 10.16 6.1C10.36 7.07 10.16 7.8 9.91 8.16M16 6.33C15.72 7.73 14.83 8.5 14.34 8.44C14.28 8.43 14.12 8.41 13.94 8.15C13.69 7.79 13.5 7.07 13.7 6.1C13.97 4.76 14.8 4 15.29 4C15.32 4 15.34 4 15.36 4C15.5 4 15.63 4.11 15.75 4.27C16.07 4.73 16.18 5.54 16 6.33M20.7 10.87C20.12 12 19.08 12.6 18.53 12.36C18.47 12.34 18.28 12.26 18.16 11.93C18 11.43 18.07 10.68 18.39 10C18.9 9.04 19.75 8.47 20.33 8.47C20.43 8.47 20.5 8.5 20.6 8.5H20.61C20.76 8.58 20.87 8.72 20.95 8.94C21.1 9.34 21.11 10.06 20.7 10.87M16.3 14.5C14.95 13.05 13.89 10.44 11.89 10.44C9.88 10.44 8.88 13.09 7.47 14.5C6.41 15.59 4.62 16.39 4.44 17.88C4.31 18.96 5 20.26 6 20.75C6.35 20.93 6.72 21 7.1 21C8.61 21 10.3 19.87 11.89 19.87C13.5 19.87 15.18 20.97 16.71 20.97C17.08 20.97 17.44 20.91 17.79 20.75C18.65 20.36 19.37 19.32 19.33 18.38C19.26 16.75 17.41 15.72 16.3 14.5M16.96 18.93C16.92 18.95 16.85 18.97 16.71 18.97C16.29 18.97 15.63 18.75 15 18.54C14.08 18.23 13.03 17.87 11.89 17.87C10.75 17.87 9.7 18.24 8.78 18.56C8.15 18.77 7.5 19 7.1 19C6.97 19 6.92 19 6.88 18.95C6.66 18.84 6.4 18.37 6.43 18.12C6.5 17.89 7.23 17.31 7.59 17C8.03 16.68 8.5 16.33 8.89 15.91C9.44 15.36 9.89 14.73 10.33 14.12C10.78 13.5 11.53 12.44 11.89 12.44C12.29 12.44 13.08 13.56 13.56 14.22C13.95 14.78 14.36 15.35 14.82 15.85C15.21 16.27 15.62 16.64 16 17C16.54 17.45 17.32 18.14 17.33 18.44C17.32 18.58 17.12 18.86 16.96 18.93Z" />
            </svg>
        ),
        paw: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22.14 14.84L22.12 14.85C22.35 15.13 22.55 15.44 22.7 15.77L22.79 15.96C23.5 17.65 23 19.6 21.69 20.82C20.5 21.91 18.84 22.2 17.3 22C15.84 21.82 14.5 20.9 13.73 19.63C13.5 19.24 13.3 18.8 13.2 18.35C13.07 18 13.03 17.62 13 17.25C12.91 15.65 13.55 13.95 14.76 12.95C14.21 14.16 14.34 15.67 15.15 16.72L15.26 16.85C15.4 16.97 15.57 17 15.73 16.94C15.88 16.88 16 16.73 16 16.57L15.93 16.33C15.05 14 15.79 11.3 17.66 9.77C18.17 9.35 18.8 8.97 19.46 8.8C18.78 10.16 19 11.94 20.09 13C20.55 13.5 21.11 13.79 21.58 14.23L22.14 14.84M19.86 19.5L19.85 19.47C20.3 19.08 20.55 18.41 20.53 17.81L20.5 17.5C20.3 16.5 19.43 16.16 18.87 15.43C18.7 15.21 18.55 14.93 18.44 14.65C18.22 15.15 18.2 15.62 18.29 16.16C18.39 16.73 18.61 17.22 18.5 17.81C18.34 18.46 17.83 19.11 16.94 19.32C17.44 19.81 18.25 20.2 19.06 19.92C19.32 19.85 19.65 19.66 19.86 19.5M9 21V18H2L7 13H4L9 8H6L11 3L16 8H13L14.82 9.82C12.55 11.06 11 13.59 11 16.5C11 18.19 11.5 19.75 12.4 21H9Z" />
            </svg>
        ),
        paw_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M22.83 8.25C22.56 7.5 22.05 6.96 21.4 6.68C20.23 6.18 18.81 6.6 17.7 7.66C17.81 7.37 17.91 7.06 18 6.73C18.25 5.38 18.03 4.03 17.38 3.12C16.95 2.5 16.33 2.11 15.64 2C14.1 1.78 12.57 3.08 11.93 5C11.29 3.05 9.74 1.76 8.19 2C7.5 2.12 6.88 2.53 6.45 3.16C5.81 4.09 5.61 5.39 5.89 6.74C5.94 7 6 7.24 6.09 7.47C5 6.56 3.7 6.2 2.6 6.68C1.94 6.97 1.44 7.53 1.17 8.27C.794 9.31 .92 10.58 1.5 11.77C2.34 13.4 3.82 14.41 5.21 14.41C5.57 14.41 5.93 14.34 6.27 14.2C6.93 13.91 7.44 13.35 7.71 12.63C8.03 11.79 8 10.77 7.64 9.76C8.19 10.19 8.81 10.45 9.45 10.45C9.57 10.45 9.7 10.44 9.82 10.42C10.5 10.32 11.12 9.92 11.55 9.3C11.7 9.08 11.83 8.84 11.93 8.58C12.03 8.84 12.15 9.08 12.3 9.29C12.73 9.91 13.35 10.31 14.04 10.42C14.16 10.44 14.29 10.45 14.41 10.45C15.13 10.45 15.83 10.12 16.43 9.57C16 10.64 15.96 11.73 16.29 12.63C16.56 13.36 17.07 13.91 17.73 14.2C18.07 14.34 18.43 14.41 18.8 14.41C20.18 14.41 21.66 13.4 22.5 11.77C23.08 10.58 23.21 9.3 22.83 8.25M5.84 11.93C5.72 12.26 5.53 12.34 5.47 12.36C4.92 12.6 3.88 12 3.3 10.87C2.9 10.06 2.91 9.35 3.05 8.94C3.13 8.73 3.25 8.58 3.4 8.5C3.5 8.5 3.58 8.46 3.68 8.46C4.26 8.46 5.1 9.03 5.6 10C5.93 10.68 6.03 11.43 5.84 11.93M9.91 8.16C9.79 8.32 9.66 8.42 9.5 8.44C9 8.5 8.14 7.73 7.85 6.34C7.65 5.38 7.85 4.66 8.1 4.29C8.22 4.12 8.36 4 8.5 4C9 3.91 9.88 4.69 10.16 6.1C10.36 7.07 10.16 7.8 9.91 8.16M16 6.33C15.72 7.73 14.83 8.5 14.34 8.44C14.28 8.43 14.12 8.41 13.94 8.15C13.69 7.79 13.5 7.07 13.7 6.1C13.97 4.76 14.8 4 15.29 4C15.32 4 15.34 4 15.36 4C15.5 4 15.63 4.11 15.75 4.27C16.07 4.73 16.18 5.54 16 6.33M20.7 10.87C20.12 12 19.08 12.6 18.53 12.36C18.47 12.34 18.28 12.26 18.16 11.93C18 11.43 18.07 10.68 18.39 10C18.9 9.04 19.75 8.47 20.33 8.47C20.43 8.47 20.5 8.5 20.6 8.5H20.61C20.76 8.58 20.87 8.72 20.95 8.94C21.1 9.34 21.11 10.06 20.7 10.87M16.3 14.5C14.95 13.05 13.89 10.44 11.89 10.44C9.88 10.44 8.88 13.09 7.47 14.5C6.41 15.59 4.62 16.39 4.44 17.88C4.31 18.96 5 20.26 6 20.75C6.35 20.93 6.72 21 7.1 21C8.61 21 10.3 19.87 11.89 19.87C13.5 19.87 15.18 20.97 16.71 20.97C17.08 20.97 17.44 20.91 17.79 20.75C18.65 20.36 19.37 19.32 19.33 18.38C19.26 16.75 17.41 15.72 16.3 14.5M16.96 18.93C16.92 18.95 16.85 18.97 16.71 18.97C16.29 18.97 15.63 18.75 15 18.54C14.08 18.23 13.03 17.87 11.89 17.87C10.75 17.87 9.7 18.24 8.78 18.56C8.15 18.77 7.5 19 7.1 19C6.97 19 6.92 19 6.88 18.95C6.66 18.84 6.4 18.37 6.43 18.12C6.5 17.89 7.23 17.31 7.59 17C8.03 16.68 8.5 16.33 8.89 15.91C9.44 15.36 9.89 14.73 10.33 14.12C10.78 13.5 11.53 12.44 11.89 12.44C12.29 12.44 13.08 13.56 13.56 14.22C13.95 14.78 14.36 15.35 14.82 15.85C15.21 16.27 15.62 16.64 16 17C16.54 17.45 17.32 18.14 17.33 18.44C17.32 18.58 17.12 18.86 16.96 18.93Z" />
            </svg>
        ),
        // MDI Luck & Conditions
        clover: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,11.18C15.3,8.18 17,6.64 17,4.69C17,3.19 15.75,2 14.25,2C13.39,2 12.57,2.36 12,3C11.43,2.36 10.61,2 9.69,2C8.19,2 7,3.25 7,4.75C7,6.64 8.7,8.18 12,11.18M11.18,12C8.18,8.7 6.64,7 4.69,7C3.19,7 2,8.25 2,9.75C2,10.61 2.36,11.43 3,12C2.36,12.57 2,13.39 2,14.31C2,15.81 3.25,17 4.75,17C6.64,17 8.18,15.3 11.18,12M12.83,12C15.82,15.3 17.36,17 19.31,17C20.81,17 22,15.75 22,14.25C22,13.39 21.64,12.57 21,12C21.64,11.43 22,10.61 22,9.69C22,8.19 20.75,7 19.25,7C17.36,7 15.82,8.7 12.83,12M12,12.82C8.7,15.82 7,17.36 7,19.31C7,20.81 8.25,22 9.75,22C10.61,22 11.43,21.64 12,21C12.57,21.64 13.39,22 14.31,22C15.81,22 17,20.75 17,19.25C17,17.36 15.3,15.82 12,12.82Z" />
            </svg>
        ),
        clover_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M10.61 12.62L10.65 12.58L11.16 12.03L11.18 12L11.16 11.97C11 11.78 10.82 11.6 10.66 11.42L10.61 11.38C8.42 8.97 7.03 7.53 5.58 7.12C5.29 7.04 5 7 4.69 7C3.19 7 2 8.25 2 9.75C2 10.38 2.19 11 2.55 11.5C2.68 11.68 2.83 11.85 3 12C2.83 12.15 2.68 12.32 2.55 12.5C2.19 13 2 13.64 2 14.31C2 15.81 3.25 17 4.75 17C5.03 17 5.31 16.96 5.58 16.89C7 16.5 8.4 15.05 10.61 12.62M8.47 12C7.57 12.97 6.88 13.69 6.26 14.21C5.43 14.91 5 15 4.75 15C4.3 15 4 14.65 4 14.31C4 13.93 4.14 13.66 4.33 13.5L6 12L4.33 10.5C4.13 10.33 4 10.05 4 9.75C4 9.3 4.35 9 4.69 9C5 9 5.43 9.1 6.26 9.8C6.88 10.31 7.57 11.03 8.47 12M7.12 18.43C7.04 18.72 7 19 7 19.31C7 20.81 8.25 22 9.75 22C10.38 22 11 21.81 11.5 21.45C11.68 21.32 11.85 21.17 12 21C12.15 21.17 12.32 21.32 12.5 21.45C13 21.81 13.64 22 14.31 22C15.81 22 17 20.75 17 19.25C17 18.97 16.96 18.69 16.89 18.42C16.5 17 15.05 15.6 12.62 13.39L12.58 13.35L12.03 12.85L12 12.82L11.97 12.85L11.42 13.35L11.38 13.38C8.97 15.58 7.53 16.97 7.12 18.43M12 15.53C12.97 16.43 13.69 17.12 14.21 17.74C14.91 18.57 15 19 15 19.25C15 19.7 14.65 20 14.31 20C13.93 20 13.66 19.86 13.5 19.67L12 18L10.5 19.67C10.33 19.87 10.05 20 9.75 20C9.3 20 9 19.65 9 19.31C9 19 9.1 18.57 9.8 17.74C10.31 17.12 11.03 16.43 12 15.53M13.39 12.62C15.59 15.03 16.97 16.47 18.43 16.88C18.72 16.96 19 17 19.31 17C20.81 17 22 15.75 22 14.25C22 13.62 21.81 13 21.45 12.5C21.32 12.32 21.17 12.15 21 12C21.17 11.85 21.32 11.68 21.45 11.5C21.81 11 22 10.37 22 9.69C22 8.19 20.75 7 19.25 7C18.97 7 18.69 7.04 18.42 7.11C17 7.5 15.6 8.95 13.39 11.38L13.36 11.42L12.83 12L12.83 12L12.83 12L13.36 12.58L13.39 12.62M15.54 12C16.43 11.03 17.13 10.31 17.74 9.79C18.58 9.09 19 9 19.25 9C19.7 9 20 9.35 20 9.69C20 10.07 19.86 10.34 19.67 10.5L18 12L19.67 13.5C19.87 13.68 20 13.95 20 14.25C20 14.7 19.65 15 19.31 15C19 15 18.57 14.9 17.74 14.2C17.13 13.69 16.43 12.97 15.54 12M12.62 10.62C15.03 8.42 16.47 7.03 16.88 5.58C16.96 5.29 17 5 17 4.69C17 3.19 15.75 2 14.25 2C13.62 2 13 2.19 12.5 2.55C12.32 2.68 12.15 2.83 12 3C11.85 2.83 11.68 2.68 11.5 2.55C11 2.19 10.37 2 9.69 2C8.19 2 7 3.25 7 4.75C7 5.03 7.04 5.31 7.11 5.58C7.5 7 8.95 8.4 11.38 10.62L11.42 10.65L11.97 11.15L12 11.18L12.03 11.16L12.59 10.65L12.62 10.61M12 8.47C11.03 7.57 10.31 6.88 9.79 6.26C9.09 5.43 9 5 9 4.75C9 4.3 9.35 4 9.69 4C10.07 4 10.34 4.14 10.5 4.33L12 6L13.5 4.33C13.68 4.13 13.95 4 14.25 4C14.7 4 15 4.35 15 4.69C15 5 14.9 5.43 14.2 6.26C13.69 6.88 12.97 7.57 12 8.47Z" />
            </svg>
        ),
        horseshoe: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19,4H20V1H16V4C16,4 18,8 18,12C18,16 16,19 12,19C8,19 6,16 6,12C6,8 8,4 8,4V1H4V4H5C5,4 2,8 2,14C2,19 7,23 12,23C17,23 22,19 22,14C22,8 19,4 19,4M4,13C3.4,13 3,12.6 3,12C3,11.4 3.4,11 4,11C4.6,11 5,11.4 5,12C5,12.6 4.6,13 4,13M6,19C5.4,19 5,18.6 5,18C5,17.4 5.4,17 6,17C6.6,17 7,17.4 7,18C7,18.6 6.6,19 6,19M12,22C11.4,22 11,21.6 11,21C11,20.4 11.4,20 12,20C12.6,20 13,20.4 13,21C13,21.6 12.6,22 12,22M18,19C17.4,19 17,18.6 17,18C17,17.4 17.4,17 18,17C18.6,17 19,17.4 19,18C19,18.6 18.6,19 18,19M20,13C19.4,13 19,12.6 19,12C19,11.4 19.4,11 20,11C20.6,11 21,11.4 21,12C21,12.6 20.6,13 20,13Z" />
            </svg>
        ),
        emoticon_sick: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M21 9C19.9 9 19 8.1 19 7S21 3 21 3 23 5.9 23 7 22.1 9 21 9M17.5 7C17.5 6.27 17.91 5.29 18.42 4.34C16.68 2.88 14.44 2 12 2C6.47 2 2 6.5 2 12S6.47 22 12 22C17.5 22 22 17.5 22 12C22 11.45 21.94 10.91 21.86 10.38C21.58 10.45 21.3 10.5 21 10.5C19.07 10.5 17.5 8.93 17.5 7M15.62 7.38L16.68 8.44L15.62 9.5L16.68 10.56L15.62 11.62L13.5 9.5L15.62 7.38M7.32 8.44L8.38 7.38L10.5 9.5L8.38 11.62L7.32 10.56L8.38 9.5L7.32 8.44M15.44 17C14.75 15.81 13.47 15 12 15S9.25 15.81 8.56 17H6.88C7.18 16.24 7.64 15.57 8.22 15L5.24 13.3C4.79 13.56 4.23 13.58 3.75 13.3C3.03 12.89 2.79 11.97 3.2 11.25S4.53 10.29 5.25 10.7C5.73 11 6 11.5 6 12L9.57 14.06C10.3 13.7 11.12 13.5 12 13.5C14.33 13.5 16.32 14.95 17.12 17H15.44Z" />
            </svg>
        ),
        emoticon_sick_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M13,8.5L12.25,11H13.5L15.3,8.7L16,9.4L16.4,8.8C16.8,8.4 16.9,8 16.5,7.6L16.2,7.3L16.8,6.7L15.5,5.4L15,5.9L14.7,5.6C14.3,5.2 13.9,5.3 13.5,5.7L13,6.3L13.7,7L13,8.5M15.5,12A2,2 0 0,1 17.5,14A2,2 0 0,1 15.5,16A2,2 0 0,1 13.5,14A2,2 0 0,1 15.5,12M8.5,12A2,2 0 0,1 10.5,14A2,2 0 0,1 8.5,16A2,2 0 0,1 6.5,14A2,2 0 0,1 8.5,12M7.2,18H16.8L16,17H8L7.2,18Z" />
            </svg>
        ),
        emoticon_kiss: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M7.5,13.5L8.5,10L10.5,13.5L10,14.5C9.7,15.5 8.3,15.5 8,14.5L7.5,13.5M16.5,13.5L16,14.5C15.7,15.5 14.3,15.5 14,14.5L13.5,13.5L15.5,10L16.5,13.5M12,18C13.62,18 12.8,16.53 14,16.5C14.15,16.5 14.28,16.55 14.41,16.63L14.83,16.21C14.38,15.74 13.73,15.7 13.06,16.03L12,16.5L10.94,16.03C10.27,15.7 9.62,15.74 9.17,16.21L9.59,16.63C9.72,16.55 9.85,16.5 10,16.5C11.2,16.53 10.38,18 12,18Z" />
            </svg>
        ),
        emoticon_kiss_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M7.5,13.5L8,14.5C8.3,15.5 9.7,15.5 10,14.5L10.5,13.5L8.5,10L7.5,13.5M13.5,13.5L14,14.5C14.3,15.5 15.7,15.5 16,14.5L16.5,13.5L15.5,10L13.5,13.5M12,18C10.38,18 11.2,16.53 10,16.5C9.85,16.5 9.72,16.55 9.59,16.63L9.17,16.21C9.62,15.74 10.27,15.7 10.94,16.03L12,16.5L13.06,16.03C13.73,15.7 14.38,15.74 14.83,16.21L14.41,16.63C14.28,16.55 14.15,16.5 14,16.5C12.8,16.53 13.62,18 12,18Z" />
            </svg>
        ),
        emoticon_devil: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M19,20A4,4 0 0,1 15,16C15,14 16.5,12.1 19,12C21.5,12.1 23,14 23,16A4,4 0 0,1 19,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C9.75,20 7.75,18.5 7.75,16.5C7.75,14.5 9.75,14 12,14C14.25,14 16.25,14.5 16.25,16.5C16.25,18.5 14.25,20 12,20M17.5,11C18.3,11 19,10.3 19,9.5C19,8.7 18.3,8 17.5,8C16.8,8 16.25,8.7 16,9.25C15.75,8.7 15.2,8 14.5,8C13.7,8 13,8.7 13,9.5C13,10.3 13.7,11 14.5,11C15.2,11 15.75,10.4 16,10C16.25,10.4 16.8,11 17.5,11M6.5,11C7.3,11 8,10.3 8,9.5C8,8.7 7.3,8 6.5,8C5.8,8 5.25,8.7 5,9.25C4.75,8.7 4.2,8 3.5,8C2.7,8 2,8.7 2,9.5C2,10.3 2.7,11 3.5,11C4.2,11 4.75,10.4 5,10C5.25,10.4 5.8,11 6.5,11" />
            </svg>
        ),
        emoticon_devil_outline: (
            <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
                <path d="M1.5,2.09C2.4,3 3.87,3.73 5.69,4.25C7.41,2.84 9.61,2 12,2C14.39,2 16.59,2.84 18.31,4.25C20.13,3.73 21.6,3 22.5,2.09C22.47,3.72 21.65,5.21 20.28,6.4C21.37,8 22,9.92 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12C2,9.92 2.63,8 3.72,6.4C2.35,5.21 1.53,3.72 1.5,2.09M20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12M10.5,10C10.5,10.8 9.8,11.5 9,11.5C8.2,11.5 7.5,10.8 7.5,10V8.5L10.5,10M16.5,10C16.5,10.8 15.8,11.5 15,11.5C14.2,11.5 13.5,10.8 13.5,10L16.5,8.5V10M12,17.23C10.25,17.23 8.71,16.5 7.81,15.42L9.23,14C9.68,14.72 10.75,15.23 12,15.23C13.25,15.23 14.32,14.72 14.77,14L16.19,15.42C15.29,16.5 13.75,17.23 12,17.23Z" />
            </svg>
        ),
    };

    return icons[name] || (
        // Fallback to Material Symbols Outlined font for icons not in SVG registry
        // Uses the icon name directly as the text content (e.g., "visibility", "shield", "swords")
        <span
            className={`material-symbols-outlined ${className}`}
            style={{
                fontSize: 'inherit',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {name}
        </span>
    );
};
