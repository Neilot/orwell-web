const WORD = /[\p{L}\p{N}']+/gu;
/** One emoji, joined sequences and variation selectors included. */
export const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;
/** A laugh in Spanish or English: "jaja", "jejeje", "haha", "lol", "lmao". */
export const LAUGH = /^(?:(?:j[aeiou]){2,}j?|(?:h[aeiou]){2,}h?|lo+l|lmf?a+o+)$/;
/** A web address, up to the next space. */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/giu;
/** "@username", as Telegram allows them; not when glued to a word, like in an e-mail. */
const MENTION = /(?<![\p{L}\p{N}_])@[A-Za-z0-9_]{3,32}/gu;
const HASHTAG = /(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+/gu;
/** Punctuation that ends a sentence rather than the link. */
const LINK_TAIL = /[).,!?;:'"]+$/;

/** Domains that are the same site: short sharing links and the copies that fix previews. */
const SITE_ALIASES: Readonly<Record<string, string>> = {
  'youtu.be': 'youtube.com',
  'm.youtube.com': 'youtube.com',
  'music.youtube.com': 'youtube.com',
  'vt.tiktok.com': 'tiktok.com',
  'vm.tiktok.com': 'tiktok.com',
  'm.tiktok.com': 'tiktok.com',
  'twitter.com': 'x.com',
  'mobile.twitter.com': 'x.com',
  'fixupx.com': 'x.com',
  'fxtwitter.com': 'x.com',
  'vxtwitter.com': 'x.com',
  'fixvx.com': 'x.com',
  'twittpr.com': 'x.com',
  'm.facebook.com': 'facebook.com',
  'web.facebook.com': 'facebook.com',
  'fb.watch': 'facebook.com',
  'fb.com': 'facebook.com',
  'instagr.am': 'instagram.com',
  'ddinstagram.com': 'instagram.com',
  'telegram.me': 't.me',
  'telegram.dog': 't.me',
  'open.spotify.com': 'spotify.com',
  'spotify.link': 'spotify.com',
  'redd.it': 'reddit.com',
  'old.reddit.com': 'reddit.com',
  'vxreddit.com': 'reddit.com',
};

/** Query parameters that apps add when sharing and that do not change where a link goes. */
const TRACKING =
  /^(?:utm_.*|si|igsh|igshid|fbclid|gclid|feature|t|s|ref|ref_src|share_id|_r|is_from_webapp|sender_device|mibextid|rdid|share_url)$/i;

function parse(link: string): URL | null {
  try {
    return new URL(/^www\./i.test(link) ? `http://${link}` : link);
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** The site a link points to, lower case, without "www." and with aliases joined, or `null`. */
function site(url: URL): string | null {
  const host = hostOf(url);
  return host ? (SITE_ALIASES[host] ?? host) : null;
}

/**
 * A link ready to be counted: without "https://", "www.", tracking codes, the anchor or the
 * trailing slash, so the same link shared from two apps counts once.
 */
function cleanLink(url: URL): string {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  const query = url.searchParams.toString();
  const path = url.pathname.replace(/\/+$/, '');
  return `${hostOf(url)}${path}${query ? `?${query}` : ''}`.replace(/%40/g, '@');
}

/** Each link in a text as `[site, cleaned link]`. */
export function links(text: string): [string, string][] {
  const found: [string, string][] = [];
  for (const raw of text.match(LINK) ?? []) {
    const url = parse(raw.replace(LINK_TAIL, ''));
    const host = url && site(url);
    if (url && host) found.push([host, cleanLink(url)]);
  }
  return found;
}

/**
 * Lower-cased words. A link counts once, as its site ("youtube.com", with "youtu.be" joined to
 * it); an "@username" and a "#tag" stay whole; everything else is runs of letters, digits and
 * apostrophes in any script.
 */
export function words(text: string): string[] {
  const special: string[] = [];
  const rest = text
    .replace(LINK, (link) => {
      const url = parse(link.replace(LINK_TAIL, ''));
      const host = url && site(url);
      if (host) special.push(host);
      return ' ';
    })
    .replace(MENTION, (mention) => {
      special.push(mention.toLowerCase());
      return ' ';
    })
    .replace(HASHTAG, (tag) => {
      special.push(tag.toLowerCase());
      return ' ';
    });
  return [...special, ...(rest.toLowerCase().match(WORD) ?? [])];
}
