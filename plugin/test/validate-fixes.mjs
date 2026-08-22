// validate-fixes.mjs — verify tool fixes + distilled skills (composite/ortho-mat/amplitude/field/output/plot/csv) against the live bridge.
// Self-contained + portable: builds its own models and ODB in os.tmpdir(); no machine-specific paths.
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Config, apply } from '../lib/index.js'

const HOST = '127.0.0.1'
const PORT = 48152
const registered = []
const fakeCtx = {
  tools: { register: (d) => (registered.push(d), () => {}) },
  attachments: { saveImage: async () => ({}) },
}
const config = Config({ host: HOST, port: PORT, timeoutMs: 90000 })
apply(fakeCtx, config)
const tools = new Map(registered.map((d) => [d.name, d]))

function bridgeRequest(method, params, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = `v-${Math.random().toString(36).slice(2, 10)}`
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
async function kernel(code, timeoutMs = 30000) {
  const r = await bridgeRequest('execute', { code }, timeoutMs)
  if (!r?.ok || r.result?.ok === false) throw new Error(`kernel error: ${r?.result?.core_error || r?.result?.error || JSON.stringify(r)}`)
  return r.result?.return_value
}
const execCtx = { signal: new AbortController().signal, agent: null, token: 'v', parent: null }
async function runTool(name, args) {
  const t = tools.get(name)
  if (!t) throw new Error(`tool ${name} not registered`)
  return t.execute(args, execCtx)
}
function report(label, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`) }

await kernel(`from abaqus import mdb
if "FixTest" in mdb.models: del mdb.models["FixTest"]
if "FixComp" in mdb.models: del mdb.models["FixComp"]
mdb.Model(name="FixTest"); mdb.Model(name="FixComp")
result="ok"`)

try {
  // ===== FixTest: the 3 tool fixes (solid box) =====
  const part = await runTool('abaqus_create_part', { model: 'FixTest', name: 'BP', boxX: 10, boxY: 5, boxZ: 2 })
  report('create_part', !!part && part.cells >= 1, `cells=${part?.cells}`)
  const setF = await runTool('abaqus_create_set', { model: 'FixTest', name: 'FaceTop', part: 'BP', region: 'faces', indices: JSON.stringify({ points: [[5, 2.5, 2]] }) })
  report('create_set findAt (faces, top)', !!setF && setF.count >= 1, `set=${setF?.set} count=${setF?.count}`)
  const inst = await runTool('abaqus_instantiate', { model: 'FixTest', part: 'BP', instanceName: 'BP-1' })
  report('instantiate', !!inst && !!inst.instance, `instance=${inst?.instance}`)
  const step = await runTool('abaqus_define_step', { model: 'FixTest', name: 'Step-1', type: 'static', timePeriod: 1.0 })
  report('define_step NO prevStepName (default based)', !!step && !!step.step && step.previous === 'Initial', `previous=${step?.previous}`)
  const load = await runTool('abaqus_apply_load', { model: 'FixTest', type: 'pressure', step: 'Step-1', region: 'FaceTop', instance: 'BP-1', magnitude: '5' })
  report('apply_load pressure (Set->Surface)', !!load && !!load.load, `load=${load?.load}`)

  // ===== FixComp: distilled skills =====
  await kernel(`from abaqus import mdb
from abaqusConstants import THREE_D, DEFORMABLE_BODY, ENGINEERING_CONSTANTS
m=mdb.models["FixComp"]
p=m.Part(name="CPlate", dimensionality=THREE_D, type=DEFORMABLE_BODY)
s=m.ConstrainedSketch(name="_p_", sheetSize=5000); s.rectangle(point1=(0,0), point2=(100,100))
p.BaseShell(sketch=s); del m.sketches["_p_"]
mat=m.Material(name="CF"); mat.Elastic(table=((135000,10000,10000,0.3,0.3,0.4,5000,5000,4000),), type=ENGINEERING_CONSTANTS)
result="ok"`)

  // composite layup
  const comp = await runTool('abaqus_define_composite_layup', { model: 'FixComp', part: 'CPlate', material: 'CF', plyAngles: JSON.stringify([0, 90, 0, 90]), plyThickness: 0.2 })
  report('define_composite_layup (0/90/0/90)', !!comp && comp.numPlies === 4, `section=${comp?.section} plies=${comp?.numPlies}`)
  const csec = await kernel(`from abaqus import mdb
sec=mdb.models["FixComp"].sections["CPlate-Composite"]
result={"n":len(sec.layup),"ang":[getattr(l,"orientAngle",None) for l in sec.layup]}`)
  report('composite 4 plies @ 0/90/0/90', csec?.n === 4 && JSON.stringify(csec?.ang) === '[0,90,0,90]', JSON.stringify(csec))

  // orthotropic material
  const om = await runTool('abaqus_define_orthotropic_material', { model: 'FixComp', name: 'CFOrtho', elasticType: 'ENGINEERING_CONSTANTS', table: JSON.stringify([[135000, 10000, 10000, 0.3, 0.3, 0.4, 5000, 5000, 4000]]) })
  report('define_orthotropic_material', om?.rows === 1 && om?.elasticType === 'ENGINEERING_CONSTANTS', `rows=${om?.rows}`)

  // amplitude
  const amp = await runTool('abaqus_define_amplitude', { model: 'FixComp', name: 'Ramp', amplitudeType: 'TABULAR', data: JSON.stringify([[0, 0], [1, 1]]) })
  report('define_amplitude (tabular)', amp?.points === 2, `points=${amp?.points} type=${amp?.type}`)

  // instantiate + set + step + field + output
  const inst2 = await runTool('abaqus_instantiate', { model: 'FixComp', part: 'CPlate', instanceName: 'CPlate-1' })
  report('instantiate CPlate', !!inst2 && inst2.instance === 'CPlate-1', `inst=${inst2?.instance}`)
  await kernel(`from abaqus import mdb
p=mdb.models["FixComp"].parts["CPlate"]
p.Set(name="AllFace", faces=p.faces)
result="ok"`)
  const stepC = await runTool('abaqus_define_step', { model: 'FixComp', name: 'Step-1', type: 'static', timePeriod: 1.0 })
  report('define_step static (FixComp)', !!stepC && stepC.step === 'Step-1', `step=${stepC?.step}`)
  const pf = await runTool('abaqus_define_predefined_field', { model: 'FixComp', name: 'InitT', fieldType: 'TEMPERATURE', region: 'AllFace', instance: 'CPlate-1', step: 'Initial', magnitude: 100 })
  report('define_predefined_field (temperature)', pf?.field === 'InitT' && pf?.type === 'TEMPERATURE', `field=${pf?.field}`)
  const out = await runTool('abaqus_set_output', { model: 'FixComp', step: 'Step-1', outputType: 'FIELD', variables: JSON.stringify(['S', 'U', 'RF']) })
  report('set_output (field S,U,RF)', out?.output && out?.type === 'FIELD', `out=${out?.output} vars=${out?.vars}`)
  await kernel(`from abaqus import mdb
if "FixHeat" in mdb.models: del mdb.models["FixHeat"]
mdb.Model(name="FixHeat")
result="ok"`)
  const heat = await runTool('abaqus_define_step', { model: 'FixHeat', name: 'Heat-1', type: 'heat', timePeriod: 1.0 })
  report('define_step heat (extension)', !!heat && heat.step === 'Heat-1' && heat.type === 'heat', `step=${heat?.step} proc=${heat?.procedure}`)

  // --- self-contained: build + run a small composite job in tmpdir, then plot/csv on its ODB ---
  const tmp = os.tmpdir()
  await runTool('abaqus_set_workdir', { path: tmp })
  await runTool('abaqus_generate_mesh', { model: 'FixComp', part: 'CPlate', elementFamily: 'shell', size: 20 })
  await kernel(`from abaqus import mdb
p=mdb.models["FixComp"].parts["CPlate"]
be=p.edges.findAt(((50,0,0),)); te=p.edges.findAt(((50,100,0),))
p.Set(name="BotEdge", edges=be); p.Set(name="TopEdge", edges=te)
result="ok"`)
  await runTool('abaqus_set_bc', { model: 'FixComp', type: 'encastre', region: 'BotEdge', instance: 'CPlate-1', step: 'Step-1', name: 'BCfix' })
  await runTool('abaqus_set_bc', { model: 'FixComp', type: 'displacement', region: 'TopEdge', instance: 'CPlate-1', step: 'Step-1', u2: 0.5, name: 'BCdisp' })
  await kernel(`from abaqus import mdb
if "FixJob" in mdb.jobs: del mdb.jobs["FixJob"]
mdb.Job(name="FixJob", model="FixComp"); mdb.jobs["FixJob"].submit(consistencyChecking=False)
result="ok"`)
  let okJob = false
  for (let i = 0; i < 40; i++) {
    const st = await kernel(`from abaqus import mdb
result=str(mdb.jobs["FixJob"].status)`)
    if (st === 'COMPLETED') { okJob = true; break }
    if (st === 'ABORTED') break
    await new Promise((r) => setTimeout(r, 1000))
  }
  report('composite job completed (for plot/csv)', okJob, 'generated ODB in tmpdir')
  const odb = path.join(tmp, 'FixJob.odb')
  const plot = await runTool('abaqus_plot_contour', { odbPath: odb, fieldVariable: 'U', invariant: 'Magnitude', scaleFactor: 50, view: 'Iso' })
  report('plot_contour (U/Magnitude)', !!plot && plot.field === 'U', `field=${plot?.field} frame=${plot?.frame}`)
  const csv = await runTool('abaqus_export_results_csv', { odbPath: odb, outputPath: path.join(tmp, 'FixJob_U.csv'), fieldVariable: 'U' })
  report('export_results_csv (U)', !!csv && csv.rows > 0, `rows=${csv?.rows} cols=${csv?.cols}`)
} catch (e) {
  report('unexpected error', false, String(e?.message || e))
} finally {
  try { await kernel(`from abaqus import mdb
if "FixTest" in mdb.models: del mdb.models["FixTest"]
if "FixComp" in mdb.models: del mdb.models["FixComp"]
if "FixHeat" in mdb.models: del mdb.models["FixHeat"]
result="cleaned"`) } catch { /* ignore */ }
}
