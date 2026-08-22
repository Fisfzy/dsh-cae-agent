import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
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
export const name = 'dsh-cae-agent';
/** Runtime dependencies this plugin requires before it can load. `attachments`
 * is needed by `capture_viewport` (image persistence); `tools` is the registry
 * every tool is registered on. Both are required, so both belong in inject. */
export const inject = ['tools', 'attachments'];
/** Resolve the Abaqus launcher command without machine-specific hardcoding:
 * prefer an explicit env override, then a bare `abaqus` on PATH. */
function defaultAbaqusCommand() {
    const candidates = [process.env.ABAQUS_COMMAND, 'abaqus'].filter(Boolean);
    for (const c of candidates) {
        if (c === 'abaqus')
            return c;
        try {
            if (fs.existsSync(c))
                return c;
        }
        catch { /* keep looking */ }
    }
    return 'abaqus';
}
/** Resolve the Abaqus MCP bridge plugin under the current user's home. */
function defaultBridgePluginPath() {
    const home = os.homedir();
    const candidates = [
        process.env.ABAQUS_MCP_HOME,
        path.join(home, '.abaqus-mcp', 'abaqus_mcp_plugin.py'),
    ].filter(Boolean);
    for (const c of candidates) {
        try {
            if (fs.existsSync(c))
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
}
