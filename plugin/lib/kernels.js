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
export const SESSION_STATE_KERNEL = `from abaqus import mdb, session
import os
def _k(o):
    try: return list(o.keys())
    except Exception: return []
models={}
for mn in mdb.models.keys():
    m=mdb.models[mn]
    models[mn]={"parts":_k(m.parts),"materials":_k(m.materials),"sections":_k(m.sections),
                "steps":_k(m.steps),"loads":_k(m.loads),"bc":_k(m.boundaryConditions),
                "interactions":_k(m.interactions),"constraints":_k(m.constraints),
                "amplitudes":_k(m.amplitudes),"instances":_k(m.rootAssembly.instances),
                "sets":_k(m.rootAssembly.sets),"surfaces":_k(m.rootAssembly.surfaces)}
jobs=[]
for n in mdb.jobs.keys():
    j=mdb.jobs[n]
    item={"name":n}
    for a in ("status","type","model","description","numCpus","numDomains","memory","explicitPrecision"):
        try:
            v=getattr(j,a,None)
            if v is not None: item[a]=str(v)
        except Exception: pass
    jobs.append(item)
result={"models":models,"jobs":jobs,"cwd":os.getcwd()}`;
