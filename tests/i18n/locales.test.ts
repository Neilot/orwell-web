import { describe, expect, it } from 'vitest';
import { laughOf } from '../../src/analytics/text';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import { formatInt, formatPercent, setNumberLocale } from '../../src/ui/format';

/** Every key path in a locale, with arrays by length and functions by their number of parameters. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}()${String(value.length)}`];
  if (Array.isArray(value)) {
    return [
      `${path}[${String(value.length)}]`,
      ...value.flatMap((v, i) => shape(v, `${path}[${String(i)}]`)),
    ];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  }
  return [path];
}

describe('locales', () => {
  it('have the same texts in English and Spanish', () => {
    expect(shape(en)).toEqual(shape(es));
    expect([es.language.code, en.language.code]).toEqual(['es', 'en']);
  });

  it('write English ordinals for the award podium', () => {
    expect(['1', '2', '3', '4', '11', '22'].map(en.awards.place)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '22nd',
    ]);
  });
});

describe('number formats', () => {
  it('follow the language of the page', () => {
    setNumberLocale('en');
    expect([formatInt(12345), formatPercent(0.45)]).toEqual(['12,345', '45%']);
    setNumberLocale('es');
    expect([formatInt(12345), formatPercent(0.45)]).toEqual(['12.345', '45 %']);
  });
});

describe('laughs', () => {
  it('count under the word of their own family, in Spanish and English', () => {
    expect(
      ['jaja', 'jejeje', 'haha', 'hehehe', 'ahaha', 'loool', 'lmfaooo', 'xddd'].map(laughOf),
    ).toEqual(['jajaja', 'jajaja', 'haha', 'haha', 'haha', 'lol', 'lmao', 'xd']);
    expect(['hola', 'jefe', 'hash', 'logo', 'xbox'].map(laughOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});
