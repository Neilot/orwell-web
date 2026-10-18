import { describe, expect, it } from 'vitest';
import { initials } from '../../src/ui/people';

describe('initials', () => {
  it('takes the first letter or digit of up to two words', () => {
    expect(initials('Juan José F.')).toBe('JJ');
    expect(initials('🐾Aku - Deer🐾')).toBe('AD');
    expect(initials('Moxx☾')).toBe('M');
  });

  it('skips emojis instead of splitting them', () => {
    expect(initials('🎶 SuitSVP 💚')).toBe('S');
    expect(initials('🐈‍⬛diw')).toBe('D');
  });

  it('turns styled letters into plain ones', () => {
    expect(initials('✨𝘡𝘦𝘱𝘩𝘺𝘳✨')).toBe('Z');
  });

  it('shows the whole first emoji when the name has no letters', () => {
    expect(initials('💚💚')).toBe('💚');
    expect(initials('👨‍👩‍👧 ✨')).toBe('👨‍👩‍👧');
  });
});
