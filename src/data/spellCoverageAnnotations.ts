export interface CoverageAnnotation {
  bucket: string;
  byDesign?: {
    canonicalAudit?: boolean;
    structuredJsonAudit?: boolean;
    parityScript?: boolean;
  };
  note?: string;
}

export const COVERAGE_ANNOTATIONS: Record<string, CoverageAnnotation> = {
  'Level': { bucket: 'identity' },
  'School': { bucket: 'identity' },
  'Ritual': { bucket: 'identity', note: 'field present in files but no gate reads it' },
  'Classes': { bucket: 'Classes' },
  'Sub-Classes': { bucket: 'Sub-Classes' },

  'Casting Time Value': { bucket: 'Casting Time' },
  'Casting Time Unit': { bucket: 'Casting Time' },
  'Reaction Trigger': { bucket: 'Casting Time' },
  'Combat Cost': { bucket: 'Casting Time', byDesign: { canonicalAudit: true }, note: 'Aralia normalization — no canonical surface' },

  'Range Type': { bucket: 'Range/Area' },
  'Range Distance': { bucket: 'Range/Area' },
  'Range Unit': { bucket: 'Range/Area' },
  'Range Distance Unit': { bucket: 'Range/Area' },
  'Area Shape': { bucket: 'Range/Area' },
  'Area Size': { bucket: 'Range/Area' },
  'Area Size Unit': { bucket: 'Range/Area' },
  'Area Unit': { bucket: 'Range/Area' },
  'Area Size Type': { bucket: 'Range/Area' },
  'Area Height': { bucket: 'Range/Area' },
  'Area Height Unit': { bucket: 'Range/Area' },
  'Area Thickness': { bucket: 'Range/Area' },
  'Area Thickness Unit': { bucket: 'Range/Area' },
  'Targeting Type': { bucket: 'Range/Area', byDesign: { canonicalAudit: true }, note: 'Aralia normalization' },
  'Targeting Range': { bucket: 'Range/Area', byDesign: { canonicalAudit: true } },
  'Targeting Range Unit': { bucket: 'Range/Area', byDesign: { canonicalAudit: true } },
  'Targeting Max': { bucket: 'Range/Area', byDesign: { canonicalAudit: true } },
  'Valid Targets': { bucket: 'Range/Area', byDesign: { canonicalAudit: true } },
  'Target Filter Creature Types': { bucket: 'Range/Area', byDesign: { canonicalAudit: true } },
  'Line of Sight': { bucket: 'Range/Area', byDesign: { canonicalAudit: true }, note: 'no gate reads it' },

  'Verbal': { bucket: 'Components' },
  'Somatic': { bucket: 'Components' },
  'Material': { bucket: 'Components' },
  'Material Description': { bucket: 'Material Component' },
  'Material Cost GP': { bucket: 'Material Component', note: 'no gate reads it' },
  'Consumed': { bucket: 'Material Component', note: 'no gate reads it' },

  'Duration Type': { bucket: 'Duration' },
  'Duration Value': { bucket: 'Duration' },
  'Duration Unit': { bucket: 'Duration' },
  'Concentration': { bucket: 'Duration' },

  'Effect Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true }, note: 'Aralia normalization' },
  'Effect Types': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Utility Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true }, note: 'no gate reads it' },
  'Save Stat': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Save Outcome': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true }, note: 'no gate reads it' },
  'Secondary Save Stat': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Secondary Save Outcome': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Attack Roll': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Defense Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Defense Value': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Damage Dice': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Damage Flat': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Damage Trigger': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Damage Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Additional Damage': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Primary Damage Dice': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Primary Damage Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Secondary Damage Dice': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Secondary Damage Type': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Healing Dice': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },
  'Temporary HP': { bucket: 'Attack-Roll Riders', byDesign: { canonicalAudit: true } },

  'Condition': { bucket: 'Conditions', byDesign: { canonicalAudit: true }, note: 'no gate reads it' },
  'Conditions Applied': { bucket: 'Conditions', byDesign: { canonicalAudit: true } },
  'Triggered Applications': { bucket: 'Conditions', byDesign: { canonicalAudit: true } },

  'Armor Class': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Hit Points': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Speed': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Senses': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Languages': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Control Options': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Movement Type': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Forced Movement': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Flood': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Part Water': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Whirlpool': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Terrain Type': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },
  'Redirect Flow': { bucket: 'Summoned Entities', byDesign: { canonicalAudit: true } },

  'Description': { bucket: 'Description' },
  'Higher Levels': { bucket: 'Higher Levels' },
};

export function bucketForField(field: string): string {
  const direct = COVERAGE_ANNOTATIONS[field];
  if (direct) return direct.bucket;
  if (/^Spatial Detail \d/.test(field) || /^Spatial Form \d/.test(field)) return 'Range/Area';
  return 'unannotated';
}
