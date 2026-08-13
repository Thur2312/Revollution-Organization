const palette = [
  'bg-primary text-primary-foreground',
  'bg-accent text-accent-foreground',
  'bg-surface text-primary border border-border',
]

function hashName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % palette.length
  return hash
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function Avatar({
  name,
  size = 22,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${palette[hashName(name)]} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
    >
      {initialsOf(name)}
    </span>
  )
}
