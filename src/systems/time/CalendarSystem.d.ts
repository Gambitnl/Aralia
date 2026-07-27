/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/time/CalendarSystem.ts
 * Manages the game calendar, holidays, and moon phases.
 */
import { Season } from '../../utils/core';
export interface GameDate {
    day: number;
    month: number;
    year: number;
}
export interface Holiday {
    id: string;
    name: string;
    description: string;
    month: number;
    day: number;
    season: Season;
    culturalNotes?: string;
}
export declare enum MoonPhase {
    NewMoon = "New Moon",
    WaxingCrescent = "Waxing Crescent",
    FirstQuarter = "First Quarter",
    WaxingGibbous = "Waxing Gibbous",
    FullMoon = "Full Moon",
    WaningGibbous = "Waning Gibbous",
    LastQuarter = "Last Quarter",
    WaningCrescent = "Waning Crescent"
}
export declare const MONTH_NAMES: string[];
export declare const HOLIDAYS: Holiday[];
export declare const getGameDateStruct: (date: Date) => GameDate;
export declare const getMonthName: (monthIndex: number) => string;
export declare const getMoonPhase: (date: Date) => MoonPhase;
export declare const getHoliday: (date: Date) => Holiday | null;
export declare const getNextHoliday: (date: Date) => Holiday;
export declare const getCalendarDescription: (date: Date) => string;
