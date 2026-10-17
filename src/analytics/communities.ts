/** Small seeded PRNG (mulberry32), so community detection gives the same result every run. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index of the "everyone else" group: communities beyond the five largest, or under 3 people. */
export const OTHER_COMMUNITY = 5;

/**
 * Groups people who interact mostly with each other, using local moving of the Louvain method
 * on the symmetrised interaction counts (`weights[a][b]` = interactions from a to b). Returns,
 * per person, 0–4 for the five largest communities with at least three people, or
 * `OTHER_COMMUNITY`. The visiting order is shuffled with a fixed seed so results are stable.
 */
export function detectCommunities(weights: readonly (readonly number[])[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const w = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    for (let j = 0; j < n; j++) row[j] = (weights[i]?.[j] ?? 0) + (weights[j]?.[i] ?? 0);
    return row;
  });
  const degree = w.map((row) => row.reduce((a, b) => a + b));
  const twiceTotal = degree.reduce((a, b) => a + b) || 1;
  const community = Array.from({ length: n }, (_, i) => i);
  const communityDegree = degree.slice();
  const random = seededRandom(7);

  for (let pass = 0; pass < 20; pass++) {
    let moved = 0;
    const order = Array.from({ length: n }, (_, i) => i).sort(() => random() - 0.5);
    for (const i of order) {
      const own = community[i] ?? i;
      const ki = degree[i] ?? 0;
      communityDegree[own] = (communityDegree[own] ?? 0) - ki;
      const links = new Map<number, number>();
      const row = w[i];
      for (let j = 0; j < n; j++) {
        const weight = row?.[j] ?? 0;
        if (weight > 0 && j !== i) {
          const c = community[j] ?? j;
          links.set(c, (links.get(c) ?? 0) + weight);
        }
      }
      let best = own;
      let bestGain = (links.get(own) ?? 0) - ((communityDegree[own] ?? 0) * ki) / twiceTotal;
      for (const [c, weight] of links) {
        const gain = weight - ((communityDegree[c] ?? 0) * ki) / twiceTotal;
        if (gain > bestGain) {
          bestGain = gain;
          best = c;
        }
      }
      community[i] = best;
      communityDegree[best] = (communityDegree[best] ?? 0) + ki;
      if (best !== own) moved++;
    }
    if (!moved) break;
  }

  const size = new Map<number, number>();
  for (const c of community) size.set(c, (size.get(c) ?? 0) + 1);
  const rank = [...size.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return community.map((c) => {
    const r = rank.indexOf(c);
    return r < OTHER_COMMUNITY && (size.get(c) ?? 0) >= 3 ? r : OTHER_COMMUNITY;
  });
}
