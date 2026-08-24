/**
 * kernels.ts — reusable Abaqus kernel snippets (Python source strings) run
 * via `runKernelCode`. Keeping them here means the live-progress route
 * (`/cae/api/modelinfo`) and the model tools share the SAME introspection
 * logic, so the sidebar's "real state" matches what the tools report.
 *
 * All snippets are read-only (inspect mdb/session/jobs), safe to run as often
 * as the UI polls.
 */
/**
 * Snapshot the live CAE session: every model's facets (parts, materials,
 * sections, steps, loads, BCs, interactions, constraints, amplitudes,
 * assembly instances/sets/surfaces) plus the job list and the kernel cwd.
 *
 * This is the union of `abaqus_get_model_info` + `abaqus_list_jobs` +
 * `abaqus_monitor_job`-style os.getcwd(), folded into one round-trip so the
 * sidebar's per-step "real state" cards derive from an atomic snapshot.
 */
export declare const SESSION_STATE_KERNEL = "from abaqus import mdb, session\nimport os\ndef _k(o):\n    try: return list(o.keys())\n    except Exception: return []\nmodels={}\nfor mn in mdb.models.keys():\n    m=mdb.models[mn]\n    models[mn]={\"parts\":_k(m.parts),\"materials\":_k(m.materials),\"sections\":_k(m.sections),\n                \"steps\":_k(m.steps),\"loads\":_k(m.loads),\"bc\":_k(m.boundaryConditions),\n                \"interactions\":_k(m.interactions),\"constraints\":_k(m.constraints),\n                \"amplitudes\":_k(m.amplitudes),\"instances\":_k(m.rootAssembly.instances),\n                \"sets\":_k(m.rootAssembly.sets),\"surfaces\":_k(m.rootAssembly.surfaces)}\njobs=[]\nfor n in mdb.jobs.keys():\n    j=mdb.jobs[n]\n    item={\"name\":n}\n    for a in (\"status\",\"type\",\"model\",\"description\",\"numCpus\",\"numDomains\",\"memory\",\"explicitPrecision\"):\n        try:\n            v=getattr(j,a,None)\n            if v is not None: item[a]=str(v)\n        except Exception: pass\n    jobs.append(item)\nresult={\"models\":models,\"jobs\":jobs,\"cwd\":os.getcwd()}";
