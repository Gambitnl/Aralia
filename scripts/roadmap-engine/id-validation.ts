export class RoadmapNodeIdRegistry {
  private readonly seen = new Map<string, string>();

  register(id: string, context: string) {
    const existing = this.seen.get(id);
    if (existing) {
      throw new Error(
        `[roadmap-id-collision] Duplicate node id "${id}". Existing: ${existing}. Incoming: ${context}. ` +
        'Generation aborted. Rename or refine the source feature/subfeature labels to keep IDs unique.'
      );
    }
    this.seen.set(id, context);
  }
}
