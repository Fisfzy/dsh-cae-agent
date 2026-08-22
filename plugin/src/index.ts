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
import Schema from '@deepseek-ai/schemastery'
import { registerRead } from './tools/read.js'
import { registerMaterial } from './tools/material.js'
import { registerGeometry } from './tools/geometry.js'
import { registerSetup } from './tools/setup.js'
import { registerInteraction } from './tools/interaction.js'
import { registerMesh } from './tools/mesh.js'
import { registerJob } from './tools/job.js'
import { registerLaunch } from './tools/launch.js'

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

/** Schemastery schema for {@link Config}; defaults live in the schema. */
export const Config: Schema<Config> = Schema.object({
  host: Schema.string().default('127.0.0.1'),
  port: Schema.number().default(48152),
  timeoutMs: Schema.number().default(120_000),
  abaqusCommand: Schema.string().default('D:/SIMULIA/Commands/abaqus.bat'),
  bridgePluginPath: Schema.string().default('C:/Users/Fisfzy/.abaqus-mcp/abaqus_mcp_plugin.py'),
  workspaceDir: Schema.string().default('C:/Users/Fisfzy/.dsh/abaqus-cae'),
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
}
