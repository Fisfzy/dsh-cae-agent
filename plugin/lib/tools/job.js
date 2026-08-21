/**
 * tools/job.js — job submission/control (Tier 2) plus the arbitrary-code
 * fallback (Tier 3) and the workdir utility (Tier 2).
 *
 * run_python is intentionally the Tier-3 escape hatch: it executes any Abaqus
 * Python. Guard it with an `ask`/approval in DSH when a strict policy is
 * desired.
 */
import { registerTool, runKernelCode } from '../core.js';

export function register(ctx, config) {
  registerTool(ctx, config, {
    name: 'abaqus_set_workdir',
    description: 'Change the current Abaqus working directory before creating or submitting jobs.',
    params: { path: { type: 'string', required: true, description: 'Absolute existing directory path' } },
    executeImpl: async (args, _exec, br) => {
      const p = JSON.stringify(String(args.path));
      return runKernelCode(
        br,
        `import os
p=${p}
if not os.path.isdir(p): raise OSError("Directory does not exist: "+p)
os.chdir(p)
result={"success":True,"current":os.getcwd()}
result`,
      );
    },
  });

  registerTool(ctx, config, {
    name: 'abaqus_submit_job',
    description:
      'Submit an existing Abaqus job by name and wait for completion. The job must already be defined in the session (e.g. mdb.Job). Returns the final job status.',
    params: { jobName: { type: 'string', required: true, description: 'Job name defined in the current session' } },
    executeImpl: async (args, _exec, br) => {
      const jn = JSON.stringify(String(args.jobName));
      return runKernelCode(
        br,
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
    opts: { timeoutMs: 3600000 },
  });

  registerTool(ctx, config, {
    name: 'abaqus_run_python',
    description:
      'Execute arbitrary Python code in the live Abaqus/CAE kernel (mdb, session, odbAccess available). Single-line expressions are evaluated and returned; for multi-line scripts, assign a `result` variable to return structured data. PREFER the dedicated abaqus_* tools when they cover the operation; use this only as a fallback for operations without a dedicated tool.',
    params: { code: { type: 'string', required: true, description: 'Abaqus Python code to run' } },
    executeImpl: async (args, _exec, br) => {
      const r = await runKernelCode(br, String(args.code), args.timeoutMs ?? config.timeoutMs);
      if (r.stdout) return 'stdout:\n' + r.stdout + (r.value !== undefined ? '\n\nvalue:\n' + JSON.stringify(r.value) : '');
      return r.value !== undefined ? JSON.stringify(r.value) : '(executed, no return value)';
    },
    opts: { timeoutMs: 120000 },
  });
}
