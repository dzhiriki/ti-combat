/**
 * Rewrite an inline SVG string's internal `id` definitions and their
 * `url(#...)` / `href="#..."` references with a unique prefix.
 *
 * The faction SVGs each define ids like `a`, `b`, `c` for their clipPaths.
 * Inlining several of them into one document makes every `url(#a)` resolve to
 * the FIRST `id="a"` in the DOM — icons render clipped by another icon's
 * shapes. Namespacing per rendered instance keeps references local.
 */
export function namespaceSvgIds(svg: string, prefix: string): string {
  const safe = prefix.replace(/[^a-zA-Z0-9_-]/g, '')
  return svg
    .replaceAll(/\bid="([^"]+)"/g, `id="${safe}-$1"`)
    .replaceAll(/url\(#([^)]+)\)/g, `url(#${safe}-$1)`)
    .replaceAll(/\b((?:xlink:)?href)="#([^"]+)"/g, `$1="#${safe}-$2"`)
}
