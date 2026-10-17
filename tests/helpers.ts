import type { ChatEvent } from '../src/core/chat-event';
import type { InputFile } from '../src/core/chat-source';

/**
 * An in-memory upload with the given name and content. `chunks()` hands it out in small
 * pieces, like a browser stream, so readers that stream are exercised across boundaries.
 */
export function inputFile(name: string, content: string | Uint8Array, chunkSize = 1024): InputFile {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return {
    name,
    size: bytes.length,
    bytes: () => Promise.resolve(bytes),
    async *chunks() {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        yield await Promise.resolve(bytes.subarray(i, i + chunkSize));
      }
    },
  };
}

/** A text event with sensible defaults; override any field. */
export function chatEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    id: '1',
    author: { id: 'u1', displayName: 'Ana' },
    at: Date.UTC(2026, 0, 1, 12),
    localTime: '2026-01-01T12:00:00',
    kind: 'text',
    text: 'hola',
    mentions: [],
    reactions: [],
    ...overrides,
  };
}

export async function collect<T>(items: Iterable<T> | AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}
