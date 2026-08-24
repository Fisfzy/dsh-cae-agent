import { bridgeRequest, DEFAULT_TIMEOUT_MS } from './core.js';
// ── browser-trust fence (structural copy of BSB's trust-fence.ts) ───────────
function header(headers, name) {
    const value = headers[name];
    return typeof value === 'string' ? value : undefined;
}
function parseAuthority(authority) {
    try {
        return new URL(`http://${authority}`);
    }
    catch {
        return undefined;
    }
}
/** Whether a normalized URL hostname names the local loopback authority. */
export function isLoopbackHostname(hostname) {
    if (hostname === 'localhost' || hostname === '[::1]')
        return true;
    const parts = hostname.split('.');
    return (parts.length === 4 &&
        parts[0] === '127' &&
        parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255));
}
function canonicalAuthority(entry, entryUrl) {
    const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port;
    return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts) {
    return trustedHosts.some((entry) => {
        const entryUrl = parseAuthority(entry);
        if (entryUrl === undefined)
            return false;
        return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
            ? entryUrl.hostname === hostUrl.hostname
            : entryUrl.host === hostUrl.host;
    });
}
/** Whether one request may reach the plugin routes (loopback/trusted + same-origin). */
export function isTrustedApiRequest(request, trustedHosts) {
    const host = header(request.headers, 'host');
    if (host === undefined)
        return false;
    const hostUrl = parseAuthority(host);
    if (hostUrl === undefined)
        return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts))
        return false;
    if (header(request.headers, 'sec-fetch-site') === 'cross-site')
        return false;
    const origin = header(request.headers, 'origin');
    if (origin === undefined)
        return true;
    try {
        return new URL(origin).host === hostUrl.host;
    }
    catch {
        return false;
    }
}
class CafeError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
function writeOk(res, value) {
    writeJson(res, 200, { ok: true, value });
}
function writeError(res, error) {
    if (error instanceof CafeError) {
        writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    writeJson(res, 500, { ok: false, error: { code: 'internal', message } });
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
async function pingTelemetry(handle, timeoutMs) {
    try {
        const raw = (await bridgeRequest(handle, 'ping', {}, timeoutMs));
        return {
            connected: true,
            ...raw,
        };
    }
    catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/** Register the `/cae/api/*` JSON prefix route on the host webserver. */
export function registerTelemetry(ctx, config) {
    // webServer is optional in this plugin's composition: the tools are the
    // core, the HTTP route is the sidebar-facing extra. Absent server → no route,
    // the plugin still loads (convention: optional deps via ctx.get()).
    const webServer = ctx.get('webServer');
    if (webServer === undefined)
        return;
    const webRuntime = ctx.get('webRuntime');
    const trustedHosts = webRuntime?.trustedHosts ?? [];
    const handle = { host: config.host, port: config.port };
    const timeout = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    ctx.effect(() => webServer.register({
        kind: 'prefix',
        path: '/cae/api',
        handler: async (req, res) => {
            if (!isTrustedApiRequest(req, trustedHosts)) {
                writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
                return;
            }
            if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            // We do not need a body for telemetry; reject oversized bodies lazily.
            const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname;
            const method = pathname.startsWith('/cae/api/') ? pathname.slice('/cae/api/'.length) : undefined;
            if (method === undefined || method.includes('/')) {
                writeError(res, new CafeError('not-found', 'unknown cae API method', 404));
                return;
            }
            try {
                switch (method) {
                    case 'telemetry':
                        writeOk(res, await pingTelemetry(handle, timeout));
                        return;
                    default:
                        throw new CafeError('not-found', `unknown cae API method "${method}"`, 404);
                }
            }
            catch (error) {
                writeError(res, error);
            }
        },
    }), 'dsh-cae-agent: /cae/api routes');
}
