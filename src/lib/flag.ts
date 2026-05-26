// Flag URLs via flagcdn.com (supports ISO 3166-1 alpha-2 + GB subdivisions)
export function flagUrl(code: string | null | undefined, size: 40 | 80 | 160 = 40): string {
  if (!code) return "";
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}

export function flagSrcSet(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.toLowerCase();
  return `https://flagcdn.com/w40/${c}.png 1x, https://flagcdn.com/w80/${c}.png 2x`;
}
