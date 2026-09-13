/**
 * Normalize model output so react-markdown + KaTeX can render it well.
 * Models often emit LaTeX inside [ ... ] or ( \command ... ) instead of $ / $$.
 */

function looksLikeLatex(s: string): boolean {
  const t = String(s || '').trim()
  if (!t) return false
  if (/\\[a-zA-Z]+/.test(t)) return true
  if (/[_^{}]/.test(t) && /[=+\-*/]|\\|,/.test(t)) return true
  if (
    /\\text|\\mathbf|\\mathrm|\\ldots|\\dots|\\rightarrow|\\Rightarrow|\\leftrightarrow|\\in\b|\\to\b/.test(
      t,
    )
  ) {
    return true
  }
  if (
    /^[A-Za-z0-9\\{}()[\]_^=+\-*/,.\s\\]+$/.test(t) &&
    /[=_]/.test(t) &&
    t.length <= 120
  ) {
    return true
  }
  return false
}

function mapOutsideMath(text: string, transform: (segment: string) => string): string {
  const parts = String(text).split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part
      return transform(part)
    })
    .join('')
}

export function normalizeAiMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return ''

  let out = text.replace(/\r\n/g, '\n')

  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`)
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, inner: string) => `\n$$\n${inner.trim()}\n$$\n`)

  out = out.replace(/^[ \t]*\[\s*([^\n\]]+?)\s*\][ \t]*$/gm, (full, inner: string) => {
    if (!looksLikeLatex(inner)) return full
    return `\n$$\n${inner.trim()}\n$$\n`
  })

  out = mapOutsideMath(out, (segment) =>
    segment.replace(
      /\((\\[a-zA-Z]+\{[^}]*\}[^)\n]{0,80}|[^()\n]{0,40}\\[a-zA-Z]+[^)\n]{0,40})\)/g,
      (full, inner: string) => {
        if (!looksLikeLatex(inner)) return full
        if (/^\s*[0-9a-zA-Z]\s*$/.test(inner)) return full
        return `$${inner.trim()}$`
      },
    ),
  )

  out = out.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2')
  out = out.replace(/([^\n])\n([-*+] |\d+\. )/g, '$1\n\n$2')

  out = mapOutsideMath(out, (segment) =>
    segment.replace(/^[ \t]*\(([A-Za-z][A-Za-z0-9_]*)\)\s*:\s+/gm, '- **($1)**: '),
  )

  out = out.replace(/^[ \t]*(\$[^$\n]+\$)\s*:\s+/gm, '- $1: ')

  out = out.replace(/\n{3,}/g, '\n\n')

  return out.trim()
}
