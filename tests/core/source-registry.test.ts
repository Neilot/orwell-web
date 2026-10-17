import { describe, expect, it } from 'vitest';
import type { ChatSource } from '../../src/core/chat-source';
import { UnsupportedFileError } from '../../src/core/errors';
import { SourceRegistry } from '../../src/core/source-registry';
import { inputFile } from '../helpers';

function source(id: string, extension: string): ChatSource {
  return {
    id,
    canHandle: (file) => Promise.resolve(file.name.endsWith(extension)),
    open: () => Promise.resolve({ info: { title: null }, events: [] }),
  };
}

describe('SourceRegistry', () => {
  const registry = new SourceRegistry([source('a', '.json'), source('b', '.txt')]);

  it('picks the first source that can handle the file', async () => {
    expect((await registry.find(inputFile('chat.txt', ''))).id).toBe('b');
  });

  it('rejects files no source can handle', async () => {
    await expect(registry.find(inputFile('chat.pdf', ''))).rejects.toBeInstanceOf(
      UnsupportedFileError,
    );
  });
});
