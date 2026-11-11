import { describe, expect, it } from 'vitest';
import { chatDayOf, Conversations } from '../../src/analytics/conversations';
import type { ChatEvent } from '../../src/core/chat-event';
import { chatEvent } from '../helpers';

let nextId = 0;

/** A message by `author` at a wall-clock time, with `at` taken from it as if it were UTC. */
function message(author: string, localTime: string): ChatEvent {
  return chatEvent({
    id: String(++nextId),
    author: { id: author, displayName: author },
    at: Date.parse(`${localTime}Z`),
    localTime,
  });
}

function run(events: readonly ChatEvent[]): ReturnType<Conversations['result']> {
  const analyzer = new Conversations();
  for (const event of events) analyzer.consume(event);
  return analyzer.result();
}

describe('chatDayOf', () => {
  it('counts the small hours as the day before', () => {
    expect(chatDayOf('2026-03-01T04:59:00')).toBe('2026-02-28');
    expect(chatDayOf('2026-03-01T05:00:00')).toBe('2026-03-01');
  });
});

describe('Conversations', () => {
  it('starts a new conversation after three quiet hours', () => {
    const result = run([
      message('ana', '2026-01-10T10:00:00'),
      message('luis', '2026-01-10T10:30:00'),
      message('ana', '2026-01-10T12:45:00'),
      message('eva', '2026-01-10T15:45:00'),
    ]);
    expect(result['2026-01']?.conversations).toEqual([
      ['2026-01-10T10:00', 165, 3, 2],
      ['2026-01-10T15:45', 0, 1, 1],
    ]);
    expect(result.all?.conversations).toEqual([]);
  });

  it('cuts a conversation at the end of the month', () => {
    const result = run([
      message('ana', '2026-01-31T23:50:00'),
      message('luis', '2026-02-01T00:10:00'),
    ]);
    expect(result['2026-01']?.conversations).toEqual([['2026-01-31T23:50', 0, 1, 1]]);
    expect(result['2026-02']?.conversations).toEqual([['2026-02-01T00:10', 0, 1, 1]]);
  });

  it('counts who writes the first and the last message of each day', () => {
    const result = run([
      message('ana', '2026-01-10T08:00:00'),
      message('luis', '2026-01-10T22:00:00'),
      // Still the 10th: the day ends at 04:59.
      message('eva', '2026-01-11T02:00:00'),
      message('ana', '2026-01-11T09:00:00'),
    ]);
    expect(result['2026-01']).toMatchObject({
      opened: { ana: 2 },
      closed: { eva: 1, ana: 1 },
    });
    expect(result.all).toMatchObject({ opened: { ana: 2 }, closed: { eva: 1, ana: 1 } });
  });

  it('ignores service notices', () => {
    const result = run([{ ...message('ana', '2026-01-10T08:00:00'), kind: 'service' }]);
    expect(result).toEqual({});
  });
});
