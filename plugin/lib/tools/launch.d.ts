/**
 * tools/launch.ts — Tier-1/ops tool: launch a local Abaqus/CAE GUI session and
 * auto-start its socket bridge so the rest of the abaqus_* tools can connect.
 *
 * This is deliberately a *process/ops* tool, not a modeling tool: it starts a
 * child process on the host. In an interactive desktop session it pops an
 * Abaqus/CAE window (that is expected). Once the bridge port answers, every
 * other tool in this plugin operates against that live session.
 *
 * Strategy:
 *   1. If the bridge port is already listening, return `{ launched: false }`
 *      (idempotent — reuse the running session).
 *   2. Write a startup file into the configured workspace that loads
 *      `abaqus_mcp_plugin.py` into `__main__` **and** calls `mcp_start()`,
 *      so the bridge opens automatically (no manual menu click).
 *   3. Spawn `abaqus <command> cae script=<startup.py>` detached.
 *   4. Poll the bridge port until it listens (respecting `exec.signal` and the
 *      `launchTimeoutMs` budget), then return the handle.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Plugin launch config subset this tool consumes. */
export interface LaunchConfig {
    host: string;
    port: number;
    abaqusCommand: string;
    bridgePluginPath: string;
    workspaceDir: string;
    launchTimeoutMs: number;
}
export declare function registerLaunch(ctx: Context, config: LaunchConfig): void;
