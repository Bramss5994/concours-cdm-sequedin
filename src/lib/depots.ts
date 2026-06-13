import logoSequedin from "@/assets/logo-sequedin.avif.asset.json";
import logoFaidherbe from "@/assets/logo-faidherbe.png.asset.json";
import logoWattrelos from "@/assets/logo-wattrelos.png.asset.json";
import logoPcBus from "@/assets/logo-pc-bus.png.asset.json";
import logoTram from "@/assets/logo-tram.jpg.asset.json";
import logoCopem from "@/assets/logo-copem.jpg.asset.json";
import logoSupport from "@/assets/logo-support.jpg.asset.json";

export type DepotValue =
  | "sequedin" | "faidherbe" | "wattrelos" | "pc_bus" | "tram" | "copem" | "support";

export const DEPOTS: { value: DepotValue; label: string; logo: string }[] = [
  { value: "sequedin", label: "Sequedin", logo: logoSequedin.url },
  { value: "faidherbe", label: "Faidherbe", logo: logoFaidherbe.url },
  { value: "wattrelos", label: "Wattrelos", logo: logoWattrelos.url },
  { value: "pc_bus", label: "PC Bus", logo: logoPcBus.url },
  { value: "tram", label: "Tram", logo: logoTram.url },
  { value: "copem", label: "COPEM", logo: logoCopem.url },
  { value: "support", label: "Équipe Support", logo: logoSupport.url },
];

export const DEPOT_LABEL: Record<string, string> = Object.fromEntries(
  DEPOTS.map((d) => [d.value, d.label]),
);
export const DEPOT_LOGO: Record<string, string> = Object.fromEntries(
  DEPOTS.map((d) => [d.value, d.logo]),
);
