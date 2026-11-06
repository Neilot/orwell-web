import type { Dashboard } from './worker-protocol';

/** A chat already analysed, published so a link opens it without its export. */
export interface SharedChat {
  readonly dashboard: Dashboard;
  /** The period the link opens on. */
  readonly month: string;
}

/** What a link carries: which file to fetch and the key that opens it. */
export interface ChatLink {
  readonly id: string;
  readonly key: Uint8Array<ArrayBuffer>;
}

const KEY_BYTES = 32;
const IV_BYTES = 12;
const ID_BYTES = 12;
const ID_PATTERN = /^[\w-]{16}$/;

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function aesKey(key: Uint8Array<ArrayBuffer>, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, [usage]);
}

export function newSharedLink(): ChatLink {
  return {
    id: toBase64Url(crypto.getRandomValues(new Uint8Array(ID_BYTES))),
    key: crypto.getRandomValues(new Uint8Array(KEY_BYTES)),
  };
}

/** The fragment of a link. Browsers never send it to the server, so the key stays with the link. */
export function sharedLinkHash(link: ChatLink): string {
  return `#g=${link.id}&k=${toBase64Url(link.key)}`;
}

/** Reads a link's fragment; `null` when it is not a shared link. */
export function parseSharedLink(hash: string): ChatLink | null {
  const params = new URLSearchParams(hash.slice(1));
  const id = params.get('g');
  const key = params.get('k');
  if (id === null || key === null || !ID_PATTERN.test(id)) return null;
  try {
    const bytes = fromBase64Url(key);
    return bytes.length === KEY_BYTES ? { id, key: bytes } : null;
  } catch {
    return null;
  }
}

/** Compresses and encrypts a chat: the random IV first, then the AES-GCM ciphertext. */
export async function sealChat(
  chat: SharedChat,
  key: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const json = new TextEncoder().encode(JSON.stringify(chat));
  const compressed = await pipe(json, new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(key, 'encrypt'),
    compressed,
  );
  const sealed = new Uint8Array(IV_BYTES + encrypted.byteLength);
  sealed.set(iv);
  sealed.set(new Uint8Array(encrypted), IV_BYTES);
  return sealed;
}

/** Rejects when the key is not the one the chat was sealed with, or the file was altered. */
export async function openChat(
  sealed: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
): Promise<SharedChat> {
  const compressed = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.subarray(0, IV_BYTES) },
    await aesKey(key, 'decrypt'),
    sealed.subarray(IV_BYTES),
  );
  const json = await pipe(new Uint8Array(compressed), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(json)) as SharedChat;
}

/** Downloads and opens the chat a link points to. Published chats live in `shared/` on the site. */
export async function loadSharedChat(link: ChatLink, baseUrl: string): Promise<SharedChat> {
  const response = await fetch(`${baseUrl}shared/${link.id}.bin`);
  if (!response.ok) throw new Error(`Shared chat not found: ${String(response.status)}`);
  return openChat(new Uint8Array(await response.arrayBuffer()), link.key);
}
