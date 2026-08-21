/**
 * core.js — shared infrastructure for dsh-cae-agent tools.
 *
 * Exports the Abaqus socket-bridge client (JSON-over-TCP), the helper that
 * executes Abaqus Python in the live kernel, and the DSH tool-registration
 * helper `t()` with parameter->schema compilation. Tool domain modules call
 * `t()` to register their native `abaqus_*` tools.
 *
 * Bridge protocol (matches ~/.abaqus-mcp v5 / CAE-Agent-Hub MCP/Abaqus):
 *   request ->  { "id": "<uuid>", "method": "execute|ping|...", "params": {...} }
 *   response -> { "id": <same>, "ok": true, "result": {...} }
 *             | { "id": <same>, "ok": false, "error": { message, type, traceback } }
 */
import net from 'node:net';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

/** Lossless-safe JSON serializer (never returns the JS `undefined` value). */
export function safeStringify(value) {
  const seen = new Set();
  const replacer = (_key, v) => {
    if (v === null || (typeof v !== 'object' && typeof v !== 'bigint')) {
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
      return v;
    }
    if (typeof v === 'bigint') return `${v}n`;
    if (typeof v === 'function') return '[function]';
    if (seen.has(v)) return '[circular]';
    seen.add(v);
    return v;
  };
  try {
    const s = JSON.stringify(value, replacer);
    return s !== undefined ? s : String(value);
  } catch {
    try {
      return JSON.stringify(value, replacer, 2) ?? String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}

/**
 * Open one JSON-over-TCP request to the Abaqus socket bridge and await one
 * response. Each call opens a fresh TCP connection (concurrent calls are
 * independent).
 */
export function bridgeRequest(host, port, method, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const payload = JSON.stringify({
      id,
      method,
      params: { ...(params || {}), timeout: (timeoutMs ?? 60000) / 1000 },
    });

    const socket = new net.Socket();
    let settled = false;
    const chunks = [];

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error(`dsh-cae-agent: Abaqus bridge timed out after ${timeoutMs ?? 60000}ms (${method})`));
    }, (timeoutMs ?? 60000) + 5000);

    socket.on('error', (err) => {
      clearTimeout(timeout);
      finish(
        reject,
        new Error(
          `Cannot reach Abaqus socket bridge at ${host}:${port}. ` +
            `Start Abaqus/CAE and run Plug-ins > Abaqus MCP > Start Socket Bridge. (${err.message})`,
        ),
      );
    });

    socket.connect(port, host, () => {
      socket.write(payload + '\n');
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      const nl = buf.indexOf(0x0a); // '\n'
      if (nl < 0) return;
      const line = buf.subarray(0, nl).toString('utf8');
      chunks.length = 0;
      let message;
      try {
        message = JSON.parse(line);
      } catch (err) {
        clearTimeout(timeout);
        finish(reject, new Error(`dsh-cae-agent: malformed bridge response: ${err.message}`));
        return;
      }
      clearTimeout(timeout);
      if (message.id !== id) {
        finish(reject, new Error('dsh-cae-agent: bridge returned mismatched id'));
        return;
      }
      if (!message.ok) {
        const e = message.error || {};
        finish(reject, new Error((e.message || safeStringify(e)) + (e.traceback ? `\n${e.traceback}` : '')));
        return;
      }
      finish(resolve, message.result);
    });
  });
}

/**
 * Execute Abaqus Python in the live kernel. `result` variable (multi-line) or
 * expression value (single-line) is returned; errors carry AST-level
 * diagnostics as a readable string.
 */
export async function runKernelCode(br, code, timeoutMs) {
  if (!code || !String(code).trim()) throw new Error('code must not be empty');
  let result;
  try {
    result = await bridgeRequest(br.host, br.port, 'execute', { code: String(code) }, timeoutMs);
  } catch (err) {
    // Attach the generated Python source to the error so tests can statically
    // validate the template's Python syntax without a live Abaqus bridge.
    err.abqCode = String(code);
    throw err;
  }
  if (!result.ok) {
    const parts = [result.error_type + ': ' + result.core_error];
    if (result.recovery) {
      const r = result.recovery;
      if (r.parent_object_path) parts.push('  Object: ' + r.parent_object_path);
      if (r.possible_keys) parts.push('  Similar keys: ' + safeStringify(r.possible_keys));
      if (r.callable_signature) parts.push('  Signature: ' + r.callable_signature);
    }
    if (result.code_excerpt) parts.push('  Code:\n' + String(result.code_excerpt));
    if (result.traceback_tail) parts.push('  Traceback:\n' + String(result.traceback_tail));
    throw new Error(parts.join('\n'));
  }
  return { value: result.return_value, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** Text renderer for generic JSON/string tool results. */
export function textRender(_args, value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : safeStringify(value) }];
}

/** Compile a lightweight spec into a standard JSON Schema object. */
function toParamsSchema(spec) {
  const out = { type: 'object', properties: {}, required: [] };
  if (!spec) return out;
  for (const [k, v] of Object.entries(spec)) {
    out.properties[k] = { type: v.type ?? 'string', description: v.description ?? '' };
    if (v.required) out.required.push(k);
  }
  return out;
}

/** Build a bridge handle from config (host/port). */
export function makeBridge(config) {
  return { host: config.host, port: config.port };
}

/**
 * Register one native Abaqus tool on the DSH `tools` registry. `executeImpl`
 * receives (args, exec, br) and returns a string. Returns the disposer.
 */
export function registerTool(ctx, config, { name, description, params, executeImpl, opts = {} }) {
  const tools = ctx.tools;
  const timeoutMs = opts.timeoutMs ?? config.timeoutMs;
  const isConcurrencySafe = opts.isConcurrencySafe;
  const def = {
    name,
    description,
    parameters: toParamsSchema(params),
    output: {
      schema: { type: 'string' },
      render: textRender,
    },
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(isConcurrencySafe ? { isConcurrencySafe } : {}),
    async execute(args, exec) {
      return await executeImpl(args ?? {}, exec, makeBridge(config));
    },
  };
  return tools.register(def);
}
