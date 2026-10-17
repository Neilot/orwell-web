import type { ChatEvent } from '../src/core/chat-event';
import type { InputFile } from '../src/core/chat-source';

/** An in-memory upload with the given name and text content. */
export function inputFile(name: string, content: string): InputFile {
  const bytes = new TextEncoder().encode(content);
  return { name, size: bytes.length, bytes: () => Promise.resolve(bytes) };
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
