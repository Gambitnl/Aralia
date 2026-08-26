/**
 * The Design Preview surface's tools — layer 2 of the stack, where a feature
 * declares the tools that drive it.
 *
 * WHY THIS SURFACE FIRST. Remy chose all four surfaces, and the order was
 * still open. Design Preview goes first because it is the surface I already
 * drive by hand every day: I open a step, look at it, reroll a seed, and look
 * again. Every one of those is a screenshot and a guess today. It is also the
 * surface where a broken tool cannot damage a save.
 *
 * The tools cover all three kinds Remy allowed — read, navigate, and act.
 *
 * The page owns its own state, so it hands this module the few actions it is
 * willing to expose. Nothing here reaches into React internals.
 */

import type { AraliaTool, SurfaceTools } from '../types';
import { registerSurface } from '../registry';

/** What the page must supply for the tools to work. */
export interface DesignPreviewBridge {
  /** Which step is open right now. */
  getCurrentStep: () => string;
  /** Every step id and its label, so an agent can pick one by name. */
  listSteps: () => Array<{ id: string; label: string; group: string }>;
  /** Open a step. Returns false when the id is unknown. */
  openStep: (id: string) => boolean;
  /** The style variant in use, such as 'unified' or 'live'. */
  getVariant: () => string;
  /** Switch the style variant. Returns false when the name is not offered. */
  setVariant: (name: string) => boolean;
  /**
   * Mount the open step again from scratch.
   *
   * NOT a seed control. The page holds no seed of its own, and inventing one
   * would be a lie in a tool description an agent has to trust. A remount
   * re-runs whatever the step's own components do on mount, which is a fresh
   * generated result for the generative steps and a plain redraw elsewhere.
   */
  remountStep: () => void;
}

const text = (s: string) => ({ text: s });
const fail = (s: string) => ({ text: s, isError: true });

/** Build the tool list against one page's bridge. */
export function designPreviewTools(bridge: DesignPreviewBridge): AraliaTool[] {
  return [
    {
      name: 'designPreview.getCurrentStep',
      title: 'Which step is open',
      description:
        'Name the Design Preview step currently on screen, with its group and style variant. '
        + 'Call this before anything else to learn where you are.',
      kind: 'read',
      execute: () => {
        const id = bridge.getCurrentStep();
        const meta = bridge.listSteps().find((s) => s.id === id);
        return {
          text: meta
            ? `Step "${meta.label}" (id ${meta.id}) in the ${meta.group} group, style ${bridge.getVariant()}.`
            : `Step id ${id}, style ${bridge.getVariant()}.`,
          data: { id, label: meta?.label, group: meta?.group, variant: bridge.getVariant() },
        };
      },
    },

    {
      name: 'designPreview.listSteps',
      title: 'List every step',
      description:
        'List every Design Preview step: its id, its label, and the group it belongs to. '
        + 'Use it to find the id to pass to designPreview.openStep.',
      kind: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          group: {
            type: 'string',
            description:
              'Optional. Show only one group: character, gameplay, world, entity-studio, tooling, spells.',
          },
        },
      },
      execute: (input) => {
        const group = typeof input.group === 'string' ? input.group : undefined;
        const all = bridge.listSteps();
        const rows = group ? all.filter((s) => s.group === group) : all;
        if (!rows.length) {
          return fail(
            group
              ? `No steps in group "${group}". Groups are: ${[...new Set(all.map((s) => s.group))].join(', ')}.`
              : 'No steps registered.',
          );
        }
        return {
          text: `${rows.length} steps:\n${rows.map((s) => `${s.id} — ${s.label} (${s.group})`).join('\n')}`,
          data: rows,
        };
      },
    },

    {
      name: 'designPreview.openStep',
      title: 'Open a step',
      description:
        'Open one Design Preview step by its id, so it is the thing on screen. '
        + 'Get valid ids from designPreview.listSteps.',
      kind: 'navigate',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The step id, such as "land" or "partlab".' } },
        required: ['id'],
      },
      execute: (input) => {
        const id = typeof input.id === 'string' ? input.id : '';
        if (!id) return fail('Pass an id. Get one from designPreview.listSteps.');
        if (!bridge.openStep(id)) {
          const near = bridge.listSteps()
            .filter((s) => s.id.includes(id) || id.includes(s.id))
            .map((s) => s.id);
          return fail(
            near.length
              ? `No step "${id}". Did you mean: ${near.join(', ')}?`
              : `No step "${id}". Call designPreview.listSteps for the valid ids.`,
          );
        }
        return text(`Opened step "${id}".`);
      },
    },

    {
      name: 'designPreview.setStyle',
      title: 'Switch the style',
      description:
        'Switch the Design Preview style variant, for example between the candidate layout '
        + 'and the shipped one.',
      kind: 'navigate',
      inputSchema: {
        type: 'object',
        properties: { style: { type: 'string', description: 'The style name, such as "unified" or "live".' } },
        required: ['style'],
      },
      execute: (input) => {
        const style = typeof input.style === 'string' ? input.style : '';
        if (!style) return fail('Pass a style name.');
        if (!bridge.setVariant(style)) {
          return fail(`Style "${style}" is not offered for the step now open.`);
        }
        return text(`Style is now "${style}".`);
      },
    },

    {
      name: 'designPreview.remountStep',
      title: 'Draw the step again',
      description:
        'Mount the open step again from scratch, so its generators run once more. '
        + 'On a generative step this gives a different result; elsewhere it is a plain redraw. '
        + 'It does not set a seed: this page holds no seed of its own.',
      kind: 'act',
      execute: () => {
        bridge.remountStep();
        return text(`Mounted step "${bridge.getCurrentStep()}" again.`);
      },
    },
  ];
}

/** Declare the surface. The page calls activate('design-preview') to switch it on. */
export function declareDesignPreviewSurface(bridge: DesignPreviewBridge): SurfaceTools {
  const entry: SurfaceTools = {
    surface: 'design-preview',
    label: 'Design Preview',
    tools: designPreviewTools(bridge),
  };
  registerSurface(entry);
  return entry;
}
