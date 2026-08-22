import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode, safeStringify } from '../core.js';
export function registerJob(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_set_workdir',
        description: 'Change the current Abaqus working directory before creating or submitting jobs.',
        parameters: {
            path: { type: 'string', required: true, description: 'Absolute existing directory path' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Working directory set to ${String(v.current ?? '')}` }];
            },
        },
        async execute(args, exec) {
            const p = JSON.stringify(String(args.path));
            const r = await runKernelCode(br, `import os
p=${p}
if not os.path.isdir(p): raise OSError("Directory does not exist: "+p)
os.chdir(p)
result={"success":True,"current":os.getcwd()}
result`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_submit_job',
        description: 'Submit an existing Abaqus job by name (non-blocking). The job must already be defined in the session (e.g. mdb.Job). Returns immediately with the submitted state; poll progress with abaqus_monitor_job or inspect Job-*.sta / Job-*.lck until completion. This avoids blocking the Abaqus bridge on the GUI thread.',
        parameters: {
            jobName: { type: 'string', required: true, description: 'Job name defined in the current session' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Job "${String(v.job ?? '')}" submitted (mode=${String(v.mode ?? '')}, status=${String(v.status ?? '')}). Use abaqus_monitor_job to track progress.` },
                ];
            },
        },
        async execute(args, exec) {
            const jn = JSON.stringify(String(args.jobName));
            const r = await runKernelCode(br, `from abaqus import mdb
jn=${jn}
if jn not in mdb.jobs: raise KeyError("Job not found: "+jn)
j=mdb.jobs[jn]
j.submit(consistencyChecking=False)
result={"success":True,"mode":"submitted","job":jn,"status":str(getattr(j,"status","SUBMITTED"))}
result`, 30_000, exec.signal);
            return r.value;
        },
        timeoutMs: 30_000,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_run_python',
        description: 'Execute arbitrary Python code in the live Abaqus/CAE kernel (mdb, session, odbAccess available). Single-line expressions are evaluated and returned; for multi-line scripts, assign a `result` variable to return structured data. PREFER the dedicated abaqus_* tools when they cover the operation; use this only as a fallback for operations without a dedicated tool.',
        parameters: {
            code: { type: 'string', required: true, description: 'Abaqus Python code to run' },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : safeStringify(value) }],
        },
        async execute(args, exec) {
            const r = await runKernelCode(br, String(args.code), config.timeoutMs, exec.signal);
            if (r.stdout && r.value !== undefined) {
                return { stdout: r.stdout, value: r.value };
            }
            if (r.value !== undefined)
                return r.value;
            return { ok: true, message: 'executed, no return value' };
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
