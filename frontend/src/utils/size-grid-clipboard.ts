/** Excel TSV: preserve quoted line breaks, empty cells and interior blank rows. */
export function parseSizeClipboard(text: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' && (quoted || cell === '')) {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (char === '\t' || char === '\n' || char === '\r')) {
      rows[rows.length - 1].push(cell)
      cell = ''
      if (char !== '\t') {
        if (char === '\r' && text[i + 1] === '\n') i++
        rows.push([])
      }
    } else cell += char
  }
  rows[rows.length - 1].push(cell)
  const last = rows[rows.length - 1]
  if (/[\r\n]$/.test(text) && last.length === 1 && last[0] === '') rows.pop()
  return rows
}

export function serializeSizeClipboard(rows: string[][]): string {
  return rows.map(row => row.map(value => /[\t\r\n"]/.test(value)
    ? `"${value.replace(/"/g, '""')}"` : value).join('\t')).join('\n')
}
