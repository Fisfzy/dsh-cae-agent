/**
 * Abaqus CSV viewer (feature ⑤) — an enhanced grid for result exports.
 *
 *   - RFC4180-ish parser (quoted fields, escaped quotes, CRLF)
 *   - 数值列自动检测（整列可解析为有限数）
 *   - 表头点击排序（数值/字符串分别比较，升降切换）
 *   - 列显示开关（勾选显隐列）
 *   - 分页（默认 50 行/页，替代旧的"只显示前 200 行"）
 *   - 选中数值列时渲染 inline SVG sparkline 趋势
 *   - 主题走 theme.ts CSS 变量
 */

import { useMemo, useState, type CSSProperties } from 'react'
import type { FileViewerProps } from 'dsh-better-sidebar'
import { ensureCaeStyles } from './theme.js'
import { IconChevron } from './icons.js'

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
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

function isNum(s: string): boolean {
  if (s === '') return false
  const n = Number(s)
  return Number.isFinite(n)
}

function Sparkline({ values, width = 240, height = 44 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ fontSize: 11, color: 'var(--cae-muted)' }}>数据点不足，无法绘制趋势</div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block', background: 'var(--cae-inset)', borderRadius: 'var(--cae-radius-sm)' }}>
      <polyline points={pts} fill="none" stroke="var(--cae-accent)" strokeWidth={1.6} />
      <text x={4} y={11} fontSize={9} fill="var(--cae-faint)">
        max {max}
      </text>
      <text x={4} y={height - 3} fontSize={9} fill="var(--cae-faint)">
        min {min}
      </text>
    </svg>
  )
}

const PAGE_SIZE = 50

export function CsvGrid({ content, path }: Pick<FileViewerProps, 'content' | 'path'> & Partial<FileViewerProps>) {
  ensureCaeStyles()
  const rows = useMemo(() => parseCsv(content ?? ''), [content])
  const header = rows[0] ?? []
  const body = useMemo(() => rows.slice(1), [rows])

  const numeric = useMemo(() => header.map((_, ci) => body.length > 0 && body.every((r) => r[ci] === '' || isNum(r[ci]))), [header, body])

  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [sparkCol, setSparkCol] = useState<number | null>(null)

  const sorted = useMemo(() => {
    if (sortCol === null) return body
    const isNumeric = numeric[sortCol]
    const copy = [...body]
    copy.sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      let cmp: number
      if (isNumeric) cmp = (Number(av) || 0) - (Number(bv) || 0)
      else cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [body, sortCol, sortDir, numeric])

  const visibleCols = useMemo(() => header.map((_, i) => i).filter((i) => !hidden.has(i)), [header, hidden])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const cur = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE)

  const sparkValues = useMemo(() => {
    if (sparkCol === null || !numeric[sparkCol]) return null
    return sorted.map((r) => Number(r[sparkCol])).filter((n) => Number.isFinite(n))
  }, [sparkCol, sorted, numeric])

  const toggleSort = (ci: number) => {
    if (sortCol === ci) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(ci)
      setSortDir('asc')
    }
    setPage(0)
  }
  const toggleCol = (ci: number) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(ci)) next.delete(ci)
      else next.add(ci)
      return next
    })
  }

  const th: CSSProperties = {
    border: '1px solid var(--cae-border)',
    padding: '4px 6px',
    textAlign: 'left',
    fontWeight: 600,
    background: 'var(--cae-inset)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
  }
  const td: CSSProperties = {
    border: '1px solid var(--cae-border)',
    padding: '3px 6px',
    whiteSpace: 'nowrap',
  }

  return (
    <div className="cae-root" style={{ padding: '10px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, wordBreak: 'break-all' }}>{path ?? 'Abaqus CSV'}</div>
      <div style={{ fontSize: 11, color: 'var(--cae-muted)', marginBottom: 8 }}>
        {body.length} 行 · {header.length} 列{numeric.some(Boolean) && ` · ${numeric.filter(Boolean).length} 个数值列`}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--cae-muted)', padding: '12px 0' }}>空文件 / 无内容</div>
      ) : (
        <>
          {/* column visibility toggles */}
          {header.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 8 }}>
              {header.map((h, ci) => (
                <label key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: hidden.has(ci) ? 'var(--cae-faint)' : 'var(--cae-fg)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!hidden.has(ci)} onChange={() => toggleCol(ci)} style={{ accentColor: 'var(--cae-accent)' }} />
                  <span style={{ fontFamily: 'var(--cae-mono)' }}>{h || `col${ci}`}</span>
                  {numeric[ci] && <span style={{ color: 'var(--cae-accent)', fontSize: 10 }}>#</span>}
                </label>
              ))}
            </div>
          )}

          {/* sparkline for the selected numeric column */}
          {sparkCol !== null && sparkValues && (
            <div style={{ ...{ border: '1px solid var(--cae-border)', borderRadius: 'var(--cae-radius)', background: 'var(--cae-card)', padding: '8px 10px', marginBottom: 8 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
                <span style={{ fontWeight: 600 }}>趋势：{header[sparkCol]}</span>
                <button onClick={() => setSparkCol(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--cae-faint)', fontSize: 11, cursor: 'pointer' }}>
                  关闭
                </button>
              </div>
              <Sparkline values={sparkValues} />
            </div>
          )}

          <div style={{ overflow: 'auto', maxHeight: 420, border: '1px solid var(--cae-border)', borderRadius: 'var(--cae-radius)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--cae-mono)', fontSize: 11 }}>
              <thead>
                <tr>
                  {visibleCols.map((ci) => (
                    <th key={ci} style={th} onClick={() => toggleSort(ci)} title="点击排序">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {header[ci] || `col${ci}`}
                        {numeric[ci] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSparkCol(sparkCol === ci ? null : ci)
                            }}
                            title="绘制该列趋势"
                            style={{ border: 'none', background: 'transparent', color: sparkCol === ci ? 'var(--cae-accent)' : 'var(--cae-faint)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                          >
                            <IconChevron size={10} />
                          </button>
                        )}
                        {sortCol === ci && <span style={{ color: 'var(--cae-accent)', fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, ri) => (
                  <tr key={ri}>
                    {visibleCols.map((ci) => (
                      <td key={ci} style={{ ...td, color: numeric[ci] ? 'var(--cae-accent)' : 'var(--cae-fg)', textAlign: numeric[ci] ? 'right' : 'left' }}>
                        {r[ci]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: 'var(--cae-muted)' }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={cur === 0}
              style={{ padding: '2px 10px', borderRadius: 'var(--cae-radius-sm)', border: '1px solid var(--cae-border)', background: 'var(--cae-card)', color: 'var(--cae-fg)', opacity: cur === 0 ? 0.4 : 1, cursor: cur === 0 ? 'default' : 'pointer' }}
            >
              ‹ 上一页
            </button>
            <span>
              第 {cur + 1} / {pageCount} 页
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={cur >= pageCount - 1}
              style={{ padding: '2px 10px', borderRadius: 'var(--cae-radius-sm)', border: '1px solid var(--cae-border)', background: 'var(--cae-card)', color: 'var(--cae-fg)', opacity: cur >= pageCount - 1 ? 0.4 : 1, cursor: cur >= pageCount - 1 ? 'default' : 'pointer' }}
            >
              下一页 ›
            </button>
            <span style={{ marginLeft: 'auto' }}>共 {sorted.length} 行</span>
          </div>
        </>
      )}
    </div>
  )
}
