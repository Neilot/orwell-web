import { describe, expect, it } from 'vitest';
import { MessageLengths } from '../../src/analytics/message-lengths';
import { chatEvent } from '../helpers';

describe('MessageLengths', () => {
  it('gives the usual range and the median of words per message', () => {
    const analyzer = new MessageLengths();
    for (let length = 1; length <= 10; length++) {
      analyzer.consume(chatEvent({ id: String(length), text: 'hola '.repeat(length) }));
    }
    analyzer.consume(
      chatEvent({ id: 'b1', author: { id: 'u2', displayName: 'Luis' }, text: 'uno dos tres' }),
    );
    const month = analyzer.result()['2026-01'];
    expect(month?.people.u1).toEqual({ low: 1, median: 5, high: 9, count: 10 });
    expect(month?.people.u2).toEqual({ low: 3, median: 3, high: 3, count: 1 });
    expect(month?.group.count).toBe(11);
    expect(analyzer.result().all?.group).toEqual(month?.group);
  });

  it('leaves out messages without words', () => {
    const analyzer = new MessageLengths();
    analyzer.consume(chatEvent({ id: '1', kind: 'sticker', text: '' }));
    analyzer.consume(chatEvent({ id: '2', text: '🙂' }));
    expect(analyzer.result()).toEqual({});
  });
});
