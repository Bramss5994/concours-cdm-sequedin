// Couleurs principales (primaire/secondaire) par code pays ISO, pour
// styliser les cartes "équipe choisie" aux couleurs de l'équipe.
export type TeamPalette = { primary: string; secondary: string; accent?: string };

const PALETTES: Record<string, TeamPalette> = {
  fr: { primary: "#0055A4", secondary: "#FFFFFF", accent: "#EF4135" },
  ar: { primary: "#74ACDF", secondary: "#FFFFFF", accent: "#F6B40E" },
  br: { primary: "#009C3B", secondary: "#FFDF00", accent: "#002776" },
  de: { primary: "#000000", secondary: "#DD0000", accent: "#FFCE00" },
  es: { primary: "#AA151B", secondary: "#F1BF00" },
  pt: { primary: "#006600", secondary: "#FF0000" },
  it: { primary: "#0066CC", secondary: "#FFFFFF", accent: "#009246" },
  nl: { primary: "#FF6900", secondary: "#21468B" },
  be: { primary: "#000000", secondary: "#FAE042", accent: "#ED2939" },
  en: { primary: "#FFFFFF", secondary: "#CE1124", accent: "#1D3D8F" },
  gb: { primary: "#012169", secondary: "#FFFFFF", accent: "#C8102E" },
  uk: { primary: "#012169", secondary: "#FFFFFF", accent: "#C8102E" },
  us: { primary: "#3C3B6E", secondary: "#FFFFFF", accent: "#B22234" },
  mx: { primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126" },
  ca: { primary: "#FF0000", secondary: "#FFFFFF" },
  jp: { primary: "#BC002D", secondary: "#FFFFFF" },
  kr: { primary: "#003478", secondary: "#C60C30", accent: "#FFFFFF" },
  sa: { primary: "#006C35", secondary: "#FFFFFF" },
  ir: { primary: "#239F40", secondary: "#FFFFFF", accent: "#DA0000" },
  qa: { primary: "#8A1538", secondary: "#FFFFFF" },
  ma: { primary: "#C1272D", secondary: "#006233" },
  sn: { primary: "#00853F", secondary: "#FDEF42", accent: "#E31B23" },
  tn: { primary: "#E70013", secondary: "#FFFFFF" },
  eg: { primary: "#CE1126", secondary: "#000000", accent: "#FFFFFF" },
  ci: { primary: "#FF8200", secondary: "#FFFFFF", accent: "#009E60" },
  gh: { primary: "#CE1126", secondary: "#FCD116", accent: "#006B3F" },
  ng: { primary: "#008751", secondary: "#FFFFFF" },
  cm: { primary: "#007A5E", secondary: "#CE1126", accent: "#FCD116" },
  dz: { primary: "#006233", secondary: "#FFFFFF", accent: "#D21034" },
  au: { primary: "#00843D", secondary: "#FFD100" },
  ch: { primary: "#DA291C", secondary: "#FFFFFF" },
  hr: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#171796" },
  rs: { primary: "#C6363C", secondary: "#0C4076", accent: "#FFFFFF" },
  pl: { primary: "#DC143C", secondary: "#FFFFFF" },
  dk: { primary: "#C8102E", secondary: "#FFFFFF" },
  no: { primary: "#BA0C2F", secondary: "#FFFFFF", accent: "#00205B" },
  se: { primary: "#006AA7", secondary: "#FECC00" },
  uy: { primary: "#7CB9E8", secondary: "#FFFFFF", accent: "#001489" },
  co: { primary: "#FCD116", secondary: "#003893", accent: "#CE1126" },
  ec: { primary: "#FFD100", secondary: "#0072CE", accent: "#ED1C24" },
  pe: { primary: "#D91023", secondary: "#FFFFFF" },
  cl: { primary: "#0033A0", secondary: "#FFFFFF", accent: "#DA291C" },
  py: { primary: "#D52B1E", secondary: "#FFFFFF", accent: "#0038A8" },
  ve: { primary: "#FFCC00", secondary: "#00247D", accent: "#CF142B" },
  cr: { primary: "#002B7F", secondary: "#FFFFFF", accent: "#CE1126" },
  jm: { primary: "#009B3A", secondary: "#000000", accent: "#FED100" },
  pa: { primary: "#005AA7", secondary: "#FFFFFF", accent: "#D21034" },
  nz: { primary: "#000000", secondary: "#FFFFFF" },
};

const DEFAULT: TeamPalette = { primary: "#7B2CBF", secondary: "#00A3E0", accent: "#FFD100" };

export function teamPalette(code?: string | null): TeamPalette {
  if (!code) return DEFAULT;
  return PALETTES[code.toLowerCase()] || DEFAULT;
}

export function teamGradient(code?: string | null): string {
  const p = teamPalette(code);
  return `linear-gradient(135deg, ${p.primary} 0%, ${p.secondary} 60%, ${p.accent || p.primary} 100%)`;
}
