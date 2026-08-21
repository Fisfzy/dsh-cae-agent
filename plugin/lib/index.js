/**
 * dsh-cae-agent — DSH (DeepSeek Harness) Cordis plugin for Abaqus/CAE.
 *
 * Cordis plugin contract:
 *   export const name
 *   export const Config
 *   export const inject = ['tools', 'attachments']
 *   export function apply(ctx, config)
 *
 * This is the entry point. It aggregates tool registration from the domain
 * modules under lib/tools/ (read, material, geometry, setup, interaction,
 * mesh, job). Each tool speaks the Abaqus socket-bridge protocol over Node TCP
 * directly — no MCP hop — and is registered as a native DSH tool.
 *
 * Tool authorization tiers:
 *   Tier 1 (read-only, safe to auto-authorize): ping / get_model_info /
 *     list_jobs / monitor_job / inspect_odb / capture_viewport
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
import z from 'schemastery';
import { register as registerRead } from './tools/read.js';
import { register as registerMaterial } from './tools/material.js';
import { register as registerGeometry } from './tools/geometry.js';
import { register as registerSetup } from './tools/setup.js';
import { register as registerInteraction } from './tools/interaction.js';
import { register as registerMesh } from './tools/mesh.js';
import { register as registerJob } from './tools/job.js';

export const name = 'dsh-cae-agent';

/** Plugin config (schemastery). */
export const Config = z.object({
  /** Abaqus bridge host. */
  host: z.string().default('127.0.0.1'),
  /** Abaqus bridge port. */
  port: z.number().default(48152),
  /** Default per-call timeout in ms. */
  timeoutMs: z.number().default(120000),
  /** Whether capture_viewport should also persist the image as an attachment. */
  captureSaveImage: z.boolean().default(true),
});

export const inject = ['tools', 'attachments'];

/** Register every tool domain. */
function registerTools(ctx, config) {
  registerRead(ctx, config);
  registerMaterial(ctx, config);
  registerGeometry(ctx, config);
  registerSetup(ctx, config);
  registerInteraction(ctx, config);
  registerMesh(ctx, config);
  registerJob(ctx, config);
}

/** Cordis apply: build the bridge client and register the Abaqus native tools. */
export function apply(ctx, config) {
  registerTools(ctx, config);
}
