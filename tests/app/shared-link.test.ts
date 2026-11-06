import { describe, expect, it } from 'vitest';
import {
  newSharedLink,
  openChat,
  parseSharedLink,
  sealChat,
  sharedLinkHash,
  type SharedChat,
} from '../../src/app/shared-link';

const chat = {
  dashboard: { title: 'Grupo ñandú 🦊', messageCount: 3 },
  month: '2026-10',
} as unknown as SharedChat;

describe('shared links', () => {
  it('opens a sealed chat with its key', async () => {
    const { key } = newSharedLink();
    await expect(openChat(await sealChat(chat, key), key)).resolves.toEqual(chat);
  });

  it('keeps the chat unreadable and refuses any other key', async () => {
    const { key } = newSharedLink();
    const sealed = await sealChat(chat, key);
    expect(new TextDecoder().decode(sealed)).not.toContain('Grupo');
    await expect(openChat(sealed, newSharedLink().key)).rejects.toThrow();
  });

  it('refuses a file that was altered', async () => {
    const { key } = newSharedLink();
    const sealed = await sealChat(chat, key);
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 1;
    await expect(openChat(sealed, key)).rejects.toThrow();
  });

  it('reads back the link it wrote', () => {
    const link = newSharedLink();
    expect(parseSharedLink(sharedLinkHash(link))).toEqual(link);
  });

  it('ignores anything that is not a valid link', () => {
    const { id } = newSharedLink();
    for (const hash of ['', '#', '#g=abc&k=abc', `#g=${id}`, `#g=${id}&k=short`, `#g=${id}&k=%%`]) {
      expect(parseSharedLink(hash)).toBeNull();
    }
    expect(parseSharedLink(`#g=../../secret00&k=${'a'.repeat(43)}`)).toBeNull();
  });
});
