import type { HealthSignal } from './types';

/**
 * This file renders compact warning badges for roadmap node health signals.
 *
 * Roadmap visualizer rows pass computed signals into this component so each node
 * can show quick "at a glance" warning markers with hover text for details.
 * It keeps icon/color mapping in one place so UI meaning stays consistent.
 */

// ============================================================================
// Component Contract
// ============================================================================
// The visualizer passes an array of warning signals produced by the health-signal
// computation function for the currently rendered roadmap node.
// ============================================================================
interface Props {
  signals: HealthSignal[];
}

// ============================================================================
// Badge Presentation Map
// ============================================================================
// Each signal kind maps to a tiny marker and text color class so all warning badges
// are rendered consistently anywhere this component is used.
// ============================================================================
const BADGE_CONFIG: Record<HealthSignal['kind'], { icon: string; colorClass: string }> = {
  'no-test': { icon: 'T', colorClass: 'text-amber-400' },
  'test-not-run': { icon: 'R', colorClass: 'text-orange-300' },
  'not-atomized': { icon: 'S', colorClass: 'text-violet-400' },
  'density-warning': { icon: 'D', colorClass: 'text-red-400' }
};

// ============================================================================
// Badge Rendering
// ============================================================================
// Render nothing when no signals exist. Otherwise, render one tooltip-bearing marker
// per signal so users can hover and read the full warning message text.
// ============================================================================
export function NodeHealthBadge({ signals }: Props) {
  // Skip rendering entirely for healthy nodes to keep the label row clean.
  if (signals.length === 0) return null;

  // Render markers in incoming order so warning sequence matches computation output.
  return (
    <span className="flex items-center gap-0.5">
      {signals.map((signal) => {
        // Use the configured icon and color for the current signal kind.
        const { icon, colorClass } = BADGE_CONFIG[signal.kind];

        // Title attribute carries the full explanation shown on hover.
        return (
          <span
            key={signal.kind}
            title={signal.message}
            className={`select-none text-[10px] leading-none ${colorClass}`}
          >
            {icon}
          </span>
        );
      })}
    </span>
  );
}
