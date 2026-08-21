/**
 * dsh-cae-agent — DSH (DeepSeek Harness) Cordis plugin for Abaqus/CAE.
 *
 * This module implements the real DSH/Cordis plugin contract:
 *   export const name
 *   export const Config
 *   export const inject = ['tools', 'attachments']
 *   export function apply(ctx, config)
 *
 * It operates a live Abaqus/CAE session through the local socket bridge
 * (the "Abaqus MCP" bridge, v5 protocol) that runs *inside* Abaqus/CAE and
 * executes Abaqus Python on the GUI main thread via `sendCommand`. This plugin
 * speaks the bridge's JSON-over-TCP protocol directly — no MCP hop — and
 * registers each Abaqus operation as a first-class DSH native tool via
 * `ctx.tools.register(defineTool({...}))`.
 *
 * Bridge protocol (matching ~/.abaqus-mcp v5 / CAE-Agent-Hub MCP/Abaqus):
 *   request -> { "id": "<uuid>", "method": "execute|ping|...", "params": {...} }
 *   response -> { "id": <same>, "ok": true, "result": {...} }
 *            | { "id": <same>, "ok": false, "error": { message, type, traceback } }
 *
 * License: MIT. Based on CAE-Agent-Hub (Copyright 2026 Thompson Labs) and the
 * socket-bridge architecture of Abaqus-Control-MCP (MIT, 2026 Abaqus Control
 * MCP Contributors). See NOTICE and LICENSE.
 */
import net from 'node:net';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import z from 'schemastery';

export const name = 'dsh-cae-agent';

/** Plugin config (schemastery). */
export const Config = z.object({
  /** Abaqus bridge host. */
  host: z.string().default('127.0.0.1'),
  /** Abaqus bridge port. */
  port: z.number().default(48152),
  /** Default per-call timeout in ms. */
  timeoutMs: z.number().default(120000),
});

export const inject = ['tools', 'attachments'];

/** Lossless-safe JSON serializer for tool render output (never returns undefined). */
function safeStringify(value) {
  const seen = new Set();
  const replacer = (_key, v) => {
    if (v === null || (typeof v !== 'object' && typeof v !== 'bigint')) {
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
      return v;
    }
    if (typeof v === 'bigint') return `${v}n`;
    if (typeof v === 'function') return '[function]';
    if (seen.has(v)) return '[circular]';
    seen.add(v);
    return v;
  };
  try {
    const s = JSON.stringify(value, replacer);
    return s !== undefined ? s : String(value);
  } catch {
    try {
      return JSON.stringify(value, replacer, 2) ?? String(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}

/**
 * Speak one JSON-over-TCP request to the Abaqus socket bridge and await one
 * response. Each call opens a fresh TCP connection (matching the upstream
 * v5 client behavior), so concurrent calls are independent.
 */
function bridgeRequest(host, port, method, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const payload = JSON.stringify({
      id,
      method,
      params: { ...(params || {}), timeout: (timeoutMs ?? 60000) / 1000 },
    });

    const socket = new net.Socket();
    let settled = false;
    const chunks = [];

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error(`dsh-cae-agent: Abaqus bridge timed out after ${timeoutMs ?? 60000}ms (${method})`));
    }, (timeoutMs ?? 60000) + 5000);

    socket.on('error', (err) => {
      clearTimeout(timeout);
      finish(
        reject,
        new Error(
          `Cannot reach Abaqus socket bridge at ${host}:${port}. ` +
            `Start Abaqus/CAE and run Plug-ins > Abaqus MCP > Start Socket Bridge. (${err.message})`,
        ),
      );
    });

    socket.connect(port, host, () => {
      socket.write(payload + '\n');
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      const nl = buf.indexOf(0x0a); // '\n'
      if (nl < 0) return;
      const line = buf.subarray(0, nl).toString('utf8');
      chunks.length = 0;
      let message;
      try {
        message = JSON.parse(line);
      } catch (err) {
        clearTimeout(timeout);
        finish(reject, new Error(`dsh-cae-agent: malformed bridge response: ${err.message}`));
        return;
      }
      clearTimeout(timeout);
      if (message.id !== id) {
        finish(reject, new Error('dsh-cae-agent: bridge returned mismatched id'));
        return;
      }
      if (!message.ok) {
        const e = message.error || {};
        finish(
          reject,
          new Error((e.message || safeStringify(e)) + (e.traceback ? `\n${e.traceback}` : '')),
        );
        return;
      }
      finish(resolve, message.result);
    });
  });
}

/**
 * Execute Abaqus Python in the live kernel. `result` variable (for multi-line
 * scripts) or expression value (single line) is returned; errors carry the
 * upstream AST-level diagnostics as a readable string.
 */
async function runKernelCode(br, code, timeoutMs) {
  if (!code || !String(code).trim()) throw new Error('code must not be empty');
  const result = await bridgeRequest(br.host, br.port, 'execute', { code: String(code) }, timeoutMs);
  if (!result.ok) {
    const parts = [result.error_type + ': ' + result.core_error];
    if (result.recovery) {
      const r = result.recovery;
      if (r.parent_object_path) parts.push('  Object: ' + r.parent_object_path);
      if (r.possible_keys) parts.push('  Similar keys: ' + safeStringify(r.possible_keys));
      if (r.callable_signature) parts.push('  Signature: ' + r.callable_signature);
    }
    if (result.code_excerpt) parts.push('  Code:\n' + String(result.code_excerpt));
    if (result.traceback_tail) parts.push('  Traceback:\n' + String(result.traceback_tail));
    throw new Error(parts.join('\n'));
  }
  return { value: result.return_value, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** Text renderer for generic JSON tool results. */
function textRender(_args, value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : safeStringify(value) }];
}

/** Bootstraps the three authorization tiers of native Abaqus tools. */
function registerTools(ctx, config) {
  const br = { host: config.host, port: config.port };

  // The DSH host expects `parameters` as a standard JSON Schema object
  // ({ type: 'object', properties, required }), matching the dsh-lean-prover
  // reference plugin. We accept a lightweight spec ({ name: {type, required,
  // description} } or undefined) and compile it to that shape.
  function toParamsSchema(spec) {
    const out = { type: 'object', properties: {}, required: [] };
    if (!spec) return out;
    for (const [k, v] of Object.entries(spec)) {
      out.properties[k] = { type: v.type ?? 'string', description: v.description ?? '' };
      if (v.required) out.required.push(k);
    }
    return out;
  }

  // Register one tool. `executeImpl` receives (args, exec, bridge); output is a
  // string, rendered as a text block. Returns the disposer.
  const t = (name, description, paramsSpec, executeImpl, opts = {}) => {
    const tools = ctx.tools;
    const isConcurrencySafe = opts.isConcurrencySafe;
    return tools.register({
      name,
      description,
      parameters: toParamsSchema(paramsSpec),
      output: {
        schema: { type: 'string' },
        render: textRender,
      },
      timeoutMs: opts.timeoutMs ?? config.timeoutMs,
      ...(isConcurrencySafe ? { isConcurrencySafe } : {}),
      async execute(args, exec) {
        return await executeImpl(args ?? {}, exec, br);
      },
    });
  };

  // ---------------- Tier 1: read-only (safe, no write to model) ----------------
  t(
    'abaqus_ping',
    'Check whether the Abaqus/CAE socket bridge is reachable and report live session telemetry (models, viewports, Abaqus version).',
    {
      timeoutMs: { type: 'number', description: 'Optional per-call timeout in ms' },
    },
    async (args, _exec, b) => await bridgeRequest(b.host, b.port, 'ping', {}, args.timeoutMs ?? 10000),
    { timeoutMs: 30000, isConcurrencySafe: () => true },
  );

  t(
    'abaqus_get_model_info',
    'Get a read-only inventory of the current Abaqus session: models with parts, materials, sections, steps, loads, BCs, interactions, sets, surfaces, plus jobs and viewports.',
    {},
    async (_args, _exec, b) =>
      await runKernelCode(
        b,
        `from abaqus import mdb, session
import json
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
             "sets":_k(m.rootAssembly.sets)}
result=out`,
      ),
    { isConcurrencySafe: () => true },
  );

  t(
    'abaqus_list_jobs',
    'List all Abaqus jobs in the current session with their status and properties (name, type, model, CPUs, domains, memory).',
    {},
    async (_args, _exec, b) =>
      await runKernelCode(
        b,
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
    { isConcurrencySafe: () => true },
  );

  t(
    'abaqus_monitor_job',
    'Inspect job objects and, when a job name is given, tail its .sta progress and grep .msg diagnostics (ERROR/WARNING). With no job name, lists all jobs and the current working directory.',
    { jobName: { type: 'string', description: 'Job name; empty lists jobs' } },
    async (args, _exec, b) => {
      const job = JSON.stringify(String(args.jobName || ''));
      return await runKernelCode(
        b,
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
    { isConcurrencySafe: () => true },
  );

  t(
    'abaqus_inspect_odb',
    'Open an Abaqus ODB file read-only and return metadata: title, parts, instances, steps with frames, field outputs (with components), and history regions.',
    { odbPath: { type: 'string', required: true, description: 'Absolute path to the .odb file' } },
    async (args, _exec, b) => {
      const p = JSON.stringify(String(args.odbPath));
      return await runKernelCode(
        b,
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
    { timeoutMs: 120000 },
  );

  t(
    'abaqus_capture_viewport',
    'Capture an Abaqus viewport as a PNG image (base64 in the returned result). Used to visually review the current model or results.',
    { viewportName: { type: 'string', description: 'Viewport name; empty = current viewport' } },
    async (args, _exec, b) => {
      const v = JSON.stringify(String(args.viewportName || ''));
      const res = await runKernelCode(
        b,
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
      // Persist the image as an attachment so the model can see it as an image.
      if (res.value && res.value.image_base64) {
        try {
          await ctx.attachments.saveImage({
            data: Buffer.from(res.value.image_base64, 'base64'),
            mimeType: 'image/png',
          });
        } catch (_e) {
          /* attachment persistence is best-effort */
        }
      }
      return JSON.stringify(res.value ?? {});
    },
    { timeoutMs: 60000 },
  );

  // ---------------- Tier 2: controlled write operations (schema-guarded) ----------------
  t(
    'abaqus_set_workdir',
    'Change the current Abaqus working directory before creating or submitting jobs.',
    { path: { type: 'string', required: true, description: 'Absolute existing directory path' } },
    async (args, _exec, b) => {
      const p = JSON.stringify(String(args.path));
      return await runKernelCode(
        b,
        `import os
p=${p}
if not os.path.isdir(p): raise OSError("Directory does not exist: "+p)
os.chdir(p)
result={"success":True,"current":os.getcwd()}
result`,
      );
    },
  );

  t(
    'abaqus_submit_job',
    'Submit an existing Abaqus job by name and wait for completion. The job must already be defined in the session. Returns the final job status.',
    { jobName: { type: 'string', required: true, description: 'Job name defined in the current session' } },
    async (args, _exec, b) => {
      const jn = JSON.stringify(String(args.jobName));
      return await runKernelCode(
        b,
        `from abaqus import mdb
jn=${jn}
if jn not in mdb.jobs: raise KeyError("Job not found: "+jn)
j=mdb.jobs[jn]
j.submit(consistencyChecking=False)
j.waitForCompletion()
result={"success":True,"job":jn,"status":str(getattr(j,"status","UNKNOWN"))}
result`,
      );
    },
    { timeoutMs: 3600000, isConcurrencySafe: () => false },
  );

  // ---------------- Tier 3: arbitrary code fallback (maximum authority) ----------------
  t(
    'abaqus_run_python',
    'Execute arbitrary Python code in the live Abaqus/CAE kernel (mdb, session, odbAccess available). Single-line expressions are evaluated and returned; for multi-line scripts, assign a `result` variable to return structured data. Use this as the fallback when the dedicated Abaqus tools do not cover a needed operation. PREFER the dedicated tools (set material/load/mesh/step) when they exist.',
    { code: { type: 'string', required: true, description: 'Abaqus Python code to run' } },
    async (args, _exec, b) => {
      const r = await runKernelCode(b, String(args.code), args.timeoutMs ?? config.timeoutMs);
      if (r.stdout) return 'stdout:\n' + r.stdout + (r.value !== undefined ? '\n\nvalue:\n' + JSON.stringify(r.value) : '');
      return r.value !== undefined ? JSON.stringify(r.value) : '(executed, no return value)';
    },
    { timeoutMs: 120000 },
  );
}

/** Cordis apply: build the bridge client and register the Abaqus native tools. */
export function apply(ctx, config) {
  registerTools(ctx, config);
}
