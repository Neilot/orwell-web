import { describe, expect, it } from 'vitest';
import { detectCommunities, seededRandom } from '../../src/analytics/communities';
import { Interactions } from '../../src/analytics/interactions';
import type { ChatEvent, Participant } from '../../src/core/chat-event';
import { chatEvent } from '../helpers';

const ana: Participant = { id: 'u1', displayName: 'Ana' };
const beto: Participant = { id: 'u2', displayName: 'Beto' };
const caro: Participant = { id: 'u3', displayName: 'Caro' };
const dani: Participant = { id: 'u4', displayName: null };

function message(id: string, author: Participant, extra: Partial<ChatEvent> = {}): ChatEvent {
  return chatEvent({ id, author, localTime: '2026-04-10T10:00:00', ...extra });
}

describe('Interactions', () => {
  it('lists writers, then reactors, then people mentioned or replied to', () => {
    const analyzer = new Interactions();
    analyzer.consume(chatEvent({ id: '0', author: caro, localTime: '2026-03-31T10:00:00' }));
    analyzer.consume(
      message('1', beto, {
        mentions: [{ id: 'u9', displayName: 'Nueve' }],
        replyTo: { eventId: '0' },
      }),
    );
    analyzer.consume(
      message('2', ana, {
        reactions: [{ emoji: '👍', count: 3, by: [dani, { id: 'u4', displayName: 'Dani' }] }],
      }),
    );
    const april = analyzer.result()['2026-04'];
    expect(april?.people.map((p) => [p.id, p.name])).toEqual([
      ['u2', 'Beto'],
      ['u1', 'Ana'],
      ['u4', 'Dani'],
      ['u3', 'Caro'],
      ['u9', 'Nueve'],
    ]);
    expect(april?.reactions).toBe(3);
    expect(april?.reactionEmojis).toEqual([['👍', 3]]);
    // Only those who wrote or reacted are in the graph: Caro (replied to) and Nueve (mentioned) are not.
    expect(april?.graph.nodes).toEqual([0, 1, 2]);
  });

  it('counts replies, mentions and reactions between people', () => {
    const analyzer = new Interactions();
    analyzer.consume(message('1', ana));
    analyzer.consume(message('2', beto, { replyTo: { eventId: '1' } }));
    analyzer.consume(message('3', beto, { replyTo: { eventId: '1' } }));
    analyzer.consume(message('4', ana, { replyTo: { eventId: '1' } })); // to herself: ignored
    analyzer.consume(message('5', ana, { mentions: [beto, ana] }));
    analyzer.consume(
      message('6', beto, { reactions: [{ emoji: null, count: 2, by: [ana, caro] }] }),
    );
    const april = analyzer.result()['2026-04'];
    const byId = new Map(april?.people.map((p) => [p.id, p]));
    expect(byId.get('u1')).toMatchObject({
      messages: 3,
      repliesSent: 0,
      repliesReceived: 2,
      reactionsSent: 1,
      mentioned: 1,
    });
    expect(byId.get('u2')).toMatchObject({
      messages: 3,
      repliesSent: 2,
      reactionsReceived: 2,
      mentioned: 1,
    });
    expect(byId.get('u3')).toMatchObject({
      messages: 0,
      reactionsSent: 1,
      reactionEmojis: { '★': 1 },
    });
    expect(byId.get('u2')?.reactionEmojis).toEqual({});
    // Custom emoji have no character, so they are counted as a star.
    expect(april?.reactionEmojis).toEqual([['★', 2]]);

    const graph = april?.graph;
    // Nodes follow the most messages, ties in listing order: Ana, Beto, Caro.
    expect(graph?.nodes).toEqual([0, 1, 2]);
    expect(graph?.edges.reply).toEqual([[1, 0, 2]]);
    expect(graph?.edges.mention).toEqual([[0, 1, 1]]);
    expect(graph?.edges.reaction).toEqual([
      [0, 1, 1],
      [2, 1, 1],
    ]);
    expect(graph?.communities).toHaveLength(3);
  });
});

describe('detectCommunities', () => {
  it('tells channels and bots from people', () => {
    const analyzer = new Interactions();
    const ship = { id: 'u7', displayName: 'SHIPPERING' };
    const news = { id: 'channel9', displayName: 'Anuncios', isChannel: true };
    const helper = { id: 'u8', displayName: 'GroupHelpBot' };
    const answerer = { id: 'u9', displayName: 'Respondón' };
    let id = 0;
    const say = (author: Participant, extra: Partial<ChatEvent> = {}) => {
      analyzer.consume(message(String(++id), author, extra));
      return String(id);
    };
    say(news, { text: 'Evento el sábado' });
    say(helper, { text: 'Bienvenido' });
    say(ana, { text: '/pareja@SHIPPERINGbot' });
    say(ship, { text: 'La pareja del día…' });
    // Someone who answers commands often enough counts as a bot even without its name.
    for (let k = 0; k < 3; k++)
      say(answerer, { replyTo: { eventId: say(beto, { text: '/dado' }) } });
    // A person answering a single command stays a person.
    say(caro, { replyTo: { eventId: say(beto, { text: '/dado' }) } });
    const kinds = new Map(analyzer.result()['2026-04']?.people.map((p) => [p.name, p.kind]));
    expect(Object.fromEntries(kinds)).toEqual({
      Anuncios: 'channel',
      GroupHelpBot: 'bot',
      Ana: 'person',
      SHIPPERING: 'bot',
      Beto: 'person',
      Respondón: 'bot',
      Caro: 'person',
    });
    // Channels and bots still take part in the wheel; only the words scatter can hide them.
    expect(analyzer.result()['2026-04']?.graph.nodes).toHaveLength(7);
  });

  it('is reproducible with the seeded generator', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('separates two cliques and puts small groups in "others"', () => {
    // People 0–3 talk among themselves, 4–7 too, and 8–9 only with each other.
    const n = 10;
    const w = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const link = (a: number, b: number): void => {
      const row = w[a];
      if (row) row[b] = 5;
    };
    for (const group of [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]) {
      for (const a of group) for (const b of group) if (a !== b) link(a, b);
    }
    link(8, 9);
    link(3, 4);
    const communities = detectCommunities(w);
    expect(new Set(communities.slice(0, 4)).size).toBe(1);
    expect(new Set(communities.slice(4, 8)).size).toBe(1);
    expect(communities[0]).not.toBe(communities[4]);
    expect(communities[8]).toBe(5);
    expect(communities[9]).toBe(5);
  });

  it('handles an empty graph', () => {
    expect(detectCommunities([])).toEqual([]);
  });
});
