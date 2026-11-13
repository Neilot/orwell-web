import { describe, expect, it } from 'vitest';
import { Topics } from '../../src/analytics/topics';
import { chatEvent } from '../helpers';

const luis = { id: 'u2', displayName: 'Luis' };

describe('Topics', () => {
  it('counts messages, writers and hours per topic and outside topics', () => {
    const analyzer = new Topics();
    analyzer.consume(chatEvent({ id: '1' }));
    analyzer.consume(chatEvent({ id: '2', topic: 'Arte', localTime: '2026-01-01T20:00:00' }));
    analyzer.consume(chatEvent({ id: '3', topic: 'Arte', localTime: '2026-01-02T20:30:00' }));
    analyzer.consume(chatEvent({ id: '4', topic: 'Arte', author: luis }));
    const [arte, general] = analyzer.result()['2026-01']?.topics ?? [];
    expect(arte).toMatchObject({
      title: 'Arte',
      messages: 3,
      writers: 2,
      top: [
        ['u1', 2],
        ['u2', 1],
      ],
    });
    expect(arte?.hours[20]).toBe(2);
    expect(general).toMatchObject({ title: null, messages: 1, writers: 1 });
    expect(analyzer.result().all).toEqual(analyzer.result()['2026-01']);
  });

  it('says nothing about a period where nobody wrote in a topic', () => {
    const analyzer = new Topics();
    analyzer.consume(chatEvent({ id: '1' }));
    analyzer.consume(chatEvent({ id: '2', topic: 'Arte', localTime: '2026-02-01T10:00:00' }));
    expect(Object.keys(analyzer.result()).sort()).toEqual(['2026-02', 'all']);
  });
});
