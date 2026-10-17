import type { MonthView, PersonView } from './month-view';

export type AwardKey =
  | 'nightOwl'
  | 'earlyBird'
  | 'mostReacted'
  | 'mostReplied'
  | 'iceBreaker'
  | 'fastest'
  | 'stickerKing'
  | 'voiceFan'
  | 'questioner'
  | 'laugher'
  | 'streak'
  | 'longest'
  | 'editor'
  | 'writer'
  | 'brief'
  | 'ghost';

/** A fun title given to one person of the month. */
export interface Award {
  readonly key: AwardKey;
  readonly person: PersonView;
  /** The winning figure: a share, a ratio, a count or milliseconds, depending on the award. */
  readonly value: number;
  /** A second figure for some awards: minutes of audio, or how many "ghosts" there are. */
  readonly extra?: number;
}

/** First item with the highest `score` (or the lowest, with `direction` -1), or null. */
function best<T>(items: readonly T[], score: (item: T) => number, direction = 1): T | null {
  if (items.length === 0) return null;
  return items.reduce((a, b) => (direction * score(b) > direction * score(a) ? b : a));
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * The group's awards for a month. Ratio awards only consider people with enough messages to be
 * meaningful: at least 10, or one in 300 of the month's messages in a busy group.
 */
export function computeAwards(view: MonthView): Award[] {
  const everyone = view.people;
  const writers = everyone.filter((p) => p.messages > 0);
  const minimum = Math.max(10, Math.round(view.totals.messages / 300));
  let active = everyone.filter((p) => p.messages >= minimum);
  if (active.length === 0) active = writers;
  const habits = (p: PersonView) => view.details(p.id).habits;
  const share = (p: PersonView, from: number, to: number): number =>
    sum(p.hours.slice(from, to)) / p.messages;
  const awards: Award[] = [];
  const add = (
    key: AwardKey,
    person: PersonView | null,
    value: (p: PersonView) => number,
    extra?: number,
  ): void => {
    if (person)
      awards.push({ key, person, value: value(person), ...(extra !== undefined && { extra }) });
  };

  const nightOwl = (p: PersonView) => share(p, 0, 5);
  add('nightOwl', best(active, nightOwl), nightOwl);
  const earlyBird = (p: PersonView) => share(p, 5, 9);
  add('earlyBird', best(active, earlyBird), earlyBird);
  const reacted = (p: PersonView) => p.reactionsReceived / p.messages;
  add('mostReacted', best(active, reacted), reacted);
  const replied = (p: PersonView) => p.repliesReceived / p.messages;
  add('mostReplied', best(active, replied), replied);
  const started = (p: PersonView) => habits(p)?.conversationsStarted ?? 0;
  add('iceBreaker', best(everyone, started), started);

  const fast = everyone.filter(
    (p) => view.details(p.id).replyCount >= Math.max(5, Math.round(minimum / 2)),
  );
  const replyMedian = (p: PersonView) => view.details(p.id).replyMedian ?? 0;
  add('fastest', best(fast, replyMedian, -1), replyMedian);

  const stickers = (p: PersonView) => p.kinds.sticker;
  const stickerKing = best(everyone, stickers);
  if (stickerKing && stickers(stickerKing)) add('stickerKing', stickerKing, stickers);
  const audios = (p: PersonView) => p.kinds.audio;
  const voiceFan = best(everyone, audios);
  if (voiceFan && audios(voiceFan)) {
    add('voiceFan', voiceFan, audios, Math.round(voiceFan.voiceSeconds / 60));
  }

  let texters = everyone.filter((p) => p.textMessages >= minimum);
  if (texters.length === 0) texters = everyone.filter((p) => p.textMessages > 0);
  if (texters.length === 0) texters = writers;
  const questions = (p: PersonView) => (habits(p)?.questions ?? 0) / p.textMessages;
  add('questioner', best(texters, questions), questions);
  const laughs = (p: PersonView) => habits(p)?.laughs ?? 0;
  add('laugher', best(everyone, laughs), laughs);
  const streak = (p: PersonView) => habits(p)?.streak ?? 0;
  add('streak', best(everyone, streak), streak);
  const longest = (p: PersonView) => habits(p)?.longest?.length ?? 0;
  add('longest', best(everyone, longest), longest);
  const edited = (p: PersonView) => habits(p)?.edited ?? 0;
  const editor = best(everyone, edited);
  if (editor && edited(editor)) add('editor', editor, edited);
  const wordsPerMessage = (p: PersonView) => p.words / p.textMessages;
  add('writer', best(texters, wordsPerMessage), wordsPerMessage);
  add('brief', best(texters, wordsPerMessage, -1), wordsPerMessage);

  const ghosts = everyone.filter((p) => p.messages === 0 && p.reactionsSent > 0);
  const reactionsSent = (p: PersonView) => p.reactionsSent;
  if (ghosts.length) add('ghost', best(ghosts, reactionsSent), reactionsSent, ghosts.length);
  return awards;
}
