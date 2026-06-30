// Flag URLs via flagcdn.com (supports ISO 3166-1 alpha-2 + GB subdivisions)
export type FlagSize = 20 | 40 | 80 | 160 | 320 | 640 | 1280 | 2560;

export function flagUrl(code: string | null | undefined, size: FlagSize = 160): string {
  if (!code) return "";
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}

/**
 * High-DPI srcSet. `base` is the 1x CSS pixel size; we serve 2x and 3x variants.
 */
export function flagSrcSet(code: string | null | undefined, base: FlagSize = 160): string {
  if (!code) return "";
  const c = code.toLowerCase();
  const ladder: FlagSize[] = [20, 40, 80, 160, 320, 640, 1280, 2560];
  const idx = ladder.indexOf(base);
  const s2 = ladder[Math.min(idx + 1, ladder.length - 1)];
  const s3 = ladder[Math.min(idx + 2, ladder.length - 1)];
  return `https://flagcdn.com/w${base}/${c}.png 1x, https://flagcdn.com/w${s2}/${c}.png 2x, https://flagcdn.com/w${s3}/${c}.png 3x`;
}
