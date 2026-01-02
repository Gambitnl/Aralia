// TODO(lint-intent): 'Spell' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Spell as _Spell } from '../../types/spells';
import { SpellValidator } from '../../systems/spells/validation/spellValidator';
import { ZodError } from 'zod';

export interface AuditResult {
  spellId: string;
  spellName: string;
  issues: AuditIssue[];
}

export interface AuditIssue {
  type: 'phantom_scaling' | 'invalid_schema' | 'complex_scaling';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/**
 * Audits a single spell for implementation gaps.
 * Specifically checks for "Phantom Scaling" (text promises scaling, data delivers nothing)
 * and missing audiovisual assets.
 */
export function auditSpell(spellData: unknown): AuditResult {
  const result: AuditResult = {
    spellId: 'unknown',
    spellName: 'Unknown',
    issues: []
  };

  // 1. Schema Validation
  const parseResult = SpellValidator.safeParse(spellData);

  if (!parseResult.success) {
    result.issues.push({
      type: 'invalid_schema',
      severity: 'error',
      message: `Schema Validation Failed: ${formatZodError(parseResult.error)}`
    });

    // Attempt to extract basic info even if schema fails
    // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
    if (spellData && typeof spellData === 'object') {
      const unsafeData = spellData as { id?: string; name?: string };
      result.spellId = unsafeData.id || 'unknown';
      result.spellName = unsafeData.name || 'Unknown';
    }

    return result;
  }

  const spell = parseResult.data;
  result.spellId = spell.id;
  result.spellName = spell.name;

  // 2. Phantom Scaling Audit
  const hasHigherLevelsText = !!spell.higherLevels && spell.higherLevels.trim().length > 0;

  // Check if ANY effect has functional scaling
  const hasScalingLogic = spell.effects.some(effect => {
    const scaling = effect.scaling as any;
    if (!scaling) return false;

    // Check for standard bonusPerLevel (dice or flat number)
    const hasBonus = !!scaling.bonusPerLevel && scaling.bonusPerLevel.trim().length > 0;

    // Check for custom formula (rare)
    const hasCustom = !!scaling.customFormula && scaling.customFormula.trim().length > 0;

    // Check for explicit tiers (cantrips)
    const hasTiers = !!(scaling as any).scalingTiers && Object.keys((scaling as any).scalingTiers).length > 0;

    return hasBonus || hasCustom || hasTiers;
  });

  if (hasHigherLevelsText && !hasScalingLogic) {
    result.issues.push({
      type: 'phantom_scaling',
      severity: 'warning',
      message: `Higher Levels text exists ("${spell.higherLevels.substring(0, 30)}...") but no mechanical scaling logic is defined in any effect.`
    });
  }

  // 3. Complex Scaling Audit (Warning)
  // Check for scaling strings that might confuse the engine (e.g., "+1 target")
  spell.effects.forEach(effect => {
    if (effect.scaling?.bonusPerLevel) {
      const bonus = effect.scaling.bonusPerLevel;
      // Standard formats: "+1d6", "1d6", "+5", "5", "-1"
      // Regex: Optional +/- then digits, optional d+digits
      const isStandard = /^([+-]?\d+)(d\d+)?$/.test(bonus.replace(/\s/g, ''));

      if (!isStandard) {
        result.issues.push({
          type: 'complex_scaling',
          severity: 'info',
          message: `Scaling "${bonus}" may require custom handling (not standard dice/flat math).`
        });
      }
    }
  });

  return result;
}

function formatZodError(error: ZodError): string {
  // Check if error and error.errors exist to avoid runtime crashes
  if (!error || !error.issues) return JSON.stringify(error);
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}
