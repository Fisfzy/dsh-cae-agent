// Load test for the dsh-cae-agent TypeScript plugin: exercise the real Cordis
// runtime the way DSH does — create a root Context, provide the `tools` and
// `attachments` services the plugin injects, then load the plugin via
// ctx.plugin(). Confirms name/inject/Config/apply contract, Schemastery config
// defaults, and that apply() registers all expected abaqus_* tools.
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as plugin from '../lib/index.js'

// Collect registrations from the provided `tools` mock so we can assert.
const registered = []
const toolsMock = {
  register(def) {
    registered.push(def)
    return () => {}
  },
}

const ctx = new Context()
// Provide the services the plugin declares in `inject`.
ctx.provide('tools', toolsMock)
ctx.provide('attachments', { saveImage: async () => ({}) })

// --- Schemastery Config: defaults applied when config omitted ---
const fromDefaults = plugin.Config(undefined)
assert.equal(fromDefaults.host, '127.0.0.1', 'host default')
assert.equal(fromDefaults.port, 48152, 'port default')
assert.equal(fromDefaults.timeoutMs, 120000, 'timeoutMs default')

// --- load the plugin in a child fiber; pass the pre-validated config so the
// schemastery defaults are applied exactly as DSH's loader would ---
const cfg = plugin.Config({ host: '127.0.0.1', port: 48152, timeoutMs: 120000 })
const fiber = ctx.inject(plugin.inject, (child) => plugin.apply(child, cfg))

// cordis loads fibers asynchronously; wait a macrotask for apply to run.
await fiber
await new Promise((r) => setTimeout(r, 20))

// --- assert all 21 tools registered ---
const EXPECTED = [
  'abaqus_ping', 'abaqus_get_model_info', 'abaqus_list_jobs', 'abaqus_monitor_job',
  'abaqus_inspect_odb', 'abaqus_capture_viewport',
  'abaqus_create_part', 'abaqus_create_set', 'abaqus_instantiate',
  'abaqus_create_material', 'abaqus_assign_section',
  'abaqus_define_step', 'abaqus_apply_load', 'abaqus_set_bc',
  'abaqus_generate_mesh', 'abaqus_create_interaction', 'abaqus_set_friction',
  'abaqus_submit_job', 'abaqus_set_workdir',
  'abaqus_define_composite_layup',
  'abaqus_define_orthotropic_material',
  'abaqus_define_amplitude',
  'abaqus_define_predefined_field',
  'abaqus_set_output',
  'abaqus_plot_contour',
  'abaqus_export_results_csv',
  'abaqus_run_python',
  'abaqus_launch_cae',
]
const names = new Set(registered.map((d) => d.name))
for (const n of EXPECTED) {
  assert.ok(names.has(n), `expected tool "${n}" registered`)
}
assert.equal(registered.length, EXPECTED.length, `expected ${EXPECTED.length} tools, got ${registered.length}`)

// --- unloading disposes the fiber (registered tools are removed) ---
await fiber.dispose()

console.log(`LOAD OK: plugin loaded in real Cordis; ${registered.length} tools registered; fiber disposed cleanly`)
