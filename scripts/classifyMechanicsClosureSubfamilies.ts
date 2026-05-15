import fs from 'node:fs';
import path from 'node:path';

/**
 * This script groups open spell-mechanics findings into candidate closure subfamilies.
 *
 * The mechanics closure pass needs batches that share one runtime representation,
 * not one-off spell rows. This helper reads the generated discovery report and
 * produces a reviewable planning artifact that shows which open findings appear
 * to share the same schema shape. It does not close findings and it does not
 * edit spell data; humans or agents still choose the exact batch from the report.
 *
 * Called by: agents during the mechanics-closure planning checkpoint.
 * Depends on: the generated spell mechanics discovery JSON report.
 */

// ============================================================================
// Paths And Report Types
// ============================================================================
// The generated report is the source of truth for open finding rows. The output
// files live beside the other mechanics-discovery reports so a restart can find
// the classification before choosing the next batch.
// ============================================================================

const repoRoot = process.cwd();
const sourceReportPath = path.join(
  repoRoot,
  '.agent',
  'roadmap-local',
  'spell-validation',
  'spell-mechanics-discovery.json',
);
const outputMarkdownPath = path.join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'mechanics-discovery',
  'MECHANICS_SUBFAMILY_CLASSIFICATION.md',
);
const outputJsonPath = path.join(
  repoRoot,
  'docs',
  'tasks',
  'spells',
  'mechanics-discovery',
  'MECHANICS_SUBFAMILY_CLASSIFICATION.json',
);
const args = process.argv.slice(2);
const bucketFilterArg = args.find((arg) => arg.startsWith('--buckets='));
const outputSuffixArg = args.find((arg) => arg.startsWith('--output-suffix='));
const bucketFilter = bucketFilterArg
  ?.replace('--buckets=', '')
  .split(',')
  .map((bucket) => bucket.trim())
  .filter(Boolean);
const outputSuffix = outputSuffixArg?.replace('--output-suffix=', '').trim();

type Finding = {
  bucketId: string;
  findingId: string;
  canonicalEvidence?: string;
  structuredState?: string;
  jsonState?: string;
  issue?: string;
  recommendedTemplateChange?: string;
  recommendedJsonChange?: string;
  resolutionStatus: string;
};

type ReportRow = {
  spellId?: string;
  findings?: Finding[];
};

type DiscoveryReport = {
  generatedAt?: string;
  rows: ReportRow[];
};

type SubfamilyDefinition = {
  id: string;
  title: string;
  closureRule: string;
  include: RegExp[];
  exclude?: RegExp[];
};

type ClassifiedFinding = Finding & {
  text: string;
};

// ============================================================================
// Candidate Subfamilies
// ============================================================================
// These are intentionally planning labels, not schema names. A finding lands in
// the first matching subfamily so the order keeps narrow, high-signal shapes
// ahead of broader fallback groups.
// ============================================================================

const subfamilies: SubfamilyDefinition[] = [
  {
    id: 'end_cleanup_space_or_passage_ejection',
    title: 'End Cleanup: Space Or Passage Ejection',
    closureRule:
      'Spell-created spaces, passages, or containers end and move their contents to an exit, anchor, nearest space, or other explicit destination.',
    include: [/drops? out/i, /safely ejected/i, /nearest unoccupied/i, /contents? leaving/i, /passage.*eject/i],
  },
  {
    id: 'end_cleanup_fall_descent_or_prone',
    title: 'End Cleanup: Fall, Descent, Or Prone Outcome',
    closureRule:
      'A spell or effect ending causes falling, controlled descent, landing prone, or another end-position consequence.',
    include: [/fall/i, /descends?/i, /lands prone/i, /aloft/i],
    exclude: [/drops? out/i],
  },
  {
    id: 'transfer_retarget_or_reassignment',
    title: 'Transfer, Retarget, Or Reassignment',
    closureRule:
      'An effect ends on one target, moves to another target, or can be reassigned while the spell remains active.',
    include: [/retarget/i, /new target/i, /moves? .*curse/i, /transfers?/i, /target switch/i, /reappl/i],
  },
  {
    id: 'duration_progression_or_permanence',
    title: 'Duration Progression Or Permanence',
    closureRule:
      'Repeated casting, full-duration concentration, elapsed days, or slot level changes duration, permanence, or concentration requirements.',
    include: [/daily/i, /\b\d+\s+days?\b/i, /permanent/i, /until dispelled/i, /full[- ]duration/i, /duration scaling/i],
  },
  {
    id: 'external_destruction_or_dispel',
    title: 'External Destruction Or Dispel',
    closureRule:
      'A named external spell, dispel effect, object destruction, movement break, or trigger consumption destroys or ends the created effect.',
    include: [/disintegrate/i, /destroy/i, /destroyed/i, /dispel/i, /moved too far/i, /trigger consumption/i],
  },
  {
    id: 'save_counter_or_recurring_end',
    title: 'Save Counter Or Recurring End',
    closureRule:
      'Recurring saves, counted successes/failures, branch outcomes, or escape checks end or transform an ongoing effect.',
    include: [/repeat(?:ed)? save/i, /recurring save/i, /three successes/i, /three failures/i, /escape check/i, /successes?\/failures?/i],
  },
  {
    id: 'sustain_range_cover_or_upkeep',
    title: 'Sustain, Range, Cover, Or Upkeep',
    closureRule:
      'A later action, range requirement, total-cover condition, or upkeep failure ends the spell or effect.',
    include: [/sustain/i, /upkeep/i, /outside.*range/i, /total cover/i, /action not taken/i],
  },
  {
    id: 'summon_control_possession_or_soul_lifecycle',
    title: 'Summon, Control, Possession, Or Soul Lifecycle',
    closureRule:
      'Summoned, animated, controlled, possessed, or soul/container states need lifecycle data distinct from ordinary spell ending.',
    include: [/summon/i, /demon/i, /control ending/i, /possession/i, /soul/i, /host/i, /animated/i],
  },
  {
    id: 'delivery_failure_cooldown_or_availability',
    title: 'Delivery Failure, Cooldown, Or Availability',
    closureRule:
      'A spell can fail delivery, create a later casting block, enforce a cooldown, or depend on target/soul availability.',
    include: [/delivery failure/i, /message lost/i, /block/i, /cooldown/i, /ten-day/i, /free and willing/i, /availability/i],
  },
  {
    id: 'choice_mode_or_option_branch',
    title: 'Choice, Mode, Or Option Branch',
    closureRule:
      'The spell exposes mode selection, option-specific targeting/effects, allocation choices, or player/caster branch choices.',
    include: [/choice/i, /choose/i, /mode/i, /option/i, /allocation/i, /branch/i],
  },
  {
    id: 'object_stats_damageability_or_capacity',
    title: 'Object Stats, Damageability, Or Capacity',
    closureRule:
      'Created or affected objects need hit points, AC, damageability, capacity, size limits, or structural state.',
    include: [/object stats/i, /\bAC\b/i, /hit points/i, /damageability/i, /capacity/i, /size limit/i],
  },
  {
    id: 'vision_light_sound_or_sensory',
    title: 'Vision, Light, Sound, Or Sensory',
    closureRule:
      'Light, sound, visibility, senses, cover, heat, or sensory emission/suppression needs runtime data.',
    include: [/light/i, /sound/i, /audible/i, /visible/i, /invisible/i, /vision/i, /sensory/i, /cover/i],
  },
  {
    id: 'illusion_disguise_or_reveal',
    title: 'Illusion, Disguise, Or Reveal',
    closureRule:
      'Illusion/disguise behavior, reveal conditions, study actions, physical interaction, or apparent state needs runtime data.',
    include: [/illusion/i, /disguise/i, /reveal/i, /physical interaction/i, /study/i, /discern/i],
  },
  {
    id: 'ai_arbitration_or_custom_resolution',
    title: 'AI Arbitration Or Custom Resolution',
    closureRule:
      'The finding likely cannot be captured with current deterministic schema without custom or AI-arbitrated handling.',
    include: [/AI/i, /arbitration/i, /custom/i, /spell-specific/i, /special question/i],
  },
];

// ============================================================================
// Classification Helpers
// ============================================================================
// Classification uses all explanatory text from the finding because the
// mechanics discovery report may describe the same hidden mechanic in the issue,
// evidence, or recommended-change fields.
// ============================================================================

function readReport(): DiscoveryReport {
  return JSON.parse(fs.readFileSync(sourceReportPath, 'utf8')) as DiscoveryReport;
}

function flattenOpenFindings(report: DiscoveryReport): ClassifiedFinding[] {
  return report.rows.flatMap((row) =>
    (row.findings ?? [])
      .filter((finding) => finding.resolutionStatus === 'actionable_open')
      .filter((finding) => !bucketFilter || bucketFilter.includes(finding.bucketId))
      .map((finding) => ({
        ...finding,
        text: [
          finding.findingId,
          finding.bucketId,
          finding.canonicalEvidence,
          finding.issue,
          finding.recommendedTemplateChange,
          finding.recommendedJsonChange,
          finding.structuredState,
          finding.jsonState,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
  );
}

function classifyFinding(finding: ClassifiedFinding): string {
  const match = subfamilies.find((subfamily) => {
    const included = subfamily.include.some((pattern) => pattern.test(finding.text));
    const excluded = subfamily.exclude?.some((pattern) => pattern.test(finding.text)) ?? false;
    return included && !excluded;
  });

  return match?.id ?? 'needs_manual_subfamily';
}

function escapeMarkdownCell(value: string): string {
  // Escape the escape character first so later Markdown pipe escaping remains
  // literal instead of creating an incomplete sanitization path.
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// ============================================================================
// Report Rendering
// ============================================================================
// The markdown report is the human planning surface. The JSON report carries the
// same grouping for scripts or dashboards that want to rank or filter findings.
// ============================================================================

function renderReports(report: DiscoveryReport): void {
  const findings = flattenOpenFindings(report);
  const grouped = new Map<string, ClassifiedFinding[]>();

  for (const finding of findings) {
    const id = classifyFinding(finding);
    const group = grouped.get(id) ?? [];
    group.push(finding);
    grouped.set(id, group);
  }

  const definitionById = new Map(subfamilies.map((subfamily) => [subfamily.id, subfamily]));
  const sortedGroups = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);

  const filteredOutputMarkdownPath = outputSuffix
    ? outputMarkdownPath.replace(/\.md$/, `-${outputSuffix}.md`)
    : outputMarkdownPath;
  const filteredOutputJsonPath = outputSuffix
    ? outputJsonPath.replace(/\.json$/, `-${outputSuffix}.json`)
    : outputJsonPath;

  const markdown: string[] = [
    outputSuffix ? `# Mechanics Subfamily Classification: ${outputSuffix}` : '# Mechanics Subfamily Classification',
    '',
    'Status: planning aid',
    `Generated: ${new Date().toISOString()}`,
    `Source report: ${path.relative(repoRoot, sourceReportPath)}`,
    bucketFilter ? `Bucket filter: ${bucketFilter.join(', ')}` : 'Bucket filter: all actionable_open findings',
    '',
    'This report groups currently open mechanics findings by candidate runtime shape. It is a planning aid only: batch owners must still read the canonical prose and confirm that every row in a subfamily is genuinely compatible before editing schema, templates, or spell data.',
    '',
    `Open findings classified: ${findings.length}`,
    `Candidate subfamilies: ${sortedGroups.length}`,
    '',
    '## Summary',
    '',
    '| Subfamily | Findings | Closure Rule |',
    '| --- | ---: | --- |',
  ];

  for (const [id, group] of sortedGroups) {
    const definition = definitionById.get(id);
    markdown.push(
      `| ${escapeMarkdownCell(definition?.title ?? 'Needs Manual Subfamily')} | ${group.length} | ${escapeMarkdownCell(
        definition?.closureRule ?? 'No confident keyword match; classify manually before editing.',
      )} |`,
    );
  }

  for (const [id, group] of sortedGroups) {
    const definition = definitionById.get(id);
    markdown.push('', `## ${definition?.title ?? 'Needs Manual Subfamily'}`, '');
    markdown.push(definition?.closureRule ?? 'No confident keyword match; classify manually before editing.', '');
    markdown.push('| Finding | Bucket | Issue | Recommended Template Change |');
    markdown.push('| --- | --- | --- | --- |');

    for (const finding of group.slice(0, 30)) {
      markdown.push(
        `| \`${escapeMarkdownCell(finding.findingId)}\` | \`${escapeMarkdownCell(finding.bucketId)}\` | ${escapeMarkdownCell(
          finding.issue ?? '',
        )} | ${escapeMarkdownCell(finding.recommendedTemplateChange ?? '')} |`,
      );
    }

    if (group.length > 30) {
      markdown.push('', `_Only the first 30 findings are shown in markdown for reviewability. See the JSON report for the full group._`);
    }
  }

  const json = {
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, sourceReportPath),
    openFindingsClassified: findings.length,
    groups: sortedGroups.map(([id, group]) => ({
      id,
      title: definitionById.get(id)?.title ?? 'Needs Manual Subfamily',
      closureRule: definitionById.get(id)?.closureRule ?? 'No confident keyword match; classify manually before editing.',
      count: group.length,
      findings: group.map((finding) => ({
        findingId: finding.findingId,
        bucketId: finding.bucketId,
        issue: finding.issue,
        recommendedTemplateChange: finding.recommendedTemplateChange,
        recommendedJsonChange: finding.recommendedJsonChange,
      })),
    })),
  };

  fs.writeFileSync(filteredOutputMarkdownPath, `${markdown.join('\n')}\n`, 'utf8');
  fs.writeFileSync(filteredOutputJsonPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');

  console.log(`Classified ${findings.length} open findings into ${sortedGroups.length} candidate subfamilies.`);
  console.log(`Markdown report written to ${filteredOutputMarkdownPath}`);
  console.log(`JSON report written to ${filteredOutputJsonPath}`);
}

renderReports(readReport());
