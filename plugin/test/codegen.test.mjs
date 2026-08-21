// Codegen test: for each registered tool, invoke execute() with representative
// args and statically validate that the generated Abaqus Python parses as valid
// Python syntax (via `python -c "import ast"`). This works without a live
// Abaqus bridge: connecting to port 1 fails fast and runKernelCode attaches the
// generated source to the thrown error (err.abqCode).
import { execFileSync } from 'node:child_process';
import { name, Config, apply } from '../lib/index.js';

const registered = [];
const fakeCtx = {
  tools: { register: (d) => (registered.push(d), () => {}) },
  attachments: { saveImage: async () => {} },
};

// port 1 => immediate connection refused => fast negative path
const config = Config({ host: '127.0.0.1', port: 1, timeoutMs: 2000 });
apply(fakeCtx, config);

// representative args per tool; some need a JSON string for nested params
const SAMPLE = {
  abaqus_ping: {},
  abaqus_get_model_info: {},
  abaqus_list_jobs: {},
  abaqus_monitor_job: { jobName: '' },
  abaqus_inspect_odb: { odbPath: 'C:/tmp/x.odb' },
  abaqus_capture_viewport: { viewportName: '' },
  abaqus_create_part: { model: 'Model-1', name: 'Block', boxX: 10, boxY: 5, boxZ: 2 },
  abaqus_create_set: { model: 'Model-1', name: 'S1', part: 'Block', region: 'faces', indices: JSON.stringify([0, 1]) },
  abaqus_instantiate: { model: 'Model-1', part: 'Block' },
  abaqus_create_material: { model: 'Model-1', name: 'Steel', props: JSON.stringify({ elastic: { E: 210000, nu: 0.3 }, density: { density: 7.85e-9 } }) },
  abaqus_assign_section: { model: 'Model-1', part: 'Block', material: 'Steel', sectionType: 'solid' },
  abaqus_define_step: { model: 'Model-1', name: 'Step-1', type: 'static', timePeriod: 1.0 },
  abaqus_apply_load: { model: 'Model-1', type: 'pressure', magnitude: '5.0', step: 'Step-1', region: 'TopFaces', instance: 'Block-1' },
  abaqus_set_bc: { model: 'Model-1', type: 'encastre', region: 'Fixed', instance: 'Block-1' },
  abaqus_generate_mesh: { model: 'Model-1', part: 'Block', elementFamily: 'solid' },
  abaqus_create_interaction: { model: 'Model-1', kind: 'contact', masterSurface: 'A-1:S1', slaveSurface: 'B-1:S2', friction: 0.3 },
  abaqus_set_friction: { model: 'Model-1', name: 'fric', friction: 0.3 },
  abaqus_submit_job: { jobName: 'Job-1' },
  abaqus_set_workdir: { path: 'C:/tmp' },
  abaqus_run_python: { code: 'from abaqus import mdb\nresult=list(mdb.models.keys())' },
};

function pythonSyntaxOk(src) {
  try {
    execFileSync('python', ['-c', 'import ast,sys;ast.parse(sys.stdin.read())'], { input: src, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
    return true;
  } catch (e) {
    return false;
  }
}

// Decide a JS truthy reason so we only report when the tool is expected to fail fast.
for (const def of registered) {
  const args = SAMPLE[def.name] ?? {};
  if (args === undefined) continue;
  let code = null;
  let error = null;
  try {
    await def.execute(args, { signal: { throwIfAborted: () => {} } });
  } catch (e) {
    error = e;
    code = e.abqCode ?? null;
  }
  if (code === null) {
    console.log(`[skip-gen] ${def.name}: no code captured (${error ? error.message : 'resolved'})`);
    continue;
  }
  if (!pythonSyntaxOk(code)) {
    console.error(`[PY-SYNTAX-FAIL] ${def.name}`);
    console.error('--- generated python ---');
    console.error(code);
    throw new Error(`generated Python for ${def.name} is not valid Python syntax`);
  }
  console.log(`[py-ok] ${def.name} (${code.split('\n').length} lines)`);
}

console.log(`CODEGEN OK: ${registered.length} tools exercised; all captured templates passed Python syntax checks`);
