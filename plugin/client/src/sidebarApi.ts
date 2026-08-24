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

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/sidebar/api/${method}`, {
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

/** Resolve the session's working directory (cwd) from the host. */
export function sessionCwd(scope: SessionScope, signal?: AbortSignal): Promise<{ sessionId: string; cwd: string; root: string; parent: string | null }> {
  return call('session.cwd', scopePayload(scope, {}), signal)
}
