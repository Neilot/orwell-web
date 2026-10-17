import { strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { TelegramSource } from '../../../src/sources/telegram';
import fixture from '../../fixtures/telegram/small-group.json';
import { collect, inputFile } from '../../helpers';

const exportJson = strToU8(JSON.stringify(fixture));
// Stands in for media files; random bytes so it would be costly to inflate by mistake.
const fakePhoto = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7919) % 251);

function zip(files: Zippable): Uint8Array {
  return zipSync(files);
}

describe('TelegramSource with a .zip', () => {
  const source = new TelegramSource();

  it('reads result.json from the export folder, next to media', async () => {
    const archive = zip({
      'ChatExport_2026-03-02': {
        photos: { 'photo_1@01-03-2026_10-00-00.jpg': fakePhoto },
        stickers: { 'sticker.webp': fakePhoto },
        'result.json': exportJson,
      },
    });
    const chat = await source.open(inputFile('ChatExport.zip', archive, 512));
    expect(chat.info.title).toBe('Club de Ajedrez Ficticio');
    expect(await collect(chat.events)).toHaveLength(5);
  });

  it('never inflates the other entries', async () => {
    // The first entry's deflate data is overwritten with garbage; inflating it would fail.
    const archive = zip({ 'a-photo.jpg': fakePhoto, 'result.json': exportJson });
    const view = new DataView(archive.buffer, archive.byteOffset);
    const compressedSize = view.getUint32(18, true);
    const dataStart = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    archive.fill(0xff, dataStart, dataStart + compressedSize);
    const chat = await source.open(inputFile('export.zip', archive));
    expect(await collect(chat.events)).toHaveLength(5);
  });

  it('reads result.json at the root of the archive', async () => {
    const chat = await source.open(inputFile('export.zip', zip({ 'result.json': exportJson })));
    expect(await collect(chat.events)).toHaveLength(5);
  });

  it('reads an uncompressed (stored) entry', async () => {
    const archive = zipSync({ 'result.json': [exportJson, { level: 0 }] });
    const chat = await source.open(inputFile('export.zip', archive));
    expect(await collect(chat.events)).toHaveLength(5);
  });

  it('reports a zip without result.json', async () => {
    const archive = zip({ 'notes.txt': strToU8('hola'), 'photo.jpg': fakePhoto });
    await expect(source.open(inputFile('export.zip', archive))).rejects.toMatchObject({
      code: 'export-not-found',
    });
  });

  it('recognises a zipped HTML export', async () => {
    const archive = zip({
      ChatExport_2026: {
        'messages.html': strToU8('<html></html>'),
        css: { 'style.css': strToU8('') },
      },
    });
    await expect(source.open(inputFile('export.zip', archive))).rejects.toMatchObject({
      code: 'wrong-export-format',
    });
  });

  it('stops inflating once result.json passes the size cap', async () => {
    const small = new TelegramSource({ maxExportBytes: 1000 });
    const archive = zip({ 'result.json': exportJson });
    await expect(small.open(inputFile('export.zip', archive))).rejects.toMatchObject({
      code: 'too-large',
    });
  });

  it('caps a highly compressible entry (zip bomb)', async () => {
    const small = new TelegramSource({ maxExportBytes: 1024 * 1024 });
    const bomb = zip({ 'result.json': new Uint8Array(20 * 1024 * 1024).fill(32) });
    expect(bomb.length).toBeLessThan(100 * 1024);
    await expect(small.open(inputFile('export.zip', bomb, 64 * 1024))).rejects.toMatchObject({
      code: 'too-large',
    });
  });

  it('rejects a file that is not a zip', async () => {
    await expect(source.open(inputFile('export.zip', 'no soy un zip'))).rejects.toMatchObject({
      code: 'invalid-archive',
    });
  });

  it('rejects a truncated zip', async () => {
    const archive = zip({ 'result.json': exportJson });
    const cut = archive.subarray(0, Math.floor(archive.length / 2));
    await expect(source.open(inputFile('export.zip', cut))).rejects.toMatchObject({
      code: 'invalid-archive',
    });
  });

  it('applies the JSON checks to the zipped export', async () => {
    const channel = strToU8(JSON.stringify({ ...fixture, type: 'public_channel' }));
    await expect(
      source.open(inputFile('export.zip', zip({ 'result.json': channel }))),
    ).rejects.toMatchObject({ code: 'unsupported-chat-type' });
  });
});
