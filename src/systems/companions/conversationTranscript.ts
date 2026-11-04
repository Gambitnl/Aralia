// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 17:38:23
 * Dependents: hooks/useConversation.ts, state/appState.ts, state/reducers/companionReducer.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import type { ActiveConversation, ConversationMessage } from '../../types/conversation';
import type { BanterLine, BanterMoment, PlayerConversationArchiveSource } from '../../types/companions';
import { sanitizeAIPromptText } from '../../utils/core/securityUtils';

const MAX_RECALLED_CONVERSATIONS = 2;
const MAX_RECALLED_LINES_PER_CONVERSATION = 4;
const MAX_RECALLED_LINE_LENGTH = 320;

function speakerName(state: Pick<GameState, 'companions' | 'generatedNpcs'>, speakerId: string): string | undefined {
  if (speakerId === 'player') return 'You';
  if (speakerId === 'narrator') return 'Narration';
  return state.companions[speakerId]?.identity.name ?? state.generatedNpcs?.[speakerId]?.name;
}

/** Builds one archive snapshot from already delivered conversation messages. */
export function conversationArchiveEntry(
  state: Pick<GameState, 'activeConversation' | 'companions' | 'generatedNpcs' | 'worldSeed' | 'currentLocationId'>,
  capture: PlayerConversationArchiveSource['capture'],
  semanticStatus: PlayerConversationArchiveSource['semanticStatus'],
): BanterMoment | undefined {
  const conversation = state.activeConversation;
  if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0
    || typeof conversation.id !== 'string' || !Array.isArray(conversation.participants)) return undefined;

  const source: PlayerConversationArchiveSource = {
    kind: 'player-conversation',
    conversationId: conversation.id,
    ...(Number.isFinite(state.worldSeed) ? { worldSeed: state.worldSeed } : {}),
    capture,
    pendingAtCapture: conversation.pendingResponse === true,
    semanticStatus,
  };
  return {
    id: conversation.id,
    timestamp: conversation.startedAt,
    locationId: state.currentLocationId,
    participants: [...conversation.participants],
    source,
    lines: conversation.messages.map(message => archiveLine(state, message)),
  };
}

function archiveLine(
  state: Pick<GameState, 'companions' | 'generatedNpcs'>,
  message: ConversationMessage,
): BanterLine {
  return {
    messageId: message.id,
    speakerId: message.speakerId,
    speakerName: speakerName(state, message.speakerId),
    text: message.text,
    emotion: message.emotion,
    memoryHandled: message.memoryHandled,
  };
}

function sameParticipants(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every(id => right.includes(id));
}

function currentGroupWasFullyPresent(historicalWitnesses: string[], currentParticipants: string[]): boolean {
  return currentParticipants.length > 0 && currentParticipants.every(id => historicalWitnesses.includes(id));
}

function sameTranscriptSource(left: BanterMoment, right: BanterMoment): boolean {
  const a = left.source;
  const b = right.source;
  return a?.kind === 'player-conversation' && b?.kind === 'player-conversation'
    && a.conversationId === b.conversationId
    && a.worldSeed === b.worldSeed
    && sameParticipants(left.participants, right.participants);
}

function sameDeliveredMessage(left: BanterLine, right: BanterLine): boolean {
  return !!left.messageId && left.messageId === right.messageId
    && left.speakerId === right.speakerId && left.text === right.text
    && !!left.memoryHandled === !!right.memoryHandled;
}

function sharesExactPrefix(left: BanterMoment, right: BanterMoment): boolean {
  const shorter = left.lines.length <= right.lines.length ? left.lines : right.lines;
  const longer = shorter === left.lines ? right.lines : left.lines;
  return shorter.every((line, index) => sameDeliveredMessage(line, longer[index]));
}

function transcriptFingerprint(lines: BanterLine[]): string {
  let hash = 2166136261;
  for (const line of lines) {
    const value = `${line.messageId ?? ''}\u0000${line.speakerId}\u0000${line.text}\u0000${line.memoryHandled === true}`;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
  }
  return (hash >>> 0).toString(36);
}

export function findMatchingConversationArchive(
  archived: BanterMoment[] | undefined,
  incoming: BanterMoment,
): BanterMoment | undefined {
  return (archived ?? []).find(entry => sameTranscriptSource(entry, incoming) && sharesExactPrefix(entry, incoming))
    ?? (archived ?? []).find(entry => sameTranscriptSource(entry, incoming));
}

export function canMergeConversationArchive(
  archived: BanterMoment[] | undefined,
  incoming: BanterMoment,
): boolean {
  const existing = findMatchingConversationArchive(archived, incoming);
  return !existing || sharesExactPrefix(existing, incoming);
}

/**
 * Adds or extends a transcript without replacing unrelated legacy entries.
 * Extension is allowed only when the old delivered lines are an exact prefix.
 */
export function mergeConversationArchive(
  archived: BanterMoment[] | undefined,
  incoming: BanterMoment,
): BanterMoment[] {
  const current = archived ?? [];
  if (incoming.source?.kind !== 'player-conversation') {
    return current.some(entry => entry.id === incoming.id) ? current : [incoming, ...current];
  }
  const sameSourceIndex = current.findIndex(entry => sameTranscriptSource(entry, incoming) && sharesExactPrefix(entry, incoming));
  if (sameSourceIndex >= 0) {
    const previous = current[sameSourceIndex];
    const incomingExtends = previous.lines.length <= incoming.lines.length;

    const source = previous.source!;
    const updated: BanterMoment = {
      ...previous,
      lines: incomingExtends
        ? [...previous.lines, ...incoming.lines.slice(previous.lines.length)]
        : previous.lines,
      source: {
        ...source,
        capture: source.capture === 'conflict' ? 'conflict'
          : source.capture === 'ended' || incoming.source?.capture === 'ended' ? 'ended' : 'loaded-open',
        pendingAtCapture: incomingExtends ? incoming.source?.pendingAtCapture ?? source.pendingAtCapture : source.pendingAtCapture,
        semanticStatus: source.semanticStatus === 'attempted' || incoming.source?.semanticStatus === 'attempted'
          ? 'attempted' : 'not-run',
      },
    };
    if (JSON.stringify(previous) === JSON.stringify(updated)) return current;
    return current.map((entry, index) => index === sameSourceIndex ? updated : entry);
  }

  const hasDivergentSource = current.some(entry => sameTranscriptSource(entry, incoming));

  // An ambient or legacy entry may happen to share the generated ID. Preserve
  // it unchanged; the new attributed transcript receives a stable disambiguator.
  let candidate = incoming;
  if (hasDivergentSource) {
    const provenance = incoming.source;
    const participantKey = [...incoming.participants].sort().join(',');
    const worldKey = provenance?.worldSeed == null ? 'unknown-world' : String(provenance.worldSeed);
    const branchId = `conversation-conflict:${worldKey}:${encodeURIComponent(provenance?.conversationId ?? incoming.id)}:${encodeURIComponent(participantKey)}:${transcriptFingerprint(incoming.lines)}`;
    let uniqueId = branchId;
    let suffix = 1;
    while (current.some(entry => entry.id === uniqueId && !sameTranscriptSource(entry, incoming))) {
      uniqueId = `${branchId}:${suffix++}`;
    }
    const sameId = current.find(entry => entry.id === uniqueId);
    if (sameId) return current;
    candidate = {
      ...incoming,
      id: uniqueId,
      source: { ...incoming.source!, capture: 'conflict' },
    };
  } else if (current.some(entry => entry.id === incoming.id)) {
    const provenance = incoming.source;
    const participantKey = [...incoming.participants].sort().join(',');
    const worldKey = provenance?.worldSeed == null ? 'unknown-world' : String(provenance.worldSeed);
    const alternateId = `conversation:${worldKey}:${encodeURIComponent(provenance?.conversationId ?? incoming.id)}:${encodeURIComponent(participantKey)}`;
    if (!current.some(entry => entry.id === alternateId)) candidate = { ...incoming, id: alternateId };
    else return current;
  }
  return [candidate, ...current];
}

/** LOAD_GAME_SUCCESS keeps conversation UI closed and retains only delivered words. */
export function archiveSavedOpenConversation(
  state: Pick<GameState, 'activeConversation' | 'archivedBanters' | 'companions' | 'generatedNpcs' | 'worldSeed' | 'currentLocationId'>,
): BanterMoment[] {
  const entry = conversationArchiveEntry(state, 'loaded-open', 'not-run');
  return entry ? mergeConversationArchive(state.archivedBanters, entry) : (state.archivedBanters ?? []);
}

/**
 * Supplies exact prior speech only when the world matches and every current
 * participant witnessed it. Quoted lines remain speech, including unanswered questions and authored
 * events; they are not a fact, promise, consent, secret, or new social event.
 */
export function rememberedConversationSpeech(
  archived: BanterMoment[] | undefined,
  worldSeed: number,
  currentParticipants: string[],
): string {
  if (!Number.isFinite(worldSeed) || currentParticipants.length === 0) return '';
  const eligible = (archived ?? []).filter(entry => entry.source?.kind === 'player-conversation'
    && entry.source.capture !== 'conflict'
    && entry.source.worldSeed === worldSeed
    && currentGroupWasFullyPresent(entry.participants, currentParticipants));
  const recent = [...eligible].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_RECALLED_CONVERSATIONS);
  const sections: string[] = [];
  for (const entry of recent) {
    const lines = entry.lines.slice(-MAX_RECALLED_LINES_PER_CONVERSATION);
    const rendered = lines.map(line => {
      const name = sanitizeAIPromptText(line.speakerName || line.speakerId, 80);
      const label = line.memoryHandled ? '[Previously resolved authored event speech; not a new choice] ' : '';
      return `${label}${name}: "${sanitizeAIPromptText(line.text, MAX_RECALLED_LINE_LENGTH)}"`;
    });
    const lastVoice = [...lines].reverse().find(line => line.speakerId !== 'narrator');
    const unanswered = lastVoice?.speakerId === 'player'
      ? '\nNo NPC reply was recorded after the player’s final line.' : '';
    sections.push(`Earlier attributed speech at ${sanitizeAIPromptText(entry.locationId, 80)}:\n${rendered.join('\n')}${unanswered}`);
  }
  const bounded = sections.join('\n\n');
  return bounded
    ? `[Remembered exact speech; speech only, not proof of facts, promises, consent, secrets, or trust]\n${bounded}`
    : '';
}
