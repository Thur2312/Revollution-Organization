const labelPalette = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-slate-100 text-slate-700',
]

export function labelColor(label: string) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash + label.charCodeAt(i)) % labelPalette.length
  return labelPalette[hash]
}
