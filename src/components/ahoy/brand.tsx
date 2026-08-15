export function AhoyMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/favicon.png"
      alt="AHOY logo"
      width={size}
      height={size}
      className="rounded-2xl ring-1 ring-gold/30 shadow-[0_10px_30px_-12px_oklch(0_0_0/0.8)]"
      style={{ width: size, height: size }}
    />
  );
}

export function AhoyWordmark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex items-center gap-3">
      <AhoyMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-[0.28em] text-tide">
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
