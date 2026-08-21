// Minimal smoke test for the dsh-cae-agent Cordis plugin module.
// Verifies the DSH plugin contract (name/inject/Config/apply) and that
// apply() registers the expected Abaqus native tools via a fake ctx.tools.
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
  attachments: {
    saveImage: async () => {},
  },
};

// Contract exports
assert.equal(name, 'dsh-cae-agent');
assert.ok(Array.isArray(inject), 'inject must be an array');
assert.ok(inject.includes('tools'), 'inject should consume the tools service');
assert.ok(Config, 'Config schema must be present');

// apply() should register the expected tools
const config = Config({ host: '127.0.0.1', port: 48152, timeoutMs: 120000 });
apply(fakeCtx, config);

const names = registered.map((d) => d.name);
const expected = [
  'abaqus_ping',
  'abaqus_get_model_info',
  'abaqus_list_jobs',
  'abaqus_monitor_job',
  'abaqus_inspect_odb',
  'abaqus_capture_viewport',
  'abaqus_set_workdir',
  'abaqus_submit_job',
  'abaqus_run_python',
];
for (const n of expected) {
  assert.ok(names.includes(n), `expected tool ${n} to be registered`);
}
assert.equal(names.length, expected.length, 'tool count mismatch');

// Every registered tool must declare a valid output { schema, render }.
for (const d of registered) {
  assert.ok(d.output, `tool ${d.name} must declare output`);
  assert.ok(d.output.schema, `tool ${d.name} output.schema missing`);
  assert.equal(typeof d.output.render, 'function', `tool ${d.name} output.render must be a function`);
  assert.equal(typeof d.execute, 'function', `tool ${d.name} execute must be a function`);
  if (d.timeoutMs !== undefined) {
    assert.ok(d.timeoutMs > 0, `tool ${d.name} timeoutMs must be positive`);
  }
}

// read-only tools should be concurrency-safe per tier
const safe = registered.find((d) => d.name === 'abaqus_ping');
assert.ok(safe.isConcurrencySafe({}) === true, 'abaqus_ping should be concurrency-safe');

console.log('SMOKE OK: contract + ' + registered.length + ' tools registered');
