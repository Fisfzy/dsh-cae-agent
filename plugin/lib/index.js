import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import { registerRead } from './tools/read.js';
import { registerMaterial } from './tools/material.js';
import { registerGeometry } from './tools/geometry.js';
import { registerSetup } from './tools/setup.js';
import { registerInteraction } from './tools/interaction.js';
import { registerMesh } from './tools/mesh.js';
import { registerJob } from './tools/job.js';
import { registerLaunch } from './tools/launch.js';
import { registerComposite } from './tools/composite.js';
import { registerTelemetry } from './telemetry.js';
export const name = 'dsh-cae-agent';
/** Runtime dependencies this plugin requires before it can load. `attachments`
 * is needed by `capture_viewport` (image persistence); `tools` is the registry
 * every tool is registered on. `webServer` + `webRuntime` are required for the
 * browser-facing `/cae/api/*` route (sidebar bridge telemetry) — declared via
 * inject exactly like dsh-better-sidebar, so the service is a context property
 * and the route registers reliably (a nested ctx.inject was not firing). All
 * are required, so all belong in inject. */
export const inject = ['tools', 'attachments', 'webServer', 'webRuntime'];
/** Windows `where`-style command resolution: return the first existing path
 *  for `cmd` found on PATH, or undefined. */
function resolveOnPath(cmd) {
    try {
        const pick = process.platform === 'win32' ? 'where' : 'which';
        const res = spawnSync(pick, [cmd], { encoding: 'utf8', timeout: 5000, windowsHide: true });
        if (res.status !== 0)
            return undefined;
        const line = res.stdout?.split(/\r?\n/).map((s) => s.trim()).find((s) => s && s.length > 0);
        if (!line)
            return undefined;
        const resolved = process.platform === 'win32' ? line.replaceAll('/', '\\') : line;
        try {
            if (process.platform === 'win32' && fs.existsSync(resolved))
                return resolved;
            if (fs.existsSync(resolved))
                return resolved;
        }
        catch { /* keep looking */ }
        return resolved;
    }
    catch {
        return undefined;
    }
}
/** Resolve the Abaqus launcher command without machine-specific hardcoding,
 *  in priority order:
 *    1. explicit env override (ABAQUS_COMMAND)
 *    2. an existing Abaqus launcher (ABQcaeK.exe under a SIMULIA EstProducts
 *       install, or the `abaqus.bat`/`abaqus` command resolved via `where`)
 *    3. a bare `abaqus` on PATH (the spawn will let the OS resolve it)
 *  This matters: abaqus_launch_cae validates the launch path with
 *  fs.existsSync, and a bare `abaqus` (a PATH command, not a file) fails that
 *  check. Resolving to a real path makes auto-launch actually work. */
function defaultAbaqusCommand() {
    const env = process.env.ABAQUS_COMMAND;
    if (env)
        return env;
    // Prefer the `abaqus` launcher (abaqus.bat) resolved via `where` — it is the
    // entry that correctly accepts `cae script=<file>` (verified end-to-end).
    // Spawning ABQcaeK.exe directly does NOT process the `cae script=` option the
    // same way, so the bridge never opens. abaqus.bat wraps the command with the
    // right environment/argument handling.
    const fromPath = resolveOnPath('abaqus') ?? resolveOnPath('abaqus.bat');
    if (fromPath)
        return fromPath;
    // Fallback: probe SIMULIA install layouts for the raw ABQcaeK.exe.
    try {
        const simulia = process.env.SIMULIA ?? 'D:\\SIMULIA';
        for (const base of [simulia, 'C:\\SIMULIA']) {
            if (!fs.existsSync(base))
                continue;
            const exe = path.join(base, 'EstProducts', '2024', 'win_b64', 'code', 'bin', 'ABQcaeK.exe');
            if (fs.existsSync(exe))
                return exe;
            const est = path.join(base, 'EstProducts');
            if (fs.existsSync(est)) {
                for (const ver of fs.readdirSync(est)) {
                    const p = path.join(est, ver, 'win_b64', 'code', 'bin', 'ABQcaeK.exe');
                    if (fs.existsSync(p))
                        return p;
                }
            }
        }
    }
    catch { /* keep looking */ }
    return 'abaqus';
}
/** Resolve the Abaqus bridge plugin that abaqus_launch_cae loads via `startup=`.
 *
 *  Prefer the PURE-KERNEL bridge (`cae_bridge_plugin.py`, no abaqusGui) so the
 *  bridge can actually auto-start from a `startup=` file — the stock
 *  abaqus_mcp_plugin.py imports abaqusGui and fails with "Module abaqusGui can
 *  only be used in Abaqus/CAE GUI" in the startup kernel engine (verified).
 *
 *  Resolution order:
 *    1. env ABAQUS_MCP_HOME (dir named `cae_bridge_plugin.py` first, then
 *       abaqus_mcp_plugin.py)
 *    2. this plugin's own `bridge/cae_bridge_plugin.py` (shipped with the pkg)
 *    3. ~/.abaqus-mcp/cae_bridge_plugin.py
 *    4. ~/.abaqus-mcp/abaqus_mcp_plugin.py (stock fallback)
 *    5. an explicit bridgePluginPath passed via config.
 */
function defaultBridgePluginPath() {
    const home = os.homedir();
    const explicit = process.env.BRIDGE_PLUGIN_PATH;
    // This module lives in <pkg>/lib/; the shipped kernel bridge is at
    // <pkg>/bridge/cae_bridge_plugin.py. Derive the package root's absolute path
    // from this module's URL (ESM) so webServer resolution never sees an
    // un-basable `new URL('.')` (which threw "Invalid URL" at load time and
    // failed the whole dsh-cae-agent bundle).
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const shippedBridge = path.resolve(moduleDir, '..', 'bridge', 'cae_bridge_plugin.py');
    const candidates = [
        explicit,
        path.join(home, '.abaqus-mcp', 'cae_bridge_plugin.py'),
        shippedBridge,
        path.join(home, '.abaqus-mcp', 'abaqus_mcp_plugin.py'),
    ].filter(Boolean);
    for (const c of candidates) {
        try {
            if (c && fs.existsSync(c))
                return c;
        }
        catch { /* keep looking */ }
    }
    return path.join(home, '.abaqus-mcp', 'abaqus_mcp_plugin.py');
}
/** Default workspace: a per-user temp/abaqus-cae dir (portable, no hardcoded path). */
function defaultWorkspaceDir() {
    return path.join(os.tmpdir(), 'abaqus-cae');
}
/** Schemastery schema for {@link Config}; defaults live in the schema. */
export const Config = Schema.object({
    host: Schema.string().default('127.0.0.1'),
    port: Schema.number().default(48152),
    timeoutMs: Schema.number().default(120_000),
    abaqusCommand: Schema.string().default(defaultAbaqusCommand()),
    bridgePluginPath: Schema.string().default(defaultBridgePluginPath()),
    workspaceDir: Schema.string().default(defaultWorkspaceDir()),
    launchTimeoutMs: Schema.number().default(180_000),
});
/** Register every tool domain on the provided context + config. */
export function apply(ctx, config) {
    registerRead(ctx, config);
    registerMaterial(ctx, config);
    registerGeometry(ctx, config);
    registerSetup(ctx, config);
    registerInteraction(ctx, config);
    registerMesh(ctx, config);
    registerJob(ctx, config);
    registerLaunch(ctx, config);
    registerComposite(ctx, config);
    registerTelemetry(ctx, config);
}
