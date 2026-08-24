/**
 * Abaqus 工作流 tab — 实时进度步进器（Mac 风格状态灯）。
 *
 * 两种模式：
 *   - 实时模式：会话工作目录里存在 `cae-progress.json`（agent 每跑一步就写）时，
 *     轮询它并渲染 Mac 风格步进器 —— 待办灰灯 / 进行中蓝灯脉冲 + 卡片高亮 /
 *     完成绿✓ / 出错红✕ + 卡片内联错误详情（"问题出在哪"）。
 *   - 参考模式：无进度文件时退化为可交互指南（手动点状态灯标记完成 + 搜索 +
 *     类型过滤 + 可展开的参数/示例/常见坑）。
 *
 * 零后端改动：进度文件是约定，agent 用任意文件工具写它即可（见 progress.ts）。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { TabComponentProps } from 'dsh-better-sidebar'
import { ensureCaeStyles } from './theme.js'
import { STEPS, SECTIONS, KIND_LABEL, chainPrompt, type Step, type SectionKey, type ModelKind } from './steps.js'
import { parseProgress, nodeMap, PROGRESS_FILENAME, type ProgressFile, type NodeStatus } from './progress.js'
import { fsRead } from './sidebarApi.js'
import { WorkspaceStatus } from './WorkspaceStatus.js'
import { copyText } from './copy.js'
import { IconCopy, IconCheck, IconChevron, IconSearch, IconX } from './icons.js'

// ── localStorage persistence (manual/guide mode) ────────────────────────────
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

// ── atoms ────────────────────────────────────────────────────────────────────
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

/** Mac-style status dot. Live: shows authoritative status. Manual: click to toggle done. */
function StatusDot({ status, onClick, title }: { status: NodeStatus; onClick?: () => void; title?: string }) {
  const cls = status === 'done' ? 'cae-dot cae-dot-done' : status === 'error' ? 'cae-dot cae-dot-error' : status === 'active' ? 'cae-dot cae-dot-active' : 'cae-dot'
  const inner = status === 'done' ? <IconCheck size={9} /> : status === 'error' ? <IconX size={9} /> : null
  if (onClick) {
    return (
      <button onClick={onClick} title={title} className={cls} style={{ cursor: 'pointer', padding: 0 }}>
        {inner}
      </button>
    )
  }
  return (
    <span className={cls} title={title}>
      {inner}
    </span>
  )
}

function StepCard({
  step,
  status,
  live,
  error,
  errorDetail,
  dimmed,
  open,
  isLast,
  onToggleDone,
  onToggleOpen,
}: {
  step: Step
  status: NodeStatus
  live: boolean
  error?: string
  errorDetail?: string
  dimmed: boolean
  open: boolean
  isLast: boolean
  onToggleDone: () => void
  onToggleOpen: () => void
}) {
  const cardCls = live
    ? status === 'active'
      ? 'cae-card-active'
      : status === 'error'
        ? 'cae-card-error'
        : status === 'done'
          ? 'cae-card-done'
          : ''
    : status === 'done'
      ? 'cae-card-done'
      : ''
  const dotTitle = live
    ? status === 'active'
      ? '进行中'
      : status === 'done'
        ? '已完成'
        : status === 'error'
          ? '出错'
          : '待办'
    : status === 'done'
      ? '已完成（点击取消）'
      : '标记此步已完成'

  return (
    <div className="cae-step" style={{ opacity: dimmed ? 0.45 : 1, transition: 'opacity 0.15s' }}>
      <div className="cae-rail">
        <StatusDot status={status} onClick={live ? undefined : onToggleDone} title={dotTitle} />
        {!isLast && <div className="cae-line" />}
      </div>
      <div className={`cae-card ${cardCls}`} style={{ ...card, flex: 1, minWidth: 0, padding: '8px 10px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span
            style={{
              flexShrink: 0,
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: status === 'done' ? 'var(--cae-ok)' : 'var(--cae-accent-soft)',
              color: status === 'done' ? '#fff' : 'var(--cae-accent)',
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
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: status === 'done' && !live ? 'line-through' : 'none',
                  color: status === 'done' && !live ? 'var(--cae-muted)' : 'var(--cae-fg)',
                }}
              >
                {step.goal}
              </div>
              {live && status === 'active' && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cae-accent)', background: 'var(--cae-accent-soft)', padding: '0 6px', borderRadius: 999 }}>
                  进行中
                </span>
              )}
              {step.kinds !== 'any' && (
                <span style={{ fontSize: 10, color: 'var(--cae-faint)', flexShrink: 0 }}>{step.kinds.map((k) => KIND_LABEL[k]).join('/')}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '5px 0' }}>
              {step.tools.map((t) => (
                <ToolChip key={t} tool={t} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cae-muted)' }}>{step.note}</div>

            {/* 出错详情 —— "问题出在哪" */}
            {status === 'error' && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  background: 'var(--cae-err-soft)',
                  border: '1px solid color-mix(in srgb, var(--cae-err) 40%, transparent)',
                  borderRadius: 'var(--cae-radius-sm)',
                  fontSize: 11.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--cae-err)' }}>
                  <IconX size={12} />
                  {error ?? '此步骤出错'}
                </div>
                {errorDetail && <div style={{ marginTop: 4, color: 'var(--cae-muted)', whiteSpace: 'pre-wrap' }}>{errorDetail}</div>}
              </div>
            )}

            {/* 可展开的参考详情（参数/示例/坑） */}
            {open && step.detail && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--cae-inset)', borderRadius: 'var(--cae-radius-sm)', fontSize: 11.5, display: 'grid', gap: 6 }}>
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
    </div>
  )
}

// ── main view ────────────────────────────────────────────────────────────────
export function WorkflowView(props: TabComponentProps) {
  ensureCaeStyles()
  const { scope, visible } = props
  const progressKey = `cae:progress:${scope.sessionId}`

  // ── live progress polling ────────────────────────────────────────────────
  const [progress, setProgress] = useState<ProgressFile | null>(null)
  const liveSeq = useRef(0)
  useEffect(() => {
    if (!visible) return
    let alive = true
    const my = ++liveSeq.current
    const ctrl = new AbortController()
    const tick = async () => {
      try {
        const res = await fsRead(scope, PROGRESS_FILENAME, ctrl.signal)
        if (!alive || my !== liveSeq.current) return
        setProgress(res.kind === 'text' ? parseProgress(res.content) : null)
      } catch {
        if (!alive || my !== liveSeq.current) return
        setProgress(null) // no progress file → guide mode
      }
    }
    void tick()
    const t = setInterval(tick, 1500)
    return () => {
      alive = false
      ctrl.abort()
      clearInterval(t)
    }
  }, [scope, visible])

  const live = progress !== null
  const nodes = useMemo(() => nodeMap(progress), [progress])

  // ── guide-mode manual state ──────────────────────────────────────────────
  const [done, setDone] = useState<Set<string>>(() => loadSet(progressKey))
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'any' | ModelKind>('any')
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set())
  const [copiedChain, setCopiedChain] = useState(false)

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
      if (!query) return true
      const q = query.toLowerCase()
      return `${s.goal} ${s.tools.join(' ')} ${s.note}`.toLowerCase().includes(q)
    },
    [query],
  )
  const dimmed = useCallback(
    (s: Step): boolean => {
      if (kind === 'any' || s.kinds === 'any') return false
      return !s.kinds.includes(kind)
    },
    [kind],
  )

  const statusOf = useCallback(
    (s: Step): NodeStatus => {
      if (live) return nodes.get(s.n)?.status ?? 'pending'
      return done.has(s.n) ? 'done' : 'pending'
    },
    [live, nodes, done],
  )

  const visibleBySection = useMemo(() => {
    const map: Record<SectionKey, Step[]> = { pre: [], solve: [], post: [] }
    for (const s of STEPS) if (matches(s)) map[s.section].push(s)
    return map
  }, [matches])

  const doneCount = live ? STEPS.filter((s) => (nodes.get(s.n)?.status ?? 'pending') === 'done').length : done.size
  const total = STEPS.length
  const currentNode = live && progress.current ? nodes.get(progress.current) : undefined

  return (
    <div className="cae-root" style={{ padding: '12px 14px', fontSize: 12, maxWidth: 560, overflowY: 'auto' }}>
      {/* header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>dsh-cae-agent · Abaqus 工作流</div>
          {live && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cae-ok)', background: 'var(--cae-ok-soft)', padding: '1px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--cae-ok)', display: 'inline-block' }} />
              实时进度
            </span>
          )}
        </div>
        <div style={{ color: 'var(--cae-muted)', fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>
          会话 {scope.sessionId} · {live ? '跟随 agent 的 Abaqus 操作实时更新' : '按建模链调用对应工具'}
        </div>
      </div>

      {/* ② workspace detector */}
      <WorkspaceStatus scope={scope} visible={visible} />

      {/* live status banner */}
      {live && (
        <div style={{ ...card, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          {currentNode ? (
            <>
              <span className="cae-dot cae-dot-active" style={{ marginTop: 0 }} />
              <span>
                正在执行：<b>步骤 {progress.current}</b>
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--cae-muted)' }}>实时进度已连接（无进行中步骤）</span>
          )}
          {progress.updatedAt && <span style={{ marginLeft: 'auto', color: 'var(--cae-faint)' }}>{new Date(progress.updatedAt).toLocaleTimeString()}</span>}
        </div>
      )}

      {/* toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--cae-faint)', display: 'inline-flex' }}>
            <IconSearch size={13} />
          </span>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索步骤 / 工具 / 备注…" style={{ paddingLeft: 26 }} />
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
          <span>{live ? '实时进度' : '建模进度（点击状态灯标记）'}</span>
          <span>
            {doneCount}/{total}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--cae-inset)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round((doneCount / total) * 100)}%`, background: 'var(--cae-ok)', transition: 'width 0.2s' }} />
        </div>
      </div>

      {/* sections → stepper */}
      {SECTIONS.map((sec) => {
        const steps = visibleBySection[sec.key]
        const isCollapsed = collapsed.has(sec.key)
        const secDone = steps.filter((s) => statusOf(s) === 'done').length
        return (
          <div key={sec.key} style={{ marginBottom: 14 }}>
            <button onClick={() => toggleSection(sec.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: '4px 0', textAlign: 'left' }}>
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
                  <div style={{ marginLeft: 8 }}>
                    {steps.map((s, i) => (
                      <StepCard
                        key={s.n}
                        step={s}
                        status={statusOf(s)}
                        live={live}
                        error={nodes.get(s.n)?.error}
                        errorDetail={nodes.get(s.n)?.detail}
                        dimmed={dimmed(s)}
                        open={openSteps.has(s.n)}
                        isLast={i === steps.length - 1}
                        onToggleDone={() => toggleDone(s.n)}
                        onToggleOpen={() => toggleOpen(s.n)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
