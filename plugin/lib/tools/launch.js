import { defineTool } from '@deepseek-ai/dsh-tools';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { bridgeRequest } from '../core.js';
/** Promise-wrapped net check that a TCP port accepts a connection. */
function portOpen(host, port, timeoutMs) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const finish = (ok) => {
            if (done)
                return;
            done = true;
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.once('timeout', () => finish(false));
        socket.connect(port, host);
    });
}
/** Sleep helper that aborts early if the signal fires. */
function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve('aborted');
            return;
        }
        const timer = setTimeout(() => resolve('ok'), ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve('aborted');
        }, { once: true });
    });
}
/** Wait for the bridge port, or first signal/latency probe success. */
async function waitForBridge(host, port, timeoutMs, signal) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (signal?.aborted)
            return { ok: false, viaPort: false };
        // First answer that is authoritative is the ping (needs the full bridge up).
        try {
            await bridgeRequest({ host, port }, 'ping', {}, 8_000, signal);
            return { ok: true, viaPort: true };
        }
        catch {
            /* not ready yet */
        }
        if (Date.now() >= deadline)
            return { ok: false, viaPort: false };
        await sleep(1500, signal);
    }
}
export function registerLaunch(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'abaqus_launch_cae',
        description: 'Launch the local Abaqus/CAE GUI and automatically start its socket bridge (default 127.0.0.1:48152) so the other abaqus_* tools can connect. If the bridge is already up, returns the existing session (idempotent). Pops an Abaqus/CAE window in an interactive desktop session.',
        parameters: {
            workspaceDir: { type: 'string', description: 'Optional override: working dir for the Abaqus session (default = plugin config workspaceDir)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    {
                        type: 'text',
                        text: v.launched
                            ? `Launched Abaqus/CAE (pid=${String(v.pid ?? '?')}); bridge listening on ${String(v.host ?? '')}:${String(v.port ?? '')}`
                            : `Abaqus bridge already running at ${String(v.host ?? '')}:${String(v.port ?? '')} (${String(v.message ?? 'reused')})`,
                    },
                ];
            },
        },
        async execute(args, exec) {
            // 1) Already running => idempotent.
            if (await portOpen(config.host, config.port, 4_000)) {
                return {
                    launched: false,
                    host: config.host,
                    port: config.port,
                    message: 'Abaqus socket bridge already listening; reusing the live session',
                };
            }
            // 2) Validate launcher + plugin paths. A launcher that is a real PATH
            // entry (e.g. `abaqus` → `abaqus.bat`) is NOT a file, so fs.existsSync
            // would wrongly reject it. Only require the file to exist when config
            // gave an explicit path (absolute or contains a separator).
            const abqCmd = config.abaqusCommand.trim().replaceAll('/', '\\');
            const isExplicitPath = path.isAbsolute(abqCmd) || abqCmd.includes('\\') || abqCmd.includes('/');
            if (isExplicitPath && !fs.existsSync(abqCmd)) {
                throw new Error(`abaqusCommand not found: ${abqCmd} (set config.abaqusCommand)`);
            }
            if (!abqCmd) {
                throw new Error('abaqusCommand is empty (set config.abaqusCommand)');
            }
            const pluginPath = config.bridgePluginPath;
            if (!fs.existsSync(pluginPath)) {
                throw new Error(`bridgePluginPath not found: ${pluginPath} (set config.bridgePluginPath)`);
            }
            // 3) Prepare the workspace + startup file.
            const ws = path.resolve(args.workspaceDir || config.workspaceDir);
            fs.mkdirSync(ws, { recursive: true });
            const startupFile = path.join(ws, `abaqus_mcp_startup_${crypto.randomUUID().slice(0, 8)}.py`);
            const startupSource = [
                'import os, sys, json, __main__',
                `plugin = ${JSON.stringify(pluginPath)}`,
                `if not getattr(__main__, "_ABAQUS_MCP_MENU_REGISTERED", False):`,
                '    with open(plugin, "r") as _h:',
                '        exec(compile(_h.read(), plugin, "exec"), __main__.__dict__)',
                'try:',
                '    msg = __main__.mcp_start()',
                '    print("ABAQUS_MCP_BRIDGE_STARTED " + json.dumps(msg))',
                'except Exception as _e:',
                '    print("ABAQUS_MCP_BRIDGE_ERROR " + repr(_e))',
            ].join('\n');
            fs.writeFileSync(startupFile, startupSource, 'utf8');
            // 4) Spawn Abaqus/CAE detached with the startup file.
            const child = spawn(abqCmd, ['cae', `startup=${startupFile}`], {
                cwd: ws,
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });
            // Detached + unref so the launched CAE outlives this tool call.
            child.unref();
            let aborted = false;
            const onAbort = () => {
                aborted = true;
            };
            if (exec.signal) {
                if (exec.signal.aborted)
                    onAbort();
                else
                    exec.signal.addEventListener('abort', onAbort, { once: true });
            }
            // 5) Wait for the bridge to answer (cancellable).
            if (aborted)
                throw new Error('abaqus_launch_cae aborted before the bridge came up');
            const wait = await waitForBridge(config.host, config.port, config.launchTimeoutMs, exec.signal);
            if (exec.signal?.aborted || aborted) {
                throw new Error('abaqus_launch_cae aborted while waiting for the Abaqus bridge');
            }
            if (!wait.ok) {
                throw new Error(`Abaqus/CAE did not open its socket bridge within ${config.launchTimeoutMs}ms. ` +
                    `Launched pid=${child.pid ?? '?'} from ${abqCmd}; check the Abaqus window / license. (startup=${startupFile})`);
            }
            // 6) Report success.
            return {
                launched: true,
                pid: child.pid ?? null,
                host: config.host,
                port: config.port,
                workspace: ws,
                viaProbe: wait.viaPort,
                message: 'Abaqus/CAE launched and socket bridge is ready',
            };
        },
        timeoutMs: config.launchTimeoutMs + 15_000,
        isConcurrencySafe: () => false,
    }));
}
