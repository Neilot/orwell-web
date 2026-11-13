import { describe, expect, it } from 'vitest';
import { TelegramSource } from '../../../src/sources/telegram';
import fixture from '../../fixtures/telegram/small-group.json';
import { collect, inputFile } from '../../helpers';

/** Reads every plain JSON piece by piece, whatever its size. */
const streaming = new TelegramSource({ streamFromBytes: 0 });
const whole = new TelegramSource();

async function readError(content: string): Promise<unknown> {
  const chat = await streaming.open(inputFile('result.json', content, 7));
  return collect(chat.events).then(
    () => null,
    (error: unknown) => error,
  );
}

describe('TelegramSource reading a large export piece by piece', () => {
  it('gives the same events and chat details as parsing the file whole', async () => {
    // Braces, brackets and quotes inside a text must not be taken for structure.
    const tricky = {
      id: 900,
      type: 'message',
      date: '2026-01-05T10:00:00',
      date_unixtime: '1767607200',
      from: 'Ana',
      from_id: 'user1',
      text: 'llaves } ] { [ y "comillas" \\ con ñ y 🙂',
      text_entities: [],
    };
    const content = JSON.stringify({ ...fixture, messages: [...fixture.messages, tricky] });
    const expected = await whole.open(inputFile('result.json', content));
    for (const chunkSize of [1, 7, 4096]) {
      const chat = await streaming.open(inputFile('result.json', content, chunkSize));
      expect(await collect(chat.events)).toEqual(await collect(expected.events));
      expect(chat.info).toEqual(expected.info);
    }
  });

  it('tolerates a byte order mark and pretty-printed JSON', async () => {
    const content = String.fromCharCode(0xfeff) + JSON.stringify(fixture, null, 1);
    const chat = await streaming.open(inputFile('result.json', content, 11));
    expect(await collect(chat.events)).toHaveLength(5);
    expect(chat.info.title).toBe('Club de Ajedrez Ficticio');
  });

  it('reports the same problems, while the events are read', async () => {
    expect(await readError(JSON.stringify({ ...fixture, messages: [] }))).toMatchObject({
      code: 'empty-chat',
    });
    expect(await readError(JSON.stringify({ ...fixture, type: 'public_channel' }))).toMatchObject({
      code: 'unsupported-chat-type',
    });
    expect(
      await readError(JSON.stringify({ about: 'x', chats: { about: 'y', list: [] } })),
    ).toMatchObject({ code: 'account-export' });
    expect(await readError(JSON.stringify({ name: 'x', other: [1, 2] }))).toMatchObject({
      code: 'invalid-export',
    });
    expect(await readError(JSON.stringify(fixture).slice(0, -40))).toMatchObject({
      code: 'invalid-export',
    });
  });
});
