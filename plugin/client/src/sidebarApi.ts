/**
 * Minimal, self-contained client for the dsh-better-sidebar `/sidebar/api/*`
 * routes. We deliberately re-implement the tiny fetch surface instead of
 * importing dsh-better-sidebar's `api` module — importing it would pull the
 * entire BSB client bundle into ours, and the route is a plain same-origin
 * POST anyway. Zero backend changes: BSB already serves fs.tree.
 *
 * Constraint inherited from the host: fs paths must stay inside the session
 * workspace (the host's `ensureWorkspacePath` rejects escapes).
 */

export interface FsEntry {
  name: string
  path: string
  isDir: boolean
  hidden: boolean
  isSymlink: boolean
  broken: boolean
}

export interface FsTreeResult {
  path: string
  entries: FsEntry[]
  truncated: boolean
}

export interface FsTextResult {
  kind: 'text'
  content: string
  truncated: boolean
}
export interface FsBinaryResult {
  kind: 'binary'
  size: number
  truncated: boolean
  head: string
}

export interface SessionScope {
  sessionId: string
  cwd?: string
  repoRoot?: string
}

export class SidebarApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SidebarApiError'
    this.code = code
  }
}

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal, base: string = '/sidebar/api'): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new SidebarApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed = (await response.json().catch(() => null)) as
    | { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } }
    | null
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SidebarApiError(parsed?.error?.code ?? 'http', parsed?.error?.message ?? `HTTP ${response.status}`)
  }
  return parsed.value as T
}

function scopePayload(scope: SessionScope, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: scope.sessionId,
    ...(scope.cwd !== undefined && scope.cwd !== '' ? { cwd: scope.cwd } : {}),
    ...(scope.repoRoot !== undefined && scope.repoRoot !== '' ? { repoRoot: scope.repoRoot } : {}),
    ...extra,
  }
}

/** List a directory under the session workspace. Omit `path` to list the session cwd itself. */
export function fsTree(scope: SessionScope, path?: string, signal?: AbortSignal): Promise<FsTreeResult> {
  return call<FsTreeResult>('fs.tree', scopePayload(scope, path !== undefined && path !== '' ? { path } : {}), signal)
}

/** Read a text file under the session workspace (workspace-relative `path`). */
export function fsRead(scope: SessionScope, path: string, signal?: AbortSignal): Promise<FsTextResult | FsBinaryResult> {
  return call<FsTextResult | FsBinaryResult>('fs.read', scopePayload(scope, { path }), signal)
}

/** Resolve the session's working directory (cwd) from the host. */
export function sessionCwd(scope: SessionScope, signal?: AbortSignal): Promise<{ sessionId: string; cwd: string; root: string; parent: string | null }> {
  return call('session.cwd', scopePayload(scope, {}), signal)
}

// ── cae-agent's own `/cae/api` route (bridge-backed, NOT BSB's table) ──────
// The cae-agent plugin registers this route on the host webserver; it proxies
// the Abaqus socket bridge's `ping` so the sidebar can show the REAL Abaqus
// workdir + live session state instead of guessing from workspace files.

/** Live Abaqus/CAE state surfaced by `POST /cae/api/telemetry`. */
export interface CaeTelemetry {
  connected: boolean
  /** os.getcwd() inside the CAE kernel == the authoritative Abaqus workdir. */
  cwd?: string
  models?: string[]
  viewports?: string[]
  abaqus_version?: string | null
  python?: string
  executable?: string
  platform?: string
  pid?: number
  cpu_count?: number
  bridge?: Record<string, unknown>
  /** Human message when `connected` is false (bridge offline). */
  error?: string
}

/** Query the Abaqus bridge for live session telemetry via the plugin route.
 *  Never throws for a bridge-offline condition — that is `{connected:false}`. */
export function caeTelemetry(signal?: AbortSignal): Promise<CaeTelemetry> {
  return call<CaeTelemetry>('telemetry', {}, signal, '/cae/api')
}

/** Facets of one live Abaqus model, as reported by the kernel snapshot. */
export interface CaeModelFacets {
  parts?: string[]
  materials?: string[]
  sections?: string[]
  steps?: string[]
  loads?: string[]
  bc?: string[]
  interactions?: string[]
  constraints?: string[]
  amplitudes?: string[]
  instances?: string[]
  sets?: string[]
  surfaces?: string[]
}

/** One live Abaqus job. */
export interface CaeJob {
  name: string
  status?: string
  type?: string
  model?: string
  numCpus?: string
  memory?: string
}

/** Full live session snapshot (models facets + jobs + cwd) from `/cae/api/modelinfo`. */
export interface CaeModelInfo {
  connected: boolean
  /** os.getcwd() inside the CAE kernel. */
  cwd?: string
  models?: Record<string, CaeModelFacets>
  jobs?: CaeJob[]
  /** Human message when `connected` is false. */
  error?: string
}

/** Snapshot the live Abaqus session (per-model facets, jobs, cwd) via the plugin route. */
export function caeModelInfo(signal?: AbortSignal): Promise<CaeModelInfo> {
  return call<CaeModelInfo>('modelinfo', {}, signal, '/cae/api')
}
