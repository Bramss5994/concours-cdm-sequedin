import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "danger" | "dark" | "success";

const VARIANTS: Record<Variant, { face: string; side: string; text: string; ring: string }> = {
  primary: {
    face: "bg-gradient-to-b from-[#7B2CBF] to-[#5b1e96]",
    side: "bg-[#3a1361]",
    text: "text-white",
    ring: "ring-white/20",
  },
  gold: {
    face: "bg-gradient-to-b from-[#FFE066] via-[#FFD100] to-[#E6A800]",
    side: "bg-[#8c5a0f]",
    text: "text-[#3a1f00]",
    ring: "ring-amber-900/30",
  },
  danger: {
    face: "bg-gradient-to-b from-[#FF4D5E] to-[#E4002B]",
    side: "bg-[#8a0019]",
    text: "text-white",
    ring: "ring-white/20",
  },
  dark: {
    face: "bg-gradient-to-b from-[#2a2a35] to-[#0e0e15]",
    side: "bg-black",
    text: "text-white",
    ring: "ring-white/15",
  },
  success: {
    face: "bg-gradient-to-b from-[#34D399] to-[#00A86B]",
    side: "bg-[#005c3a]",
    text: "text-white",
    ring: "ring-white/20",
  },
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button3D = forwardRef<HTMLButtonElement, Props>(function Button3D(
  { variant = "primary", size = "md", leftIcon, rightIcon, className, children, disabled, ...rest },
  ref,
) {
  const v = VARIANTS[variant];
  const padding =
    size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm";
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "group relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-wider transition-transform duration-100 active:translate-y-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        padding,
        v.text,
        className,
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
      {...rest}
    >
      {/* Bottom side / shadow layer */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl",
          v.side,
          "translate-y-[3px] shadow-[0_4px_0_rgba(0,0,0,0.35)] transition-transform duration-100 group-active:translate-y-[1px]",
        )}
      />
      {/* Top face */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl ring-1",
          v.face,
          v.ring,
          "shadow-[inset_0_1px_0_rgba(255,255,255,.4),inset_0_-2px_0_rgba(0,0,0,.18)]",
        )}
      />
      {/* Gloss highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-t-lg bg-gradient-to-b from-white/40 to-transparent opacity-70"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  );
});
