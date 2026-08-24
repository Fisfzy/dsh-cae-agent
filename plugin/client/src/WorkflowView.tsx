/**
 * Abaqus 工作流 tab (feature ① + ④).
 *
 * Turns the static 11-step guide into an interactive workflow assistant:
 *   - 分区 (前处理 / 求解 / 后处理)，每区可折叠
 *   - 步骤卡片：编号徽标 + 目标 + 工具（点击复制）+ 备注 + 可展开进阶详情
 *   - 顶部搜索框 + 模型类型过滤（实体/壳/复合/梁）高亮相关步
 *   - 手动进度勾选（localStorage 按会话持久化）+ 进度条
 *   - 「复制整条建模链 prompt」一键生成
 *   - 顶部嵌入 WorkspaceStatus（② 工作目录侦测）
 *   - 主题走 theme.ts 的 CSS 变量，暗/亮自适应
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { TabComponentProps } from 'dsh-better-sidebar'
import { ensureCaeStyles } from './theme.js'
import { STEPS, SECTIONS, KIND_LABEL, chainPrompt, type Step, type SectionKey, type ModelKind } from './steps.js'
import { WorkspaceStatus } from './WorkspaceStatus.js'
import { copyText } from './copy.js'
import { IconCopy, IconCheck, IconChevron, IconSearch } from './icons.js'

type SessionScope = TabComponentProps['scope']

// ── localStorage persistence helpers ─────────────────────────────────────────
function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}
function saveSet(key: string, s: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

// ── small styled atoms ───────────────────────────────────────────────────────
const card: CSSProperties = {
  border: '1px solid var(--cae-border)',
  borderRadius: 'var(--cae-radius)',
  background: 'var(--cae-card)',
  boxShadow: 'var(--cae-shadow)',
}
const chipBase: CSSProperties = {
  fontSize: 11,
  padding: '2px 9px',
  borderRadius: 999,
  border: '1px solid var(--cae-border)',
  background: 'var(--cae-card)',
  color: 'var(--cae-muted)',
  cursor: 'pointer',
}

function ToolChip({ tool }: { tool: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void copyText(tool).then((ok) => {
          if (ok) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }
        })
      }}
      title={`复制 ${tool}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--cae-mono)',
        fontSize: 11,
        padding: '2px 6px',
        borderRadius: 'var(--cae-radius-sm)',
        border: '1px solid var(--cae-border)',
        background: copied ? 'var(--cae-ok-soft)' : 'var(--cae-inset)',
        color: copied ? 'var(--cae-ok)' : 'var(--cae-fg)',
        cursor: 'pointer',
      }}
    >
      {tool}
      <span style={{ display: 'inline-flex', opacity: 0.7 }}>{copied ? <IconCheck size={11} /> : <IconCopy size={11} />}</span>
    </button>
  )
}

function StepCard({
  step,
  done,
  dimmed,
  open,
  onToggleDone,
  onToggleOpen,
}: {
  step: Step
  done: boolean
  dimmed: boolean
  open: boolean
  onToggleDone: () => void
  onToggleOpen: () => void
}) {
  return (
    <div
      style={{
        ...card,
        padding: '8px 10px',
        marginBottom: 8,
        opacity: dimmed ? 0.45 : 1,
        transition: 'opacity 0.15s',
        borderLeft: done ? '3px solid var(--cae-ok)' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="checkbox"
          checked={done}
          onChange={onToggleDone}
          title="标记此步已完成"
          style={{ marginTop: 3, accentColor: 'var(--cae-ok)', cursor: 'pointer', flexShrink: 0 }}
        />
        <span
          style={{
            flexShrink: 0,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: done ? 'var(--cae-ok)' : 'var(--cae-accent-soft)',
            color: done ? '#fff' : 'var(--cae-accent)',
            fontSize: 11,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {step.n}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--cae-muted)' : 'var(--cae-fg)' }}>
              {step.goal}
            </div>
            {step.kinds !== 'any' && (
              <span style={{ fontSize: 10, color: 'var(--cae-faint)', flexShrink: 0 }}>
                {step.kinds.map((k) => KIND_LABEL[k]).join('/')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '5px 0' }}>
            {step.tools.map((t) => (
              <ToolChip key={t} tool={t} />
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--cae-muted)' }}>{step.note}</div>

          {open && step.detail && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'var(--cae-inset)',
                borderRadius: 'var(--cae-radius-sm)',
                fontSize: 11.5,
                display: 'grid',
                gap: 6,
              }}
            >
              {step.detail.params && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--cae-fg)', marginBottom: 2 }}>常用参数</div>
                  <div style={{ fontFamily: 'var(--cae-mono)', fontSize: 11, color: 'var(--cae-muted)', whiteSpace: 'pre-wrap' }}>{step.detail.params}</div>
                </div>
              )}
              {step.detail.example && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--cae-fg)', marginBottom: 2 }}>示例</div>
                  <div style={{ fontFamily: 'var(--cae-mono)', fontSize: 11, color: 'var(--cae-accent)', whiteSpace: 'pre-wrap' }}>{step.detail.example}</div>
                </div>
              )}
              {step.detail.pitfall && (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--cae-warn)', marginBottom: 2 }}>常见坑</div>
                  <div style={{ color: 'var(--cae-muted)' }}>{step.detail.pitfall}</div>
                </div>
              )}
            </div>
          )}
        </div>
        {step.detail && (
          <button
            onClick={onToggleOpen}
            title={open ? '收起详情' : '展开详情'}
            style={{
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--cae-faint)',
              display: 'inline-flex',
              padding: 2,
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          >
            <IconChevron size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── main view ────────────────────────────────────────────────────────────────
export function WorkflowView(props: TabComponentProps) {
  ensureCaeStyles()
  const { scope, visible } = props
  const progressKey = `cae:progress:${scope.sessionId}`

  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'any' | ModelKind>('any')
  const [done, setDone] = useState<Set<string>>(() => loadSet(progressKey))
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set())
  const [copiedChain, setCopiedChain] = useState(false)

  // session id can change across remounts; reload persisted progress when it does
  useEffect(() => {
    setDone(loadSet(progressKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.sessionId])

  const toggleDone = useCallback(
    (n: string) => {
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(n)) next.delete(n)
        else next.add(n)
        saveSet(progressKey, next)
        return next
      })
    },
    [progressKey],
  )

  const toggleOpen = useCallback((n: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }, [])

  const toggleSection = useCallback((k: SectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  const matches = useCallback(
    (s: Step): boolean => {
      if (query) {
        const q = query.toLowerCase()
        const hay = `${s.goal} ${s.tools.join(' ')} ${s.note}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    },
    [query],
  )

  const dimmed = useCallback(
    (s: Step): boolean => {
      if (kind === 'any') return false
      if (s.kinds === 'any') return false
      return !s.kinds.includes(kind)
    },
    [kind],
  )

  const visibleBySection = useMemo(() => {
    const map: Record<SectionKey, Step[]> = { pre: [], solve: [], post: [] }
    for (const s of STEPS) {
      if (matches(s)) map[s.section].push(s)
    }
    return map
  }, [matches])

  const doneCount = done.size
  const total = STEPS.length

  return (
    <div className="cae-root" style={{ padding: '12px 14px', fontSize: 12, maxWidth: 560, overflowY: 'auto' }}>
      {/* header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>dsh-cae-agent · Abaqus 工作流</div>
        <div style={{ color: 'var(--cae-muted)', fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>
          会话 {scope.sessionId} · 按建模链调用对应工具
        </div>
      </div>

      {/* ② workspace detector */}
      <WorkspaceStatus scope={scope} visible={visible} />

      {/* toolbar: search + kind filter + chain copy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--cae-faint)', display: 'inline-flex' }}>
            <IconSearch size={13} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索步骤 / 工具 / 备注…"
            style={{ paddingLeft: 26 }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(['any', 'solid', 'shell', 'composite', 'beam'] as const).map((k) => {
            const active = kind === k
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  ...chipBase,
                  background: active ? 'var(--cae-accent)' : 'var(--cae-card)',
                  color: active ? '#fff' : 'var(--cae-muted)',
                  borderColor: active ? 'var(--cae-accent)' : 'var(--cae-border)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {k === 'any' ? '全部' : KIND_LABEL[k]}
              </button>
            )
          })}
          <button
            onClick={() => {
              void copyText(chainPrompt()).then((ok) => {
                if (ok) {
                  setCopiedChain(true)
                  setTimeout(() => setCopiedChain(false), 1500)
                }
              })
            }}
            title="复制整条建模链作为 prompt"
            style={{
              ...chipBase,
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: copiedChain ? 'var(--cae-ok)' : 'var(--cae-accent)',
              borderColor: copiedChain ? 'var(--cae-ok)' : 'var(--cae-accent)',
              background: copiedChain ? 'var(--cae-ok-soft)' : 'var(--cae-accent-soft)',
            }}
          >
            {copiedChain ? <IconCheck size={12} /> : <IconCopy size={12} />}
            {copiedChain ? '已复制' : '复制建模链 prompt'}
          </button>
        </div>
      </div>

      {/* progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cae-muted)', marginBottom: 4 }}>
          <span>建模进度（手动勾选）</span>
          <span>
            {doneCount}/{total}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--cae-inset)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((doneCount / total) * 100)}%`,
              background: 'var(--cae-ok)',
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>

      {/* sections */}
      {SECTIONS.map((sec) => {
        const steps = visibleBySection[sec.key]
        const isCollapsed = collapsed.has(sec.key)
        const secDone = steps.filter((s) => done.has(s.n)).length
        return (
          <div key={sec.key} style={{ marginBottom: 14 }}>
            <button
              onClick={() => toggleSection(sec.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'transparent',
                padding: '4px 0',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'inline-flex', color: 'var(--cae-faint)', transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s' }}>
                <IconChevron size={13} />
              </span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{sec.title}</span>
              <span style={{ fontSize: 11, color: 'var(--cae-faint)' }}>
                {secDone}/{steps.length}
              </span>
            </button>
            {!isCollapsed && (
              <>
                <div style={{ fontSize: 11, color: 'var(--cae-faint)', margin: '0 0 8px 21px' }}>{sec.hint}</div>
                {steps.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--cae-muted)', margin: '0 0 4px 21px' }}>无匹配步骤</div>
                ) : (
                  steps.map((s) => (
                    <div key={s.n} style={{ marginLeft: 21 }}>
                      <StepCard
                        step={s}
                        done={done.has(s.n)}
                        dimmed={dimmed(s)}
                        open={openSteps.has(s.n)}
                        onToggleDone={() => toggleDone(s.n)}
                        onToggleOpen={() => toggleOpen(s.n)}
                      />
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
