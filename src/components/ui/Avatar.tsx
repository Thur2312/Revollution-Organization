// A wider set of tints/shades derived from the two brand hues (vinho
// #430f1c, dourado #c9a26b) plus a couple of warm neutrals in between —
// more per-person variety than the old 3-bucket flat palette, without
// introducing hues outside the brand's warm wine/gold family.
const palette: { from: string; to: string; fg: string }[] = [
  { from: '#5c1f30', to: '#430f1c', fg: '#ffffff' }, // vinho
  { from: '#d8b280', to: '#c9a26b', fg: '#2b0a15' }, // dourado
  { from: '#7a3347', to: '#5c1f30', fg: '#ffffff' }, // vinho médio
  { from: '#b98a5f', to: '#a3814f', fg: '#2b0a15' }, // dourado escuro
  { from: '#8a5a3f', to: '#6b4128', fg: '#ffffff' }, // terracota
  { from: '#6b5142', to: '#4a3728', fg: '#ffffff' }, // marrom quente
]

function hashName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % palette.length
  return hash
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function Avatar({
  name,
  imageUrl,
  size = 22,
  className = '',
}: {
  name: string
  imageUrl?: string | null
  size?: number
  className?: string
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        title={name}
        className={`inline-block shrink-0 rounded-full object-cover shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_rgba(43,10,21,0.25)] ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  const tone = palette[hashName(name)]
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_rgba(43,10,21,0.25)] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
        background: `linear-gradient(150deg, ${tone.from}, ${tone.to})`,
        color: tone.fg,
      }}
    >
      {initialsOf(name)}
    </span>
  )
}
