// Helpers over ChatEvent.localTime (`YYYY-MM-DDTHH:mm:ss`, the export's wall clock).

/** `YYYY-MM`. */
export function monthOf(localTime: string): string {
  return localTime.slice(0, 7);
}

/** Key of the whole export, kept next to the `YYYY-MM` months in every per-month result. */
export const WHOLE_FILE = 'all';

/** The periods an event counts in: its own month and the whole export. */
export function periodsOf(localTime: string): readonly [string, string] {
  return [monthOf(localTime), WHOLE_FILE];
}

/** `YYYY-MM-DD`. */
export function dayOf(localTime: string): string {
  return localTime.slice(0, 10);
}

/** 0–23. */
export function hourOf(localTime: string): number {
  return Number(localTime.slice(11, 13));
}

/** 0 = Monday … 6 = Sunday, for a `YYYY-MM-DD…` string. */
export function weekdayOf(localTime: string): number {
  const date = Date.UTC(
    Number(localTime.slice(0, 4)),
    Number(localTime.slice(5, 7)) - 1,
    Number(localTime.slice(8, 10)),
  );
  return (new Date(date).getUTCDay() + 6) % 7;
}

/** Gets the value for `key`, creating it first when missing. */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

/** Adds one to `counts[index]`. */
export function increment(counts: number[], index: number): void {
  counts[index] = (counts[index] ?? 0) + 1;
}
