export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/brand/revollution-mark.png" alt="" aria-hidden="true" className={`rounded-full ${className}`} />
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-primary">
        Revollution
      </span>
    </span>
  )
}
