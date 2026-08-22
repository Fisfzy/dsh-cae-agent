import { defineTool } from '@deepseek-ai/dsh-tools';
import { Buffer } from 'node:buffer';
import { runKernelCode, bridgeRequest, safeStringify } from '../core.js';
/** Default per-tool timeout in ms for the bridge handshake. */
const PING_TIMEOUT_MS = 30_000;
export function registerRead(ctx, config) {
    const br = { host: config.host, port: config.port };
    const toolTimeout = config.timeoutMs;
    ctx.tools.register(defineTool({
        name: 'abaqus_ping',
        description: 'Check whether the Abaqus/CAE socket bridge is reachable and report live session telemetry (models, viewports, Abaqus version).',
        parameters: {},
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: safeStringify(value) }],
        },
        async execute(_args, exec) {
            return (await bridgeRequest(br, 'ping', {}, PING_TIMEOUT_MS, exec.signal));
        },
        timeoutMs: 30_000,
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_get_model_info',
        description: 'Read-only inventory of the current Abaqus session: models with parts, materials, sections, steps, loads, BCs, interactions, sets, surfaces, assembly instances, plus jobs and viewports.',
        parameters: {},
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                const summary = Object.keys(v)
                    .map((model) => {
                    const obj = (v[model] ?? {});
                    return `${model}: ${Object.keys(obj).length} facets`;
                })
                    .join('; ');
                return [{ type: 'text', text: summary ? `Abaqus model info:\n${summary}` : safeStringify(v) }];
            },
        },
        async execute(_args, exec) {
            const r = await runKernelCode(br, `from abaqus import mdb, session
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
result=out`, toolTimeout, exec.signal);
            return r.value;
        },
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_list_jobs',
        description: 'List all Abaqus jobs in the current session with status and properties (name, type, model, CPUs, domains, memory).',
        parameters: {},
        output: {
            schema: { type: 'array', items: { type: 'object', additionalProperties: true } },
            render: (_args, value) => {
                const rows = Array.isArray(value) ? value : [];
                const lines = rows.map((j) => `${String(j.name ?? '?')}: ${String(j.status ?? '')} (${String(j.type ?? '')})`);
                return [{ type: 'text', text: lines.length ? `Abaqus jobs:\n${lines.join('\n')}` : '(no jobs)' }];
            },
        },
        async execute(_args, exec) {
            const r = await runKernelCode(br, `from abaqus import mdb
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
result=jobs`, toolTimeout, exec.signal);
            return r.value;
        },
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_monitor_job',
        description: 'Inspect job objects and, when a job name is given, tail its .sta progress and grep .msg diagnostics (ERROR/WARNING). With no job name, lists all jobs and the current working directory.',
        parameters: {
            jobName: { type: 'string', description: 'Job name; empty lists jobs' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: safeStringify(value) }],
        },
        async execute(args, exec) {
            const job = JSON.stringify(String(args.jobName || ''));
            const r = await runKernelCode(br, `import os, re
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
result`, toolTimeout, exec.signal);
            return r.value;
        },
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_inspect_odb',
        description: 'Open an Abaqus ODB file read-only and return metadata: title, parts, instances, steps with frames, field outputs (with components), and history regions.',
        parameters: {
            odbPath: { type: 'string', required: true, description: 'Absolute path to the .odb file' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                const steps = Array.isArray(v.steps) ? v.steps : [];
                return [
                    {
                        type: 'text',
                        text: `ODB ${String(v.title ?? '')} — ${steps.length} step(s), parts=${String(v.parts ?? '')}, instances=${String(v.instances ?? '')}`,
                    },
                ];
            },
        },
        async execute(args, exec) {
            const p = JSON.stringify(String(args.odbPath));
            const r = await runKernelCode(br, `from odbAccess import openOdb
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
result`, 120_000, exec.signal);
            return r.value;
        },
        timeoutMs: 120_000,
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_capture_viewport',
        description: 'Capture an Abaqus viewport as a base64 PNG image. Used to visually review the current model or results. The image is persisted as a DSH attachment when possible.',
        parameters: {
            viewportName: { type: 'string', description: 'Viewport name; empty = current viewport' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    {
                        type: 'text',
                        text: `Captured viewport "${String(v.viewport ?? '')}" (${String(v.format ?? 'png')}, ${String(v.size_bytes ?? 0)} bytes).`,
                    },
                ];
            },
        },
        async execute(args, exec) {
            const v = JSON.stringify(String(args.viewportName || ''));
            const res = await runKernelCode(br, `import os,tempfile,base64
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
result`, 60_000, exec.signal);
            const raw = (res.value ?? {});
            const imageB64 = typeof raw.image_base64 === 'string' ? raw.image_base64 : '';
            if (imageB64) {
                try {
                    await ctx.attachments.saveImage({ data: Buffer.from(imageB64, 'base64'), mediaType: 'image/png' });
                }
                catch {
                    /* best-effort: attachment persistence must never break the tool result */
                }
            }
            return {
                viewport: raw.viewport ?? '',
                format: raw.format ?? 'png',
                size_bytes: raw.size_bytes ?? 0,
            };
        },
        timeoutMs: 60_000,
        isConcurrencySafe: () => true,
    }));
}
