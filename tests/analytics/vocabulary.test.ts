import { describe, expect, it } from 'vitest';
import { Vocabulary } from '../../src/analytics/vocabulary';
import { chatEvent } from '../helpers';

describe('Vocabulary', () => {
  it('keeps laughs as written and common English words out', () => {
    const analyzer = new Vocabulary();
    analyzer.consume(chatEvent({ id: '1', text: 'lol hehe the briefs are here haha xd' }));
    analyzer.consume(chatEvent({ id: '2', text: 'LMAO jajaja briefs jajaj' }));
    const words = analyzer.result()['2026-01']?.group.words ?? [];
    expect(Object.fromEntries(words)).toEqual({
      lol: 1,
      hehe: 1,
      briefs: 2,
      haha: 1,
      lmao: 1,
      jajaja: 1,
      jajaj: 1,
    });
  });
});
