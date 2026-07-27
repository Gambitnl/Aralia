/**
 * Shared trait icon resolver for both Character Creator and Glossary.
 *
 * Goal: One place to control which icon a given trait concept uses, so
 * changing it updates both UIs.
 */
export declare const getTraitIcon: (name: string, defaultIcon?: string) => string;
