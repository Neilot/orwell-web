import { describe, expect, it } from 'vitest';
import { TelegramSource } from '../../../src/sources/telegram';
import fixture from '../../fixtures/telegram/small-group.json';
import { collect, inputFile } from '../../helpers';

const source = new TelegramSource();
const exportFile = inputFile('result.json', JSON.stringify(fixture));

function exportWith(changes: Record<string, unknown>): string {
  return JSON.stringify({ ...fixture, ...changes });
}

async function openError(content: string, name = 'result.json'): Promise<unknown> {
  return source.open(inputFile(name, content)).then(
    () => null,
    (error: unknown) => error,
  );
}

describe('TelegramSource', () => {
  it('handles .json, .zip and .html files', async () => {
    for (const name of ['result.json', 'RESULT.JSON', 'export.zip', 'messages.html']) {
      expect(await source.canHandle(inputFile(name, ''))).toBe(true);
    }
    for (const name of ['notes.txt', 'photo.jpg', 'result']) {
      expect(await source.canHandle(inputFile(name, ''))).toBe(false);
    }
  });

  it('recognises an export by its content, whatever its name', async () => {
    const content = JSON.stringify(fixture);
    for (const name of ['mi-chat.json', 'chat.txt', 'export', 'RESULT (1).JSON']) {
      const file = inputFile(name, content);
      expect(await source.canHandle(file)).toBe(true);
      expect(await collect((await source.open(file)).events)).toHaveLength(5);
    }
  });

  it('tolerates a byte order mark and leading whitespace', async () => {
    const bom = String.fromCharCode(0xfeff);
    const file = inputFile('chat', `${bom} \n\t${JSON.stringify(fixture)}`);
    expect(await collect((await source.open(file)).events)).toHaveLength(5);
  });

  it('recognises HTML by its content', async () => {
    expect(await openError('<!DOCTYPE html><html></html>', 'chat.json')).toMatchObject({
      code: 'wrong-export-format',
    });
  });

  it('reads the chat title', async () => {
    const chat = await source.open(exportFile);
    expect(chat.info).toEqual({ title: 'Club de Ajedrez Ficticio', skippedEntries: 0 });
  });

  it('maps messages and skips service entries', async () => {
    const events = await collect((await source.open(exportFile)).events);
    expect(events.map((e) => e.id)).toEqual(['2', '3', '4', '5', '6']);
  });

  it('maps a plain-text message', async () => {
    const [first] = await collect((await source.open(exportFile)).events);
    expect(first).toEqual({
      id: '2',
      author: { id: 'user101', displayName: 'Ana Prueba' },
      at: 1772355900_000,
      localTime: '2026-03-01T09:05:00',
      kind: 'text',
      text: 'Hola a todos',
      mentions: [],
      reactions: [],
    });
  });

  it('joins array text, and keeps replies, mentions and reactions', async () => {
    const events = await collect((await source.open(exportFile)).events);
    const reply = events.find((e) => e.id === '3');
    expect(reply?.text).toBe('Buenas Ana, mira https://example.org');
    expect(reply?.replyTo).toEqual({ eventId: '2' });
    expect(reply?.mentions).toEqual([{ id: 'user101', displayName: 'Ana' }]);
    expect(reply?.reactions).toEqual([
      { emoji: '👍', count: 2, by: [{ id: 'user101', displayName: 'Ana Prueba' }] },
    ]);
  });

  it('keeps deleted accounts by id, without a name', async () => {
    const events = await collect((await source.open(exportFile)).events);
    const sticker = events.find((e) => e.id === '4');
    expect(sticker?.author).toEqual({ id: 'user103', displayName: null });
    expect(sticker?.kind).toBe('sticker');
    expect(sticker?.stickerEmoji).toBe('😀');
  });

  it('detects photos', async () => {
    const events = await collect((await source.open(exportFile)).events);
    expect(events.find((e) => e.id === '5')?.kind).toBe('photo');
  });

  it('skips and counts invalid messages', async () => {
    const messages = [
      ...fixture.messages,
      { id: 7, type: 'message', date: 'yesterday', date_unixtime: '1775030400', text: 'x' },
      { id: 'eight', type: 'message', date: '2026-04-01T09:00:00', date_unixtime: '1775034000' },
      'not an object',
    ];
    const chat = await source.open(inputFile('result.json', exportWith({ messages })));
    expect(chat.info.skippedEntries).toBe(3);
    expect(await collect(chat.events)).toHaveLength(5);
  });

  it('tolerates unknown fields and odd secondary fields', async () => {
    const messages = [
      {
        id: 1,
        type: 'message',
        date: '2026-04-01T09:00:00',
        date_unixtime: '1775034000',
        from: 'Ana Prueba',
        from_id: 'user101',
        text: 'hola',
        text_entities: 'not a list',
        reactions: [{ type: 'custom_emoji', count: 1, document_id: 'x' }],
        future_field: { anything: true },
      },
    ];
    const chat = await source.open(inputFile('result.json', exportWith({ messages })));
    const [event] = await collect(chat.events);
    expect(chat.info.skippedEntries).toBe(0);
    expect(event?.text).toBe('hola');
    expect(event?.mentions).toEqual([]);
    // A custom emoji is kept as a reaction without an emoji character.
    expect(event?.reactions).toEqual([{ emoji: null, count: 1, by: [] }]);
  });

  it('keeps edits and sticker files', async () => {
    const base = {
      type: 'message',
      date: '2026-04-01T09:00:00',
      date_unixtime: '1775034000',
      from: 'Ana Prueba',
      from_id: 'user101',
      text: '',
    };
    const messages = [
      {
        ...base,
        id: 1,
        text: 'hola',
        edited: '2026-04-01T09:05:00',
        edited_unixtime: '1775034300',
      },
      { ...base, id: 2, media_type: 'sticker', sticker_emoji: '😀', file: 'stickers/sticker.webp' },
      {
        ...base,
        id: 3,
        media_type: 'sticker',
        sticker_emoji: '😀',
        file: '(File not included. Change data exporting settings to download.)',
      },
    ];
    const chat = await source.open(inputFile('result.json', exportWith({ messages })));
    const [edited, withFile, withoutFile] = await collect(chat.events);
    expect(edited?.editedAt).toBe(1775034300_000);
    expect(withFile?.editedAt).toBeUndefined();
    expect(withFile?.stickerId).toBe('stickers/sticker.webp');
    expect(withoutFile?.stickerId).toBeUndefined();
    expect(withoutFile?.kind).toBe('sticker');
  });

  it('marks posts made in the name of a channel', async () => {
    const message = (id: number, from_id: string) => ({
      id,
      type: 'message',
      date: '2026-04-01T09:00:00',
      date_unixtime: '1775034000',
      from: 'Anuncios',
      from_id,
      text: 'hola',
    });
    const messages = [message(1, 'channel2394941030'), message(2, 'user101')];
    const chat = await source.open(inputFile('result.json', exportWith({ messages })));
    const [channel, person] = await collect(chat.events);
    expect(channel?.author.isChannel).toBe(true);
    expect(person?.author.isChannel).toBeUndefined();
  });

  it('keeps the notices of people joining and leaving, and skips other service entries', async () => {
    const at = { date: '2026-04-01T09:00:00', date_unixtime: '1775034000' };
    const messages = [
      {
        ...at,
        id: 1,
        type: 'service',
        action: 'join_group_by_link',
        actor: 'Ana',
        actor_id: 'user101',
        inviter: 'Group',
      },
      {
        ...at,
        id: 2,
        type: 'service',
        action: 'invite_members',
        actor: 'Ana',
        actor_id: 'user101',
        members: ['Beto'],
      },
      { ...at, id: 3, type: 'service', action: 'pin_message', actor: 'Ana', actor_id: 'user101' },
      { ...at, id: 4, type: 'message', from: 'Ana', from_id: 'user101', text: 'hola' },
      {
        ...at,
        id: 5,
        type: 'service',
        action: 'remove_members',
        actor: 'Ana',
        actor_id: 'user101',
        members: ['Beto'],
      },
    ];
    const chat = await source.open(inputFile('result.json', exportWith({ messages })));
    const events = await collect(chat.events);
    expect(chat.info.skippedEntries).toBe(0);
    expect(events.map((e) => [e.id, e.kind, e.membership?.change, e.membership?.via])).toEqual([
      ['1', 'service', 'join', 'link'],
      ['2', 'service', 'join', 'added'],
      ['4', 'text', undefined, undefined],
      ['5', 'service', 'leave', undefined],
    ]);
    expect(events[0]?.membership?.who).toEqual([{ id: 'user101', name: 'Ana' }]);
    expect(events[3]?.membership?.who).toEqual([{ name: 'Beto' }]);
  });

  it('accepts personal chats', async () => {
    const chat = await source.open(
      inputFile('result.json', exportWith({ type: 'personal_chat', name: 'Ana Prueba' })),
    );
    expect(chat.info.title).toBe('Ana Prueba');
  });

  it('rejects broken JSON', async () => {
    expect(await openError('{"messages": [')).toMatchObject({ code: 'invalid-export' });
  });

  it('rejects JSON that is not a chat export', async () => {
    for (const content of ['{"name":"x"}', '[]', '{"messages":{}}', '42']) {
      expect(await openError(content)).toMatchObject({ code: 'invalid-export' });
    }
  });

  it('explains a whole-account export', async () => {
    const account = JSON.stringify({ about: 'x', chats: { about: 'y', list: [fixture] } });
    expect(await openError(account)).toMatchObject({ code: 'account-export' });
  });

  it('rejects channels', async () => {
    for (const type of ['public_channel', 'private_channel']) {
      expect(await openError(exportWith({ type }))).toMatchObject({
        code: 'unsupported-chat-type',
      });
    }
  });

  it('rejects a chat without messages', async () => {
    const onlyService = fixture.messages.filter((m) => m.type === 'service');
    expect(await openError(exportWith({ messages: [] }))).toMatchObject({ code: 'empty-chat' });
    expect(await openError(exportWith({ messages: onlyService }))).toMatchObject({
      code: 'empty-chat',
    });
  });

  it('rejects an export where no message is readable', async () => {
    expect(await openError(exportWith({ messages: [{ type: 'message' }] }))).toMatchObject({
      code: 'invalid-export',
    });
  });

  it('explains that HTML exports cannot be read', async () => {
    expect(await openError('<html></html>', 'messages.html')).toMatchObject({
      code: 'wrong-export-format',
    });
  });

  it('rejects a JSON file over the size cap', async () => {
    const small = new TelegramSource({ maxExportBytes: 100 });
    await expect(small.open(exportFile)).rejects.toMatchObject({ code: 'too-large' });
  });
});
