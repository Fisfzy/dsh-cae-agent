/**
 * telemetry.ts — the cae-agent HTTP route that surfaces LIVE Abaqus/CAE state
 * to the sidebar frontend by proxying the socket bridge's `ping` method.
 *
 * Why a separate route (not a BSB `/sidebar/api/*` method):
 *   dsh-better-sidebar's `buildApi` is a CLOSED dispatch table (a hard-coded
 *   object); it exposes no hook for an external plugin to add a method. So a
 *   plugin that owns a bridge (like this one) registers its own prefix route
 *   on the same host webserver and serves its own wire protocol.
 *
 * What it reports (authoritative, straight from the CAE kernel, not guessed):
 *   - connected : bridge reachable?
 *   - cwd       : os.getcwd() inside the CAE kernel == the REAL Abaqus workdir
 *   - models / viewports / abaqus_version / bridge meta (from the kernel ping)
 *
 * The wire envelope mirrors BSB's `{ok, value}` / `{ok:false, error:{code,message}}`
 * so the client's existing `call()` helper can decode it unchanged.
 *
 * Security: same browser-trust fence as BSB's routes (Host-header loopback or
 * a trusted authority + same-origin browser markers). This is a
 * DNS-rebinding / cross-site defense, not authentication. Read-only: never
 * mutates the model or submits work.
 */
import type { Context } from '@deepseek-ai/cordis'
import { bridgeRequest, runKernelCode, type BridgeHandle, DEFAULT_TIMEOUT_MS } from './core.js'
import { SESSION_STATE_KERNEL } from './kernels.js'

/** Minimal structural request face (subset of node IncomingMessage). */
interface CafeHttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

/** Minimal structural response face (subset of node ServerResponse). */
interface CafeHttpResponse {
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** The `webServer` service face this plugin registers routes on (structural mirror). */
interface CafeWebServer {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: CafeHttpRequest, res: CafeHttpResponse) => void | Promise<void>
  }): () => void
}

/** The `webRuntime` service face (bind-derived trustedHosts for the fence). */
interface CafeWebRuntime {
  trustedHosts: readonly string[]
}

// ── browser-trust fence (structural copy of BSB's trust-fence.ts) ───────────
function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** Whether a normalized URL hostname names the local loopback authority. */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  )
}

function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/** Whether one request may reach the plugin routes (loopback/trusted + same-origin). */
export function isTrustedApiRequest(
  request: CafeHttpRequest,
  trustedHosts: readonly string[],
): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

// ── wire helpers (same envelope as BSB's wire.ts) ───────────────────────────
type CafeErrorCode = 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'bridge-error' | 'internal'

class CafeError extends Error {
  constructor(
    readonly code: CafeErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

function writeJson(res: CafeHttpResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function writeOk(res: CafeHttpResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

function writeError(res: CafeHttpResponse, error: unknown): void {
  if (error instanceof CafeError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

// ── telemetry handler ───────────────────────────────────────────────────────
/**
 * Probe the Abaqus socket bridge for live session telemetry. The bridge's
 * `ping` returns the kernel's own view: `{ cwd, models, viewports,
 * abaqus_version, python, executable, platform, pid, cpu_count, bridge }`.
 * We surface `cwd` as the authoritative Abaqus workdir and pass the rest
 * through. When the bridge is down that is NOT an error envelope — it is a
 * normal `{ok:true, value:{connected:false, error}}` so the UI can render a
 * "bridge offline" state instead of a thrown network error.
 */
async function pingTelemetry(handle: BridgeHandle, timeoutMs: number): Promise<unknown> {
  try {
    const raw = (await bridgeRequest<Record<string, unknown>>(
      handle,
      'ping',
      {},
      timeoutMs,
    )) as Record<string, unknown>
    return {
      connected: true,
      ...raw,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Snapshot the live CAE session (models facets + jobs + cwd) via the kernel.
 *  Bridge-down is a normal `{connected:false}` value, not a thrown error. */
async function modelInfoSnapshot(handle: BridgeHandle, timeoutMs: number): Promise<unknown> {
  try {
    const r = await runKernelCode(handle, SESSION_STATE_KERNEL, timeoutMs)
    return { connected: true, ...(r.value as Record<string, unknown>) }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Register the `/cae/api/*` JSON prefix route on the host webserver. */
export function registerTelemetry(ctx: Context, config: { host: string; port: number; timeoutMs: number }): void {
  // webServer is optional in this plugin's composition: the tools are the
  // core, the HTTP route is the sidebar-facing extra. We register the route
  // inside a `ctx.inject(['webServer'], ...)` block — the documented cordis
  // pattern for "run once this service is available" (the same idiom BSB uses
  // for its optional `settings` service). If webServer is never present the
  // callback simply never runs, the route doesn't exist, and the plugin still
  // loads with its tools intact. (A bare `ctx.get('webServer')` in `apply`
  // returns undefined because the plugin does not declare webServer in inject.)
  ctx.inject(['webServer'], (sctx) => {
    // When a service is injected, it is exposed as a PROPERTY on the callback's
    // context (sctx.webServer), not via sctx.get(name) — the same way BSB reads
    // `sctx.settings`. Using sctx.get('webServer') here returned undefined, so
    // the route silently never registered.
    const webServer = (sctx as unknown as { webServer: CafeWebServer }).webServer
    const webRuntime = (sctx as unknown as { webRuntime?: CafeWebRuntime }).webRuntime
    const trustedHosts = webRuntime?.trustedHosts ?? []
    const handle: BridgeHandle = { host: config.host, port: config.port }
    const timeout = config.timeoutMs || DEFAULT_TIMEOUT_MS

    sctx.effect(
      () =>
        webServer.register({
          kind: 'prefix',
          path: '/cae/api',
          handler: async (req, res) => {
            if (!isTrustedApiRequest(req, trustedHosts)) {
              writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
              return
            }
            if (req.method !== 'POST') {
              writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
              return
            }
            const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
            const method = pathname.startsWith('/cae/api/') ? pathname.slice('/cae/api/'.length) : undefined
            if (method === undefined || method.includes('/')) {
              writeError(res, new CafeError('not-found', 'unknown cae API method', 404))
              return
            }
            try {
              switch (method) {
                case 'telemetry':
                  writeOk(res, await pingTelemetry(handle, timeout))
                  return
                case 'modelinfo':
                  writeOk(res, await modelInfoSnapshot(handle, timeout))
                  return
                default:
                  throw new CafeError('not-found', `unknown cae API method "${method}"`, 404)
              }
            } catch (error) {
              writeError(res, error)
            }
          },
        }),
      'dsh-cae-agent: /cae/api routes',
    )
  })
}
