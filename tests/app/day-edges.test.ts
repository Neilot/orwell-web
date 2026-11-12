import { describe, expect, it } from 'vitest';
import { dayEdges } from '../../src/app/day-edges';
import type { Conversation } from '../../src/app/worker-protocol';

const talk = (start: string, minutes: number): Conversation => [start, minutes, 10, 3];

describe('dayEdges', () => {
  it('gives the usual time of the first and the last message of the day', () => {
    const edges = dayEdges([
      talk('2026-10-01T07:00', 60),
      talk('2026-10-01T20:00', 180),
      talk('2026-10-02T07:20', 30),
      talk('2026-10-02T21:00', 150),
      talk('2026-10-03T07:10', 600),
    ]);
    expect(edges).toEqual({ first: 7 * 60 + 10, last: 23 * 60 });
  });

  it('counts a talk that ends after midnight as the end of the day before', () => {
    const edges = dayEdges([talk('2026-10-01T22:00', 180), talk('2026-10-02T23:00', 150)]);
    // 01:00 and 01:30 are later than any evening hour, so the usual end is past midnight.
    expect(edges.last).toBe(75);
    expect(edges.first).toBe(22 * 60 + 30);
  });

  it('has nothing to say without conversations', () => {
    expect(dayEdges([])).toEqual({ first: null, last: null });
  });
});
