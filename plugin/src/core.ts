/**
 * core.ts — shared infrastructure for the dsh-cae-agent tools.
 *
 * Exports the Abaqus socket-bridge client (JSON-over-TCP), the helper that
 * executes Abaqus Python in the live kernel, and a typed `defineTool`-based
 * registration helper. Tool domain modules under tools/ call `defineTool`
 * directly using this shared bridge, so every tool returns a canonical JSON
 * value (hard rule 7) and its human-readable text via `output.render`.
 *
 * Bridge protocol (matches ~/.abaqus-mcp v5 / CAE-Agent-Hub):
 *   request ->  { "id": "<uuid>", "method": "execute|ping|...", "params": {...} }
 *   response -> { "id": "<same>", "ok": true, "result": {...} }
 *             | { "id": "<same>", "ok": false, "error": { message, type, traceback } }
 */
import net from 'node:net'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

/** Bridge connection target resolved from plugin config. */
export interface BridgeHandle {
  host: string
  port: number
}

/** Per-call bridge timeout in ms; default when none is given. */
export const DEFAULT_TIMEOUT_MS = 60_000

/** Lossless-safe JSON serializer (never returns the JS `undefined` value). */
export function safeStringify(value: unknown): string {
  const seen = new Set<unknown>()
  const replacer = (_key: string, v: unknown): unknown => {
    if (v === null || (typeof v !== 'object' && typeof v !== 'bigint')) {
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v)
      return v
    }
    if (typeof v === 'bigint') return `${v}n`
    if (typeof v === 'function') return '[function]'
    if (seen.has(v)) return '[circular]'
    seen.add(v)
    return v
  }
  try {
    const s = JSON.stringify(value, replacer)
    return s !== undefined ? s : String(value)
  } catch {
    try {
      return JSON.stringify(value, replacer, 2) ?? String(value)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
}

/**
 * Open one JSON-over-TCP request to the Abaqus socket bridge and await one
 * response. Each call opens a fresh TCP connection; concurrent calls are
 * independent. Rejects with a descriptive error when the bridge is unreachable,
 * times out, or returns an `ok: false` result.
 */
export function bridgeRequest<T = unknown>(
  handle: BridgeHandle,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const payload = JSON.stringify({
      id,
      method,
      params: { ...(params || {}), timeout: timeoutMs / 1000 },
    })

    const socket = new net.Socket()
    let settled = false
    const chunks: Buffer[] = []

    const finish = (fn: (v: unknown) => void, value: unknown) => {
      if (settled) return
      settled = true
      socket.destroy()
      fn(value)
    }

    const onAbort = () => {
      finish(reject, new Error(`dsh-cae-agent: Abaqus bridge call aborted (${method})`))
    }
    // Pre-aborted signal: reject before any I/O.
    if (signal?.aborted) {
      finish(reject, new Error(`dsh-cae-agent: Abaqus bridge call aborted (${method})`))
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const timeout = setTimeout(() => {
      finish(reject, new Error(`dsh-cae-agent: Abaqus bridge timed out after ${timeoutMs}ms (${method})`))
    }, timeoutMs + 5000)

    socket.on('close', () => signal?.removeEventListener('abort', onAbort))
    socket.on('error', (err) => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      finish(
        reject,
        new Error(
          `Cannot reach Abaqus socket bridge at ${handle.host}:${handle.port}. ` +
            `Start Abaqus/CAE and run Plug-ins > Abaqus MCP > Start Socket Bridge. (${err.message})`,
        ),
      )
    })

    socket.connect(handle.port, handle.host, () => {
      socket.write(payload + '\n')
    })

    socket.on('data', (chunk) => {
      chunks.push(chunk)
      const buf = Buffer.concat(chunks)
      const nl = buf.indexOf(0x0a) // '\n'
      if (nl < 0) return
      const line = buf.subarray(0, nl).toString('utf8')
      chunks.length = 0
      let message: any
      try {
        message = JSON.parse(line)
      } catch (err) {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
        finish(reject, new Error(`dsh-cae-agent: malformed bridge response: ${(err as Error).message}`))
        return
      }
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      if (message.id !== id) {
        finish(reject, new Error('dsh-cae-agent: bridge returned mismatched id'))
        return
      }
      if (!message.ok) {
        const e = message.error || {}
        finish(
          reject,
          new Error((e.message || safeStringify(e)) + (e.traceback ? `\n${e.traceback}` : '')),
        )
        return
      }
      finish(resolve as (v: unknown) => void, message.result)
    })
  })
}

/** Parsed result of running Abaqus Python in the live kernel. */
export interface KernelResult {
  value: unknown
  stdout: string
  stderr: string
}

/**
 * Execute Abaqus Python in the live kernel. A `result` variable (multi-line) or
 * expression value (single-line) is returned as a lossless JSON value; errors
 * carry AST-level diagnostics. On bridge failure the generated source is
 * attached to the thrown error as `abqCode` so static (offline) Python-syntax
 * tests can run without a live bridge.
 */
export async function runKernelCode(
  handle: BridgeHandle,
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<KernelResult> {
  if (!code || !String(code).trim()) throw new Error('code must not be empty')
  let result: any
  try {
    result = await bridgeRequest(handle, 'execute', { code: String(code) }, timeoutMs, signal)
  } catch (err) {
    // Attach the generated Python source to the error for offline syntax checks.
    ;(err as any).abqCode = String(code)
    throw err
  }
  if (!result.ok) {
    const parts = [`${result.error_type || 'Error'}: ${result.core_error || 'unknown error'}`]
    if (result.recovery) {
      const r = result.recovery
      if (r.parent_object_path) parts.push(`  Object: ${r.parent_object_path}`)
      if (r.possible_keys) parts.push(`  Similar keys: ${safeStringify(r.possible_keys)}`)
      if (r.callable_signature) parts.push(`  Signature: ${r.callable_signature}`)
    }
    if (result.code_excerpt) parts.push(`  Code:\n${String(result.code_excerpt)}`)
    if (result.traceback_tail) parts.push(`  Traceback:\n${String(result.traceback_tail)}`)
    throw new Error(parts.join('\n'))
  }
  return {
    value: result.return_value as unknown,
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
  }
}

/** Render a canonical JSON value as a single human-readable text content block. */
export function textRender(args: unknown, value: unknown): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: typeof value === 'string' ? value : safeStringify(value) }]
}
