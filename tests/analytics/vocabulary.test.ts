import { describe, expect, it } from 'vitest';
import { Vocabulary } from '../../src/analytics/vocabulary';
import { chatEvent } from '../helpers';

describe('Vocabulary', () => {
  it('keeps English laughs as English and common English words out', () => {
    const analyzer = new Vocabulary();
    analyzer.consume(chatEvent({ id: '1', text: 'lol hehe the briefs are here haha xd' }));
    analyzer.consume(chatEvent({ id: '2', text: 'LMAO loool briefs jajaja' }));
    const words = analyzer.result()['2026-01']?.group.words ?? [];
    expect(Object.fromEntries(words)).toEqual({
      lol: 2,
      haha: 2,
      briefs: 2,
      xd: 1,
      lmao: 1,
      jajaja: 1,
    });
  });
});
