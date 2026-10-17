import { describe, expect, it } from 'vitest';
import { InvalidExportError } from '../../../src/core/errors';
import { TelegramSource } from '../../../src/sources/telegram';
import fixture from '../../fixtures/telegram/small-group.json';
import { collect, inputFile } from '../../helpers';

const source = new TelegramSource();
const exportFile = inputFile('result.json', JSON.stringify(fixture));

describe('TelegramSource', () => {
  it('handles .json files only', async () => {
    expect(await source.canHandle(inputFile('result.json', ''))).toBe(true);
    expect(await source.canHandle(inputFile('RESULT.JSON', ''))).toBe(true);
    expect(await source.canHandle(inputFile('export.zip', ''))).toBe(false);
    expect(await source.canHandle(inputFile('messages.html', ''))).toBe(false);
  });

  it('reads the chat title', async () => {
    const chat = await source.open(exportFile);
    expect(chat.info).toEqual({ title: 'Club de Ajedrez Ficticio' });
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
    expect(reply?.mentions).toEqual(['user101']);
    expect(reply?.reactions).toEqual([{ emoji: '👍', count: 2, by: ['user101'] }]);
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

  it('rejects files that are not JSON', async () => {
    await expect(source.open(inputFile('result.json', '<html></html>'))).rejects.toBeInstanceOf(
      InvalidExportError,
    );
  });

  it('rejects JSON without a messages list', async () => {
    for (const content of ['{"name":"x"}', '[]', '{"messages":{}}']) {
      await expect(source.open(inputFile('result.json', content))).rejects.toBeInstanceOf(
        InvalidExportError,
      );
    }
  });
});
