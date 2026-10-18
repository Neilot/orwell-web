import { describe, expect, it } from 'vitest';
import { LinkSharing } from '../../src/analytics/links';
import { links, words } from '../../src/analytics/text';
import { chatEvent } from '../helpers';

const ana = { id: 'u1', displayName: 'Ana' };
const beto = { id: 'u2', displayName: 'Beto' };

describe('links', () => {
  it('joins short and preview-fixing domains to their site', () => {
    expect(
      words('https://youtu.be/abc https://vt.tiktok.com/x https://fixupx.com/a/status/1'),
    ).toEqual(['youtube.com', 'tiktok.com', 'x.com']);
  });

  it('cleans links of tracking codes, anchors and trailing slashes', () => {
    expect(
      links(
        'Mira https://www.instagram.com/p/abc/?igsh=xyz y https://youtu.be/v1?si=q&t=30, o https://ngl.link/ana#top.',
      ),
    ).toEqual([
      ['instagram.com', 'instagram.com/p/abc'],
      ['youtube.com', 'youtu.be/v1'],
      ['ngl.link', 'ngl.link/ana'],
    ]);
    expect(links('https://example.com/search?q=gatos&utm_source=x')).toEqual([
      ['example.com', 'example.com/search?q=gatos'],
    ]);
    expect(links('sin enlaces')).toEqual([]);
  });
});

describe('LinkSharing', () => {
  it('counts sites and repeated links per period, with who shares them', () => {
    const analyzer = new LinkSharing();
    const share = (
      id: string,
      author: typeof ana,
      text: string,
      localTime = '2026-01-05T10:00:00',
    ) => {
      analyzer.consume(chatEvent({ id, author, text, localTime }));
    };
    share('1', ana, 'https://ngl.link/ana?lang=es');
    share('2', ana, 'otra vez https://ngl.link/ana?lang=es');
    share('3', beto, 'https://youtu.be/v1 y https://www.youtube.com/watch?v=v2');
    share('4', beto, 'https://ngl.link/ana?lang=es', '2026-02-01T09:00:00');
    analyzer.consume(chatEvent({ id: '5', author: ana, text: 'sin enlaces' }));

    const january = analyzer.result()['2026-01'];
    expect(january).toMatchObject({ total: 4, distinctSites: 2, people: { u1: 2, u2: 2 } });
    expect(january?.sites.map((s) => [s.key, s.count, s.fan])).toEqual([
      ['ngl.link', 2, 'u1'],
      ['youtube.com', 2, 'u2'],
    ]);
    // Only links shared at least twice are listed.
    expect(january?.links.map((l) => [l.key, l.count])).toEqual([['ngl.link/ana?lang=es', 2]]);

    const all = analyzer.result().all;
    expect(all?.links[0]).toMatchObject({
      key: 'ngl.link/ana?lang=es',
      count: 3,
      fan: 'u1',
      fanCount: 2,
      people: { u1: 2, u2: 1 },
    });
  });
});
