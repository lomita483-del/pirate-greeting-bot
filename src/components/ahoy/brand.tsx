import { Anchor } from "lucide-react";

export function AhoyMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-gold/20 ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      <Anchor className="text-primary" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

export function AhoyWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-3">
      <AhoyMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-[0.28em] text-foreground">
          AHOY
        </span>
        {subtitle ? (
          <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
