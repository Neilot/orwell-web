import { describe, expect, it } from 'vitest';
import { ParticipantsPerMonth } from '../../src/analytics/participants-per-month';
import { chatEvent } from '../helpers';

const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: null };

describe('ParticipantsPerMonth', () => {
  it('counts distinct authors per local month', () => {
    const analyzer = new ParticipantsPerMonth();
    analyzer.consume(chatEvent({ author: ana, localTime: '2026-03-01T10:00:00' }));
    analyzer.consume(chatEvent({ author: ana, localTime: '2026-03-20T10:00:00' }));
    analyzer.consume(chatEvent({ author: beto, localTime: '2026-03-31T23:59:00' }));
    analyzer.consume(chatEvent({ author: beto, localTime: '2026-04-01T00:00:00' }));
    analyzer.consume(chatEvent({ author: ana, kind: 'service', localTime: '2026-04-02T00:00:00' }));
    expect(analyzer.result()).toEqual({ '2026-03': 2, '2026-04': 1 });
  });

  it('also counts people who reacted or were mentioned', () => {
    const analyzer = new ParticipantsPerMonth();
    analyzer.consume(
      chatEvent({
        author: ana,
        mentions: ['u3', 'u1'],
        reactions: [{ emoji: '👍', count: 3, by: ['u4', 'u3'] }],
      }),
    );
    expect(analyzer.result()).toEqual({ '2026-01': 3 });
  });
});
