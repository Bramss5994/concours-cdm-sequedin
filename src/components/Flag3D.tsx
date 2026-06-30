import { flagUrl, flagSrcSet } from "@/lib/flag";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { wrap: string; img: number }> = {
  xs: { wrap: "h-5 w-7", img: 40 },
  sm: { wrap: "h-7 w-10", img: 40 },
  md: { wrap: "h-9 w-14", img: 80 },
  lg: { wrap: "h-12 w-[72px]", img: 80 },
  xl: { wrap: "h-16 w-24", img: 160 },
};

interface Props {
  code?: string | null;
  name?: string;
  size?: Size;
  className?: string;
  rounded?: "md" | "lg" | "full";
}

/**
 * 3D-styled team flag: layered shadow, gradient ring, inner shine and
 * a subtle highlight to give a "badge" feel consistent with the WC2026 design.
 */
export function Flag3D({ code, name, size = "md", className, rounded = "md" }: Props) {
  const s = SIZES[size];
  const radius = rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-xl" : "rounded-md";

  if (!code) {
    return (
      <div
        className={cn(
          s.wrap,
          radius,
          "flex items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-sm shadow-md ring-1 ring-black/10",
          className,
        )}
        aria-label={name || "Équipe"}
      >
        🏳️
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative inline-block shrink-0",
        s.wrap,
        radius,
        "shadow-[0_4px_10px_-2px_rgba(0,0,0,0.35),0_2px_4px_-1px_rgba(0,0,0,0.2)]",
        "ring-1 ring-black/15",
        "transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.04]",
        className,
      )}
      title={name}
    >
      <img
        src={flagUrl(code, s.img as 40 | 80 | 160)}
        srcSet={flagSrcSet(code)}
        alt={name ? `Drapeau ${name}` : ""}
        loading="lazy"
        className={cn("h-full w-full object-cover", radius)}
      />
      {/* Glossy top highlight */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          radius,
          "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.1)_35%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.18)_100%)]",
        )}
      />
      {/* Inner stroke */}
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/30", radius)}
      />
    </div>
  );
}

export default Flag3D;
