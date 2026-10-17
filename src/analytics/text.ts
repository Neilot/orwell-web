const WORD = /[\p{L}\p{N}']+/gu;

/** Lower-cased words: runs of letters, digits and apostrophes in any script. */
export function words(text: string): string[] {
  return text.toLowerCase().match(WORD) ?? [];
}
