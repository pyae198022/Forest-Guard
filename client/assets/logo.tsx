/** ForestGuard shield logo — layered SVG with forest-green gradient. */

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="fg-grad" x1="6" y1="4" x2="42" y2="44">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path
        d="M24 3L41 9.5V22c0 10.5-7.2 19.4-17 23C14.2 41.4 7 32.5 7 22V9.5L24 3z"
        fill="url(#fg-grad)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
      />
      <path
        d="M24 12l7.5 10.5h-4.3l5.8 8.2h-6.3V36h-5.4v-5.3h-6.3l5.8-8.2h-4.3L24 12z"
        fill="rgba(6,44,32,0.75)"
      />
      <circle cx="24" cy="24" r="17.5" stroke="rgba(255,255,255,0.14)" strokeWidth="1" fill="none" />
    </svg>
  );
}

/** Subtle leaf-grid backdrop used in hero sections. */
export function LeafPattern({ className = "" }: { className?: string }) {
  return (
    <svg className={className} aria-hidden width="220" height="120" viewBox="0 0 220 120" fill="none">
      {Array.from({ length: 24 }).map((_, i) => (
        <path
          key={i}
          d={`M${14 + (i % 8) * 28} ${18 + Math.floor(i / 8) * 36}
              q8 -10 16 0 q-8 10 -16 0z`}
          fill="rgba(52,211,153,0.10)"
        />
      ))}
    </svg>
  );
}
