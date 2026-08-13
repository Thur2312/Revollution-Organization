const tones = ['bg-accent/20', 'bg-primary/10', 'bg-background border border-border']

const columns = [
  { offset: '', weights: [2, 1, 3] },
  { offset: 'mt-9', weights: [3, 2] },
  { offset: '', weights: [1, 1, 2, 1] },
]

export function BoardGlyph({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`grid grid-cols-3 gap-3 rounded-xl border border-border bg-surface p-5 ${className}`}
    >
      {columns.map((col, i) => (
        <div key={i} className={`flex h-full flex-col gap-2.5 ${col.offset}`}>
          {col.weights.map((w, j) => (
            <div
              key={j}
              style={{ flexGrow: w }}
              className={`min-h-0 w-full rounded-lg ${tones[(i + j) % tones.length]}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
