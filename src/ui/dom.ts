const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an HTML element with optional class and text. Text is set with `textContent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Creates an SVG element with the given attributes. */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}
