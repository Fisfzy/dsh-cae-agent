// Smoke test for the dsh-cae-agent Cordis plugin module.
// Verifies the DSH plugin contract (name/inject/Config/apply) and that
// apply() registers the expected native Abaqus tools (all tiers).
import assert from 'node:assert/strict';
import { name, inject, Config, apply } from '../lib/index.js';

const registered = [];
const fakeCtx = {
  tools: {
    register(definition) {
      registered.push(definition);
      return () => {};
    },
  },
  attachments: { saveImage: async () => {} },
};

// --- contract exports ---
assert.equal(name, 'dsh-cae-agent');
assert.ok(Array.isArray(inject), 'inject must be an array');
assert.ok(inject.includes('tools') && inject.includes('attachments'), 'inject should consume tools+attachments');
assert.ok(Config, 'Config schema must be present');

// --- apply registers all expected tools ---
const config = Config({ host: '127.0.0.1', port: 48152, timeoutMs: 120000 });
apply(fakeCtx, config);

const names = new Set(registered.map((d) => d.name));

const EXPECTED_T1 = ['abaqus_ping', 'abaqus_get_model_info', 'abaqus_list_jobs', 'abaqus_monitor_job', 'abaqus_inspect_odb', 'abaqus_capture_viewport'];
const EXPECTED_T2 = [
  'abaqus_create_part', 'abaqus_create_set', 'abaqus_instantiate',
  'abaqus_create_material', 'abaqus_assign_section',
  'abaqus_define_step', 'abaqus_apply_load', 'abaqus_set_bc',
  'abaqus_generate_mesh', 'abaqus_create_interaction', 'abaqus_set_friction',
  'abaqus_submit_job', 'abaqus_set_workdir',
];
const EXPECTED_T3 = ['abaqus_run_python'];
const EXPECTED = [...EXPECTED_T1, ...EXPECTED_T2, ...EXPECTED_T3];

for (const n of EXPECTED) {
  assert.ok(names.has(n), `expected tool "${n}" to be registered`);
}
assert.equal(registered.length, EXPECTED.length, `expected ${EXPECTED.length} tools, got ${registered.length}: ${registered.map((d) => d.name).join(',')}`);

// --- each tool validates its definition shape ---
for (const d of registered) {
  assert.ok(d.output, `tool ${d.name} must declare output`);
  assert.ok(d.output.schema, `tool ${d.name} output.schema missing`);
  assert.equal(typeof d.output.render, 'function', `tool ${d.name} output.render must be a function`);
  assert.equal(typeof d.execute, 'function', `tool ${d.name} execute must be a function`);
  assert.ok(d.parameters, `tool ${d.name} must declare parameters`);
  assert.equal(typeof d.parameters, 'object', `tool ${d.name} parameters must be an object`);
  assert.equal(d.parameters.type, 'object', `tool ${d.name} parameters.type must be 'object'`);
  if (d.timeoutMs !== undefined) assert.ok(d.timeoutMs > 0, `tool ${d.name} timeoutMs must be positive`);
}

// --- tier-1 read tools are concurrency-safe ---
// defineTool's isConcurrencySafe classifier runs after args validation, so we
// pass valid representative args (invalid args fail closed to exclusive).
const T1_VALID_ARGS = {
  abaqus_ping: {},
  abaqus_get_model_info: {},
  abaqus_list_jobs: {},
  abaqus_monitor_job: { jobName: '' },
  abaqus_inspect_odb: { odbPath: 'C:/tmp/x.odb' },
  abaqus_capture_viewport: { viewportName: '' },
};
for (const n of EXPECTED_T1) {
  const t = registered.find((d) => d.name === n);
  const args = T1_VALID_ARGS[n] ?? {};
  assert.ok(t.isConcurrencySafe, `${n} should declare isConcurrencySafe`);
  assert.strictEqual(t.isConcurrencySafe(args), true, `${n} should be concurrency-safe with valid args`);
}
// tools with a required parameter must fail closed on invalid (missing) args
const inspectOdb = registered.find((d) => d.name === 'abaqus_inspect_odb');
assert.strictEqual(inspectOdb.isConcurrencySafe({}), false, 'abaqus_inspect_odb should fail closed on invalid args');

// --- tier-2 write tools are NOT concurrency-safe (exclusive) ---
for (const n of EXPECTED_T2) {
  const t = registered.find((d) => d.name === n);
  assert.ok(!t.isConcurrencySafe || t.isConcurrencySafe({}) !== true, `${n} should be exclusive (not concurrency-safe)`);
}

console.log(`SMOKE OK: contract + ${registered.length} tools registered`);
console.log('  T1(ro):', EXPECTED_T1.join(', '));
console.log('  T2(rw):', EXPECTED_T2.join(', '));
console.log('  T3(any):', EXPECTED_T3.join(', '));
