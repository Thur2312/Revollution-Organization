// Icon-only mark — reserved for spots too small for the full lockup
// (favicon, the collapsed sidebar rail).
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/brand/revollution-mark.png" alt="" aria-hidden="true" className={`rounded-full ${className}`} />
}

// The complete brand lockup (icon + "REVOLLUTION" + "MARCAS E PATENTES"),
// cropped straight from the official logo file — use this everywhere there's
// room for it instead of pairing LogoMark with hand-typeset text.
export function Logo({ className = 'h-9' }: { className?: string }) {
  return (
    <img
      src="/brand/revollution-logo-full.png"
      alt="Revollution — Marcas e Patentes"
      className={`w-auto ${className}`}
    />
  )
}
