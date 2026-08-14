import type { ReactNode } from 'react'

// A small, safe subset of Markdown for card descriptions: **bold**, *italic*,
// `code`, [text](url) (http/https only), "- " bullet lists, "1. " numbered
// lists, blank-line paragraphs. Builds React elements directly instead of an
// HTML string — no dangerouslySetInnerHTML, so there's no injection surface
// to sanitize regardless of what a user types.
const INLINE_PATTERN = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const [, bold, italic, code, linkText, linkUrl] = match
    const key = `${keyPrefix}-${i++}`
    if (bold !== undefined) nodes.push(<strong key={key}>{bold}</strong>)
    else if (italic !== undefined) nodes.push(<em key={key}>{italic}</em>)
    else if (code !== undefined) (
      nodes.push(
        <code key={key} className="rounded bg-border/50 px-1 py-0.5 font-mono text-[13px]">
          {code}
        </code>
      )
    )
    else if (linkText !== undefined && linkUrl !== undefined)
      nodes.push(
        <a key={key} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          {linkText}
        </a>
      )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderMarkdownLite(text: string): ReactNode {
  const blocks = text.split(/\n{2,}/)
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '')
        if (lines.length === 0) return null

        const isBulletList = lines.every((l) => /^[-*]\s+/.test(l))
        if (isBulletList) {
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }

        const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l))
        if (isNumberedList) {
          return (
            <ol key={bi} className="list-decimal space-y-0.5 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\d+\.\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ol>
          )
        }

        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}
