import type { FileViewerProps } from 'dsh-better-sidebar'

/** Parse CSV text into rows (RFC4180-ish; enough for Abaqus result exports). */
function parseCsv(text: string): string[][] {
  if (!text) return []
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') { inQuotes = true }
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field); if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

/** A minimal CSV grid viewer, following the FileViewer custom/fsRead contract. */
export function CsvGrid({ content, path }: Pick<FileViewerProps, 'content' | 'path'> & Partial<FileViewerProps>) {
  const rows = parseCsv(content ?? '')
  const header = rows[0] ?? []
  const body = rows.slice(1)
  return (
    <div style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{path ?? 'Abaqus CSV'}</div>
      {rows.length === 0 ? (
        <div style={{ opacity: 0.6 }}>空文件 / 无内容</div>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {header.map((h, i) => (
                <th key={i} style={{ border: '1px solid #8884', padding: '2px 4px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.slice(0, 200).map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} style={{ border: '1px solid #8883', padding: '2px 4px' }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {body.length > 200 && <div style={{ opacity: 0.6, marginTop: 4 }}>… 仅显示前 200 行（共 {body.length} 行）</div>}
    </div>
  )
}
