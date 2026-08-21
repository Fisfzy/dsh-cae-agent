/**
 * tools/read.js — Tier 1 (read-only) Abaqus tools. Safe to auto-authorize:
 * these never mutate the model or submit work. All are concurrency-safe.
 */
import { registerTool, runKernelCode, bridgeRequest } from '../core.js';

export function register(ctx, config) {
  registerTool(ctx, config, {
    name: 'abaqus_ping',
    description:
      'Check whether the Abaqus/CAE socket bridge is reachable and report live session telemetry (models, viewports, Abaqus version).',
    params: { timeoutMs: { type: 'number', description: 'Optional per-call timeout in ms' } },
    executeImpl: async (args, _exec, br) =>
      bridgeRequest(br.host, br.port, 'ping', {}, args.timeoutMs ?? 10000),
    opts: { timeoutMs: 30000, isConcurrencySafe: () => true },
  });

  registerTool(ctx, config, {
    name: 'abaqus_get_model_info',
    description:
      'Read-only inventory of the current Abaqus session: models with parts, materials, sections, steps, loads, BCs, interactions, sets, surfaces, assembly instances, plus jobs and viewports.',
    executeImpl: async (_args, _exec, br) =>
      runKernelCode(
        br,
        `from abaqus import mdb, session
def _k(o):
    try: return list(o.keys())
    except Exception: return []
out={}
for mn in mdb.models.keys():
    m=mdb.models[mn]
    out[mn]={"parts":_k(m.parts),"materials":_k(m.materials),"sections":_k(m.sections),
             "steps":_k(m.steps),"loads":_k(m.loads),"bc":_k(m.boundaryConditions),
             "interactions":_k(m.interactions),"constraints":_k(m.constraints),
             "amplitudes":_k(m.amplitudes),"instances":_k(m.rootAssembly.instances),
             "sets":_k(m.rootAssembly.sets),"surfaces":_k(m.rootAssembly.surfaces)}
result=out`,
      ),
    opts: { isConcurrencySafe: () => true },
  });

  registerTool(ctx, config, {
    name: 'abaqus_list_jobs',
    description:
      'List all Abaqus jobs in the current session with status and properties (name, type, model, CPUs, domains, memory).',
    executeImpl: async (_args, _exec, br) =>
      runKernelCode(
        br,
        `from abaqus import mdb
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
result=jobs`,
      ),
    opts: { isConcurrencySafe: () => true },
  });

  registerTool(ctx, config, {
    name: 'abaqus_monitor_job',
    description:
      'Inspect job objects and, when a job name is given, tail its .sta progress and grep .msg diagnostics (ERROR/WARNING). With no job name, lists all jobs and the current working directory.',
    params: { jobName: { type: 'string', description: 'Job name; empty lists jobs' } },
    executeImpl: async (args, _exec, br) => {
      const job = JSON.stringify(String(args.jobName || ''));
      return runKernelCode(
        br,
        `import os, re
def _tl(p,c):
    try:
        with open(p) as f: lines=f.read().splitlines()
        return lines[-c:]
    except Exception: return []
job=${job}
if not job:
    from abaqus import mdb
    jobs=[]
    for n in mdb.jobs.keys():
        items=[]; jobj=mdb.jobs[n]
        for a in ("status","type","model","numCpus","memory"):
            try:
                v=getattr(jobj,a,None)
                if v is not None: items.append(a+"="+str(v))
            except Exception: pass
        jobs.append({"name":n,"attrs":" ".join(items)})
    result={"jobs":jobs,"workdir":os.getcwd()}
else:
    def _grep(p,pat,lim):
        try:
            out=[]
            rx=re.compile("|".join(pat))
            with open(p) as f:
                for line in f:
                    if rx.search(line): out.append(line.rstrip())
            return out[-lim:]
        except Exception: return []
    result={"job":job,"workdir":os.getcwd(),
            "progress_tail":_tl(job+".sta",8),
            "diagnostics":_grep(job+".msg",[r"^\\*\\*\\*ERROR",r"^\\*\\*\\*WARNING"],12)}
result`,
      );
    },
    opts: { isConcurrencySafe: () => true },
  });

  registerTool(ctx, config, {
    name: 'abaqus_inspect_odb',
    description:
      'Open an Abaqus ODB file read-only and return metadata: title, parts, instances, steps with frames, field outputs (with components), and history regions.',
    params: { odbPath: { type: 'string', required: true, description: 'Absolute path to the .odb file' } },
    executeImpl: async (args, _exec, br) => {
      const p = JSON.stringify(String(args.odbPath));
      return runKernelCode(
        br,
        `from odbAccess import openOdb
odb=None
try:
    odb=openOdb(path=${p}, readOnly=True)
    steps=[]
    def _sf(fr):
        c=len(fr)
        if c<=5: return [(i,fr[i]) for i in range(c)]
        idx=[0,int(round((c-1)*0.25)),int(round((c-1)*0.5)),int(round((c-1)*0.75)),c-1]
        seen=[]; out=[]
        for i in idx:
            if i not in seen: seen.append(i); out.append((i,fr[i]))
        return out
    for sname in odb.steps.keys():
        st=odb.steps[sname]
        frames=[]
        for i,f in _sf(st.frames):
            frames.append({"index":i,"frameId":f.frameId,"frameValue":f.frameValue,
                           "description":str(getattr(f,"description",""))})
        fo=[]
        if st.frames:
            try:
                for k in st.frames[-1].fieldOutputs.keys():
                    f=st.frames[-1].fieldOutputs[k]
                    fo.append({"name":k,"position":str(getattr(f,"position","")),
                               "components":list(getattr(f,"componentLabels",[]) or []),
                               "validInvariants":[str(x) for x in (getattr(f,"validInvariants",[]) or [])]})
            except Exception: pass
        steps.append({"name":sname,"procedure":str(getattr(st,"procedure","")),
                      "totalTime":getattr(st,"totalTime",0.0),"frame_count":len(st.frames),
                      "frames":frames,"fieldOutputs":fo,
                      "historyRegions":list(getattr(st,"historyRegions",{}).keys()) if hasattr(st,"historyRegions") else []})
    result={"title":str(getattr(odb,"title","")),"description":str(getattr(odb,"description","")),
            "parts":list(odb.parts.keys()) if hasattr(odb,"parts") else [],
            "instances":list(odb.rootAssembly.instances.keys()) if hasattr(odb,"rootAssembly") else [],
            "steps":steps}
finally:
    if odb is not None: odb.close()
result`,
      );
    },
    opts: { timeoutMs: 120000, isConcurrencySafe: () => true },
  });

  registerTool(ctx, config, {
    name: 'abaqus_capture_viewport',
    description:
      'Capture an Abaqus viewport as a base64 PNG image. Used to visually review the current model or results. The image is persisted as a DSH attachment when possible.',
    params: { viewportName: { type: 'string', description: 'Viewport name; empty = current viewport' } },
    executeImpl: async (args, _exec, br) => {
      const v = JSON.stringify(String(args.viewportName || ''));
      const res = await runKernelCode(
        br,
        `import os,tempfile,base64
from abaqus import session
import abaqusConstants as ABQ
vp=${v}
if not vp or vp not in session.viewports.keys():
    vp=session.currentViewportName
vpobj=session.viewports[vp]
h=tempfile.NamedTemporaryFile(suffix=".png",delete=False); p=h.name; h.close()
try:
    session.printToFile(fileName=p, format=ABQ.PNG, canvasObjects=(vpobj,))
    with open(p,"rb") as f: b64=base64.b64encode(f.read()).decode("ascii")
    result={"viewport":vp,"format":"png","image_base64":b64,"size_bytes":int(len(b64)*3/4)}
finally:
    try: os.unlink(p)
    except Exception: pass
result`,
      );
      if (res.value && res.value.image_base64 && ctx.attachments) {
        try {
          const { Buffer } = await import('node:buffer');
          const b64 = res.value.image_base64;
          if (config.captureSaveImage !== false) {
            await ctx.attachments.saveImage({ data: Buffer.from(b64, 'base64'), mimeType: 'image/png' });
          }
        } catch (_e) {
          /* best-effort */
        }
      }
      return JSON.stringify(res.value ?? {});
    },
    opts: { timeoutMs: 60000, isConcurrencySafe: () => true },
  });
}
