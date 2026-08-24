/**
 * Workspace status detector (feature ②): reads a directory under the session
 * workspace via BSB's fs.tree route and infers the Abaqus run state from the
 * files present — no backend change.
 *
 * Inference:
 *   *.lck               → 求解中（Abaqus job lock）
 *   *.odb (无 .lck)     → 有结果可后处理
 *   *.cae               → 已建模型
 *   *.jnl / *.rpy       → 建模脚本
 *   *.sta / .msg / .dat → 求解过程产物
 *
 * Constraint (host): only paths inside the session workspace are readable.
 * Default target = the session cwd; the user can point it at the Abaqus
 * workdir when that dir lives inside the workspace. Choice persists per session.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureCaeStyles } from './theme.js'
import { fsTree, caeTelemetry, type FsEntry, type SessionScope, type CaeTelemetry } from './sidebarApi.js'
import { IconRefresh, IconFolder } from './icons.js'

interface Detected {
  cae: string[]
  odb: string[]
  lck: string[]
  sta: string[]
  msg: string[]
  dat: string[]
  script: string[]
}

function detect(entries: FsEntry[]): Detected {
  const d: Detected = { cae: [], odb: [], lck: [], sta: [], msg: [], dat: [], script: [] }
  for (const e of entries) {
    if (e.isDir) continue
    const n = e.name.toLowerCase()
    if (n.endsWith('.cae')) d.cae.push(e.name)
    else if (n.endsWith('.odb')) d.odb.push(e.name)
    else if (n.endsWith('.lck')) d.lck.push(e.name)
    else if (n.endsWith('.sta')) d.sta.push(e.name)
    else if (n.endsWith('.msg')) d.msg.push(e.name)
    else if (n.endsWith('.dat')) d.dat.push(e.name)
    else if (n.endsWith('.jnl') || n.endsWith('.rpy')) d.script.push(e.name)
  }
  return d
}

type Phase = 'running' | 'results' | 'modeled' | 'idle'

function phaseOf(d: Detected): Phase {
  if (d.lck.length > 0) return 'running'
  if (d.odb.length > 0) return 'results'
  if (d.cae.length > 0) return 'modeled'
  return 'idle'
}

const PHASE_META: Record<Phase, { label: string; color: string; soft: string }> = {
  running: { label: '求解中', color: 'var(--cae-run)', soft: 'var(--cae-run-soft)' },
  results: { label: '有结果', color: 'var(--cae-ok)', soft: 'var(--cae-ok-soft)' },
  modeled: { label: '已建模', color: 'var(--cae-accent)', soft: 'var(--cae-accent-soft)' },
  idle: { label: '未检测到产物', color: 'var(--cae-faint)', soft: 'var(--cae-inset)' },
}

const POLL_MS = 4000

export function WorkspaceStatus({ scope, visible }: { scope: SessionScope; visible: boolean }) {
  ensureCaeStyles()
  const storageKey = `cae:workdir:${scope.sessionId}`
  const [target, setTarget] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<string | null>(null)
  const [det, setDet] = useState<Detected | null>(null)
  const [lastAt, setLastAt] = useState<number | null>(null)
  const seq = useRef(0)

  // ── bridge telemetry (authoritative Abaqus workdir + live session) ───────
  const [tele, setTele] = useState<CaeTelemetry | null>(null)
  const [teleLoading, setTeleLoading] = useState(false)
  const teleSeq = useRef(0)

  const refreshTele = useCallback(async (signal?: AbortSignal) => {
    const my = ++teleSeq.current
    setTeleLoading(true)
    try {
      const t = await caeTelemetry(signal)
      if (my !== teleSeq.current) return
      setTele(t)
    } catch {
      if (my !== teleSeq.current) return
      setTele(null)
    } finally {
      if (my === teleSeq.current) setTeleLoading(false)
    }
  }, [])

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const my = ++seq.current
      setLoading(true)
      setError(null)
      try {
        const res = await fsTree(scope, target, signal)
        if (my !== seq.current) return
        setDet(detect(res.entries))
        setResolved(res.path)
        setLastAt(Date.now())
      } catch (e) {
        if (my !== seq.current) return
        setDet(null)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (my === seq.current) setLoading(false)
      }
    },
    [scope, target],
  )

  // Poll while the tab is visible; stop when hidden.
  useEffect(() => {
    if (!visible) return
    const ctrl = new AbortController()
    void refresh(ctrl.signal)
    const t = setInterval(() => void refresh(ctrl.signal), POLL_MS)
    return () => {
      ctrl.abort()
      clearInterval(t)
    }
  }, [visible, refresh])

  // Bridge telemetry: slower cadence (bridge ping is a real kernel round-trip).
  useEffect(() => {
    if (!visible) return
    const ctrl = new AbortController()
    void refreshTele(ctrl.signal)
    const t = setInterval(() => void refreshTele(ctrl.signal), 5000)
    return () => {
      ctrl.abort()
      clearInterval(t)
    }
  }, [visible, refreshTele])

  const persist = (v: string) => {
    setTarget(v)
    try {
      localStorage.setItem(storageKey, v)
    } catch {
      /* ignore */
    }
  }

  const phase: Phase | null = det ? phaseOf(det) : null
  const meta = phase ? PHASE_META[phase] : null
  const showList = useMemo(() => {
    if (!det) return []
    const rows: { name: string; tag: string }[] = []
    for (const n of det.cae) rows.push({ name: n, tag: '模型' })
    for (const n of det.odb) rows.push({ name: n, tag: '结果' })
    for (const n of det.sta) rows.push({ name: n, tag: '状态' })
    for (const n of det.script) rows.push({ name: n, tag: '脚本' })
    return rows.slice(0, 12)
  }, [det])

  return (
    <div
      style={{
        border: '1px solid var(--cae-border)',
        borderRadius: 'var(--cae-radius)',
        background: 'var(--cae-card)',
        boxShadow: 'var(--cae-shadow)',
        padding: '10px 12px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: 'var(--cae-muted)', display: 'inline-flex' }}>
          <IconFolder size={14} />
        </span>
        <div style={{ fontWeight: 700, fontSize: 12 }}>工作目录侦测</div>
        {meta && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 600,
              color: meta.color,
              background: meta.soft,
              padding: '1px 8px',
              borderRadius: 999,
            }}
          >
            {meta.label}
          </span>
        )}
      </div>

      {/* bridge telemetry — the real Abaqus workdir, straight from the bridge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          marginBottom: 8,
          borderRadius: 'var(--cae-radius-sm)',
          border: '1px solid var(--cae-border)',
          background: tele?.connected ? 'var(--cae-ok-soft)' : 'var(--cae-inset)',
          fontSize: 11,
        }}
      >
        {teleLoading && tele === null ? (
          <span style={{ color: 'var(--cae-muted)' }}>桥接状态检测中…</span>
        ) : tele?.connected ? (
          <>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cae-ok)', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: 'var(--cae-ok)', fontWeight: 700, flexShrink: 0 }}>Abaqus 桥接已连接</span>
            <span style={{ color: 'var(--cae-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--cae-mono)' }} title={tele.cwd ?? ''}>
              {tele.cwd ?? ''}
            </span>
            {tele.models && tele.models.length > 0 && (
              <span style={{ color: 'var(--cae-faint)', flexShrink: 0 }}>· {tele.models.length} 模型</span>
            )}
            {tele && tele.cwd && tele.cwd !== '' && tele.cwd !== target && (
              <button
                onClick={() => persist(tele.cwd!)}
                title="把侦测目标设为桥接报告的工作目录"
                style={{
                  marginLeft: 'auto',
                  flexShrink: 0,
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--cae-ok)',
                  background: 'var(--cae-card)',
                  color: 'var(--cae-ok)',
                  cursor: 'pointer',
                }}
              >
                用作侦测路径
              </button>
            )}
          </>
        ) : (
          <>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cae-err)', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: 'var(--cae-err)', fontWeight: 700, flexShrink: 0 }}>Abaqus 桥接离线</span>
            <span style={{ color: 'var(--cae-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tele?.error}>
              未连到 CAE 内核，正在按文件推断
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          value={target}
          onChange={(e) => persist(e.target.value)}
          placeholder="留空 = 会话工作目录；或填 workspace 内的 Abaqus workdir 子路径"
        />
        <button
          onClick={() => void refresh()}
          title="刷新"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            border: '1px solid var(--cae-border)',
            borderRadius: 'var(--cae-radius-sm)',
            background: loading ? 'var(--cae-inset)' : 'var(--cae-card)',
            color: 'var(--cae-fg)',
            fontSize: 12,
          }}
        >
          <span style={{ display: 'inline-flex', animation: loading ? 'none' : 'none' }}>
            <IconRefresh size={13} />
          </span>
          {loading ? '…' : '刷新'}
        </button>
      </div>

      {error ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--cae-err)',
            background: 'var(--cae-err-soft)',
            borderRadius: 'var(--cae-radius-sm)',
            padding: '6px 8px',
          }}
        >
          读取失败：{error}（路径需在 session workspace 内）
        </div>
      ) : det === null ? (
        <div style={{ fontSize: 11, color: 'var(--cae-muted)' }}>{visible ? '读取中…' : '（标签页未激活，暂停侦测）'}</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--cae-muted)', marginBottom: 6, wordBreak: 'break-all' }}>
            {resolved ?? ''}
            {lastAt !== null && ` · ${new Date(lastAt).toLocaleTimeString()}`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 11, marginBottom: det.cae.length + det.odb.length > 0 ? 6 : 0 }}>
            <span>
              <b style={{ color: 'var(--cae-accent)' }}>{det.cae.length}</b> 模型
            </span>
            <span>
              <b style={{ color: 'var(--cae-ok)' }}>{det.odb.length}</b> 结果
            </span>
            <span>
              <b style={{ color: det.lck.length ? 'var(--cae-run)' : 'var(--cae-faint)' }}>{det.lck.length}</b> 进行中
            </span>
            <span>
              <b style={{ color: 'var(--cae-muted)' }}>{det.script.length}</b> 脚本
            </span>
          </div>
          {showList.length > 0 && (
            <div style={{ fontFamily: 'var(--cae-mono)', fontSize: 10.5, color: 'var(--cae-muted)' }}>
              {showList.map((r) => (
                <div key={r.tag + r.name} style={{ display: 'flex', gap: 6, padding: '1px 0' }}>
                  <span style={{ color: 'var(--cae-faint)', flexShrink: 0 }}>[{r.tag}]</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
