// e2e.mjs — live-bridge end-to-end test for dsh-cae-agent.
// Requires a running Abaqus/CAE with the socket bridge open (127.0.0.1:48152).
// Drives the ACTUAL plugin tools (validation + execute) over the plugin protocol
// and checks each against its success criterion. Write-tool scenarios run in a
// fresh test model so the user's working model is not polluted.
import net from 'node:net'
import { Config, apply } from '../lib/index.js'

const HOST = '127.0.0.1'
const PORT = 48152

// Re-register the plugin tools onto a collecting fake ctx so we drive the real tools.
const registered = []
const fakeCtx = {
  tools: { register: (d) => (registered.push(d), () => {}) },
  attachments: { saveImage: async () => ({}) },
}
const config = Config({ host: HOST, port: PORT, timeoutMs: 90000 })
apply(fakeCtx, config)
const tools = new Map(registered.map((d) => [d.name, d]))

/** One JSON-over-TCP request to the bridge. */
function bridgeRequest(method, params, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = `e2e-${Math.random().toString(36).slice(2, 10)}`
    const payload = JSON.stringify({ id, method, params: { ...(params || {}), timeout: timeoutMs / 1000 } })
    const socket = new net.Socket()
    let settled = false
    const chunks = []
    const finish = (fn, v) => { if (settled) return; settled = true; socket.destroy(); fn(v) }
    const timer = setTimeout(() => finish(reject, new Error(`bridge timeout ${method}`)), timeoutMs + 5000)
    socket.on('error', (e) => { clearTimeout(timer); finish(reject, new Error(`bridge unreachable: ${e.message}`)) })
    socket.connect(PORT, HOST, () => socket.write(payload + '\n'))
    socket.on('data', (c) => {
      chunks.push(c)
      const b = Buffer.concat(chunks)
      const nl = b.indexOf(10)
      if (nl < 0) return
      clearTimeout(timer)
      finish(resolve, JSON.parse(b.subarray(0, nl).toString('utf8')))
    })
  })
}
/** Run kernel python and return the parsed result value (throws on bridge/ok false). */
async function kernel(code, timeoutMs = 30000) {
  const r = await bridgeRequest('execute', { code }, timeoutMs)
  if (!r?.ok || r.result?.ok === false) {
    const e = r?.result?.core_error || r?.result?.error || JSON.stringify(r)
    throw new Error(`kernel error: ${e}`)
  }
  return r.result?.return_value
}

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
}
const execCtx = { signal: new AbortController().signal, agent: null, token: 'e2e', parent: null }
async function runTool(name, args) {
  const t = tools.get(name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t.execute(args, execCtx)
}

// ---------------------------------------------------------------------------
const TEST_MODEL = 'Model-E2E'
const PART = 'PartE2E'

try {
  // --- Read-only baseline ---
  const ping = await bridgeRequest('ping', {})
  check('bridge reachable + ping', ping?.ok === true, ping?.result ? `models=${JSON.stringify(ping.result.models)}` : '')

  const info = await runTool('abaqus_get_model_info', {})
  check('abaqus_get_model_info returns models', !!info && Object.keys(info).length > 0, `models=${Object.keys(info || {}).join(',')}`)

  const jobs = await runTool('abaqus_list_jobs', {})
  check('abaqus_list_jobs returns array', Array.isArray(jobs), `jobs=${(jobs || []).map((j) => j.name).join(',')}`)

  // Ensure a clean test model.
  await kernel(`from abaqus import mdb
if ${JSON.stringify(TEST_MODEL)} in mdb.models: del mdb.models[${JSON.stringify(TEST_MODEL)}]
mdb.Model(name=${JSON.stringify(TEST_MODEL)})
result="ok"`)

  // --- create_part: solid box ---
  const part = await runTool('abaqus_create_part', { model: TEST_MODEL, name: PART, boxX: 2, boxY: 1, boxZ: 0.5 })
  check('abaqus_create_part (box) ok', !!part && part.cells >= 1, `part=${part?.name} cells=${part?.cells}`)

  // --- create_set: cells on the part (omit indices = select all) ---
  const set = await runTool('abaqus_create_set', { model: TEST_MODEL, name: 'AllCells', part: PART, region: 'cells' })
  check('abaqus_create_set (cells, all) ok', !!set && set.count === part?.cells, `set=${set?.set} count=${set?.count}`)

  // --- instantiate ---
  const inst = await runTool('abaqus_instantiate', { model: TEST_MODEL, part: PART, instanceName: 'InstE2E' })
  check('abaqus_instantiate ok', !!inst && !!inst.instance, `instance=${inst?.instance}`)

  // --- create_material ---
  const mat = await runTool('abaqus_create_material', {
    model: TEST_MODEL, name: 'E2E_SOLID',
    props: JSON.stringify({ elastic: { E: 200000, nu: 0.3 }, density: { density: 7.85e-9 } }),
  })
  check('abaqus_create_material ok', !!mat && mat.materialExists === true, `material=${mat?.name}`)

  // --- assign_section: explicit solid on the box part ---
  const sec = await runTool('abaqus_assign_section', { model: TEST_MODEL, part: PART, material: 'E2E_SOLID', sectionType: 'solid', region: 'AllCells' })
  check('abaqus_assign_section (solid, named set) ok', !!sec && !!sec.section, `section=${sec?.section} region=${sec?.assignedRegion}`)

  // --- define_step: static ---
  const step = await runTool('abaqus_define_step', { model: TEST_MODEL, name: 'Step-1', type: 'static', timePeriod: 1.0 })
  check('abaqus_define_step (static) ok', !!step && !!step.step, `step=${step?.step} type=${step?.type}`)

  // --- apply_load: pressure on a face is hard without a face set; do gravity (no region) instead ---
  const load = await runTool('abaqus_apply_load', { model: TEST_MODEL, type: 'gravity', step: 'Step-1', magnitude: '9.8', direction: 'Y' })
  check('abaqus_apply_load (gravity) ok', !!load && !!load.load, `load=${load?.load} type=${load?.type}`)

  // --- set_bc: encastre on the cells set region (assembly). Use instance set if needed ---
  // create an assembly-level set from the instance's cells via tool, then encastre
  await kernel(`from abaqus import mdb
a=mdb.models[${JSON.stringify(TEST_MODEL)}].rootAssembly
inst=a.instances[${JSON.stringify(inst?.instance)}]
if "FixSet" not in a.sets:
    a.Set(name="FixSet", cells=inst.cells[0:1])
result="ok"`)
  const bc = await runTool('abaqus_set_bc', { model: TEST_MODEL, type: 'encastre', region: 'FixSet', step: 'Initial' })
  check('abaqus_set_bc (encastre) ok', !!bc && !!bc.bc, `bc=${bc?.bc} type=${bc?.type}`)

  // --- generate_mesh: solid on the part (independent instance? our Instance here is independent by tool default) ---
  const mesh = await runTool('abaqus_generate_mesh', { model: TEST_MODEL, part: PART, elementFamily: 'solid', size: 0.5 })
  check('abaqus_generate_mesh (solid) ok', !!mesh && (mesh.elements || 0) > 0, `elements=${mesh?.elements} nodes=${mesh?.nodes} target=${mesh?.target}`)

  // --- set_workdir: change Abaqus cwd to a clean dir (does not alter the model) ---
  const prevCwd = (await bridgeRequest('execute', { code: 'import os; result=os.getcwd()' }))?.result?.return_value
  const wk = await runTool('abaqus_set_workdir', { path: 'D:/temp' })
  check('abaqus_set_workdir ok', !!wk && (wk.current === 'D:/temp' || wk.current === 'D:\\temp'), `current=${wk?.current}`)

  // --- run_python: arbitrary kernel python through the plugin fallback ---
  const rp = await runTool('abaqus_run_python', { code: 'from abaqus import mdb\nresult=len(mdb.models.keys())' })
  check('abaqus_run_python ok', rp !== undefined && rp !== null, `value=${JSON.stringify(rp)}`)

  // --- set_friction: create an interaction property (contact half) ---
  const fr = await runTool('abaqus_set_friction', { model: TEST_MODEL, name: 'E2E_fric', friction: 0.4 })
  check('abaqus_set_friction ok', !!fr && !!fr.property, `property=${fr?.property} friction=${fr?.friction}`)

  // --- submit_job: non-blocking. Create a tiny job then submit; the tool must
  //     return promptly (mode=submitted) AND the bridge must still answer ---- 
  await kernel(`from abaqus import mdb
if "JobE2E" in mdb.jobs: del mdb.jobs["JobE2E"]
mdb.Job(name="JobE2E", model=${JSON.stringify(TEST_MODEL)})
result="ok"`)
  const t0 = Date.now()
  let sub
  try { sub = await runTool('abaqus_submit_job', { jobName: 'JobE2E' }) } catch (e) { sub = { submitErr: String(e?.message) } }
  const submitMs = Date.now() - t0
  check('abaqus_submit_job non-blocking', !!sub && sub.mode === 'submitted', `mode=${sub?.mode ?? sub?.submitErr} returnedIn=${submitMs}ms`)
  // prove the bridge is NOT blocked after submit: a quick ping must answer
  const post = await bridgeRequest('ping', {}, 8000)
  check('bridge responsive after submit (non-blocking)', post?.ok === true || !!post?.result, 'bridge still answers')

  // --- monitor_job: should list the job / report status (read .sta via kernel) ---
  const mon = await runTool('abaqus_monitor_job', { jobName: '' })
  check('abaqus_monitor_job returns jobs array', !!mon && Array.isArray(mon.jobs), `jobs=${(mon?.jobs || []).map((j) => j.name).join(',')}`)

  // restore cwd
  if (prevCwd) { try { await runTool('abaqus_set_workdir', { path: prevCwd }) } catch { /* ignore */ } }

  // --- get_model_info should now include the test model's objects ---
  const after = await runTool('abaqus_get_model_info', {})
  const tmi = after?.[TEST_MODEL]
  check('get_model_info reflects E2E model', !!tmi,
    `model=${TEST_MODEL} parts=${(tmi?.parts || []).join(',')} mats=${(tmi?.materials || []).join(',')} steps=${(tmi?.steps || []).join(',')} bcs=${(tmi?.bc || []).length} loads=${(tmi?.loads || []).length}`)

} catch (e) {
  check('unexpected e2e error', false, String(e?.message || e))
} finally {
  // cleanup the test model (removes its job too)
  try { await kernel(`from abaqus import mdb
if ${JSON.stringify(TEST_MODEL)} in mdb.models: del mdb.models[${JSON.stringify(TEST_MODEL)}]
if "JobE2E" in mdb.jobs: del mdb.jobs["JobE2E"]
result="cleaned"`) } catch { /* ignore */ }
}

const passed = results.filter((r) => r.ok).length
console.log(`\nE2E SUMMARY: ${passed}/${results.length} passed`)
process.exit(results.some((r) => !r.ok) ? 1 : 0)
