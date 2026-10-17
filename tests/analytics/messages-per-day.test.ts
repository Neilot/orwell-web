import { describe, expect, it } from 'vitest';
import { MessagesPerDay } from '../../src/analytics/messages-per-day';
import { chatEvent } from '../helpers';

describe('MessagesPerDay', () => {
  it('counts messages per local day, sorted by day', () => {
    const analyzer = new MessagesPerDay();
    for (const localTime of [
      '2026-03-02T10:00:00',
      '2026-03-01T09:00:00',
      '2026-03-01T23:59:59',
      '2026-03-02T00:00:00',
    ]) {
      analyzer.consume(chatEvent({ localTime }));
    }
    const result = analyzer.result();
    expect(result).toEqual({ '2026-03-01': 2, '2026-03-02': 2 });
    expect(Object.keys(result)).toEqual(['2026-03-01', '2026-03-02']);
  });

  it('uses the wall-clock day, not the UTC instant', () => {
    const analyzer = new MessagesPerDay();
    // 23:30 local on 1 March is already 2 March in UTC for a UTC-1 export.
    analyzer.consume(
      chatEvent({ at: Date.UTC(2026, 2, 2, 0, 30), localTime: '2026-03-01T23:30:00' }),
    );
    expect(analyzer.result()).toEqual({ '2026-03-01': 1 });
  });

  it('ignores service events', () => {
    const analyzer = new MessagesPerDay();
    analyzer.consume(chatEvent({ kind: 'service' }));
    expect(analyzer.result()).toEqual({});
  });
});
