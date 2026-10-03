/**
 * @file credits.ts — third-party asset credits shown to players.
 *
 * Single source for the in-game Credits panel. Keep this list in step with
 * CREDITS.md at the repo root. CC-BY 4.0 asks for a credit the end user can
 * see, so every CC-BY asset the game or its tools ship must appear here.
 */
import { REFERENCE_HAND_CREDIT } from '../systems/entities3d/three/referenceHandMesh';

export interface CreditEntry {
  /** The credit line as the license asks for it: title, author, license. */
  line: string;
  /** Where the asset is used, in one short sentence. */
  use: string;
  /** Link to the source page, if one exists. */
  sourceUrl?: string;
}

export interface CreditSection {
  heading: string;
  entries: CreditEntry[];
}

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    heading: '3D models',
    entries: [
      {
        line: REFERENCE_HAND_CREDIT,
        use: 'The humanoid hand mesh of the entity engine.',
        sourceUrl: 'https://sketchfab.com/3d-models/low-poly-hand-3d-model-19c9ac5c369a468a95f081a3cc2ad4ac',
      },
      {
        line: '"Lowpoly Basemeshes - 2026 - FBX" by Peter_Seifert (Sketchfab), CC-BY 4.0',
        use: 'Whole-body options in the Part Lab tool. Not a game asset.',
        sourceUrl: 'https://sketchfab.com/3d-models/lowpoly-basemeshes-2026-fbx-514ca15af30446ebbacbb56628e26744',
      },
      {
        line: '"Free Stylized Basemesh for Blender Sculpting" by dacancino (Sketchfab), CC-BY 4.0',
        use: 'Whole-body and head-kit options in the Part Lab tool. Not a game asset.',
        sourceUrl: 'https://sketchfab.com/3d-models/free-stylized-basemesh-for-blender-sculpting-fc45334ab9fd4f24acb91eb7e17222b3',
      },
    ],
  },
  {
    heading: '2D token art',
    entries: [
      {
        line: 'Caeora painted VTT token packs (forest pack)',
        use: 'Ground sprites on the battle map.',
      },
    ],
  },
];

/** The license text link for CC-BY 4.0, shown once under the list. */
export const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/';
