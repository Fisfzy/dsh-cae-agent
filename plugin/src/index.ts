/**
 * dsh-cae-agent — DSH (DeepSeek Harness) Cordis plugin for Abaqus/CAE.
 *
 * Cordis plugin contract:
 *   export const name
 *   export interface Config + export const Config (Schemastery schema)
 *   export const inject = ['tools', 'attachments']
 *   export function apply(ctx, config)
 *
 * Written in TypeScript per the dsh-plugin-dev standard: every tool is
 * registered through ctx.tools.register(defineTool({ ... })), returns a
 * canonical JSON value, and renders human-facing text via output.render.
 *
 * Tool authorization tiers:
 *   Tier 1 (read-only, concurrency-safe): ping / get_model_info / list_jobs /
 *     monitor_job / inspect_odb / capture_viewport
 *   Tier 2 (controlled write, schema-guarded): create_part / create_set /
 *     instantiate / create_material / assign_section / define_step /
 *     apply_load / set_bc / generate_mesh / create_interaction / set_friction /
 *     submit_job / set_workdir
 *   Tier 3 (arbitrary code fallback): run_python
 *
 * License: MIT. Based on the socket-bridge architecture of CAE-Agent-Hub
 * (Copyright 2026 Thompson Labs) and Abaqus-Control-MCP (MIT, 2026 Abaqus
 * Control MCP Contributors). See NOTICE and LICENSE.
 */
import type { Context } from '@deepseek-ai/cordis'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import Schema from '@deepseek-ai/schemastery'
import { registerRead } from './tools/read.js'
import { registerMaterial } from './tools/material.js'
import { registerGeometry } from './tools/geometry.js'
import { registerSetup } from './tools/setup.js'
import { registerInteraction } from './tools/interaction.js'
import { registerMesh } from './tools/mesh.js'
import { registerJob } from './tools/job.js'
import { registerLaunch } from './tools/launch.js'
import { registerComposite } from './tools/composite.js'
import { registerTelemetry } from './telemetry.js'

export const name = 'dsh-cae-agent'

/** Runtime dependencies this plugin requires before it can load. `attachments`
 * is needed by `capture_viewport` (image persistence); `tools` is the registry
 * every tool is registered on. Both are required, so both belong in inject. */
export const inject = ['tools', 'attachments']

/** Plugin configuration (validated by Schemastery on load). */
export interface Config {
  /** Abaqus bridge host. */
  host: string
  /** Abaqus bridge port. */
  port: number
  /** Default per-call timeout in ms. */
  timeoutMs: number
  /** Abaqus launcher command (path to abaqus.bat / abaqus executable). */
  abaqusCommand: string
  /** Abaqus MCP socket-bridge plugin file loaded inside CAE. */
  bridgePluginPath: string
  /** Working directory where Abaqus/CAE is launched (and its startup file lives). */
  workspaceDir: string
  /** How long `abaqus_launch_cae` waits for the bridge to come up, in ms. */
  launchTimeoutMs: number
}

/** Windows `where`-style command resolution: return the first existing path
 *  for `cmd` found on PATH, or undefined. */
function resolveOnPath(cmd: string): string | undefined {
  try {
    const pick = process.platform === 'win32' ? 'where' : 'which'
    const res = spawnSync(pick, [cmd], { encoding: 'utf8', timeout: 5000, windowsHide: true })
    if (res.status !== 0) return undefined
    const line = res.stdout?.split(/\r?\n/).map((s) => s.trim()).find((s) => s && s.length > 0)
    if (!line) return undefined
    const resolved = process.platform === 'win32' ? line.replaceAll('/', '\\') : line
    try {
      if (process.platform === 'win32' && fs.existsSync(resolved)) return resolved
      if (fs.existsSync(resolved)) return resolved
    } catch { /* keep looking */ }
    return resolved
  } catch {
    return undefined
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
function defaultAbaqusCommand(): string {
  const env = process.env.ABAQUS_COMMAND
  if (env) return env
  // Probe common SIMULIA install layouts (glob the version dir).
  try {
    const simulia = process.env.SIMULIA ?? 'D:\\SIMULIA'
    for (const base of [simulia, 'C:\\SIMULIA']) {
      if (!fs.existsSync(base)) continue
      const exe = path.join(base, 'EstProducts', '2024', 'win_b64', 'code', 'bin', 'ABQcaeK.exe')
      if (fs.existsSync(exe)) return exe
      // fall back: any EstProducts/<ver>/win_b64/.../ABQcaeK.exe
      const est = path.join(base, 'EstProducts')
      if (fs.existsSync(est)) {
        for (const ver of fs.readdirSync(est)) {
          const p = path.join(est, ver, 'win_b64', 'code', 'bin', 'ABQcaeK.exe')
          if (fs.existsSync(p)) return p
        }
      }
    }
  } catch { /* keep looking */ }
  // Resolve `abaqus` (or `abaqus.bat`) to a real path via `where`.
  const fromPath = resolveOnPath('abaqus') ?? resolveOnPath('abaqus.bat')
  if (fromPath) return fromPath
  return 'abaqus'
}

/** Resolve the Abaqus MCP bridge plugin under the current user's home. */
function defaultBridgePluginPath(): string {
  const home = os.homedir()
  const candidates = [
    process.env.ABAQUS_MCP_HOME,
    path.join(home, '.abaqus-mcp', 'abaqus_mcp_plugin.py'),
  ].filter(Boolean) as string[]
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c } catch { /* keep looking */ }
  }
  return path.join(home, '.abaqus-mcp', 'abaqus_mcp_plugin.py')
}

/** Default workspace: a per-user temp/abaqus-cae dir (portable, no hardcoded path). */
function defaultWorkspaceDir(): string {
  return path.join(os.tmpdir(), 'abaqus-cae')
}

/** Schemastery schema for {@link Config}; defaults live in the schema. */
export const Config: Schema<Config> = Schema.object({
  host: Schema.string().default('127.0.0.1'),
  port: Schema.number().default(48152),
  timeoutMs: Schema.number().default(120_000),
  abaqusCommand: Schema.string().default(defaultAbaqusCommand()),
  bridgePluginPath: Schema.string().default(defaultBridgePluginPath()),
  workspaceDir: Schema.string().default(defaultWorkspaceDir()),
  launchTimeoutMs: Schema.number().default(180_000),
})

/** Register every tool domain on the provided context + config. */
export function apply(ctx: Context, config: Config): void {
  registerRead(ctx, config)
  registerMaterial(ctx, config)
  registerGeometry(ctx, config)
  registerSetup(ctx, config)
  registerInteraction(ctx, config)
  registerMesh(ctx, config)
  registerJob(ctx, config)
  registerLaunch(ctx, config)
  registerComposite(ctx, config)
  registerTelemetry(ctx, config)
}
