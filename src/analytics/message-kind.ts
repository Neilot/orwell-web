import type { ChatEvent } from '../core';

/** The message types shown in the dashboard, in display order. */
export const MESSAGE_KINDS = [
  'text',
  'photo',
  'sticker',
  'audio',
  'video',
  'gif',
  'video-note',
  'file',
  'poll',
  'other',
] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

/**
 * Groups a chat event into a dashboard message type. Voice notes and audio files count as
 * audio; a message with no media and no text (e.g. a shared location) is "other".
 */
export function messageKind(event: ChatEvent): MessageKind {
  switch (event.kind) {
    case 'sticker':
    case 'photo':
    case 'video':
    case 'gif':
    case 'video-note':
    case 'file':
    case 'poll':
      return event.kind;
    case 'voice':
    case 'audio':
      return 'audio';
    default:
      return event.text ? 'text' : 'other';
  }
}
