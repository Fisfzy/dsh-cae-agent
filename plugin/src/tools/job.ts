/**
 * tools/job.ts — job submission/control (Tier 2) plus the arbitrary-code
 * fallback (Tier 3) and the workdir utility (Tier 2).
 *
 * run_python is intentionally the Tier-3 escape hatch: it executes any Abaqus
 * Python. Guard it with an `ask`/approval policy in DSH when a strict policy is
 * desired (the deployment strategy belongs in tools/pre-execute, not here).
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import type { BridgeHandle } from '../core.js'
import { runKernelCode, safeStringify } from '../core.js'

type JsonRecord = Record<string, JsonValue>

export function registerJob(ctx: Context, config: { host: string; port: number; timeoutMs: number }): void {
  const br: BridgeHandle = { host: config.host, port: config.port }

  ctx.tools.register(
    defineTool({
      name: 'abaqus_set_workdir',
      description: 'Change the current Abaqus working directory before creating or submitting jobs.',
      parameters: {
        path: { type: 'string', required: true, description: 'Absolute existing directory path' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const v = (value ?? {}) as JsonRecord
          return [{ type: 'text', text: `Working directory set to ${String(v.current ?? '')}` }]
        },
      },
      async execute(args, exec) {
        const p = JSON.stringify(String(args.path))
        const r = await runKernelCode(
          br,
          `import os
p=${p}
if not os.path.isdir(p): raise OSError("Directory does not exist: "+p)
os.chdir(p)
result={"success":True,"current":os.getcwd()}
result`,
          config.timeoutMs,
          exec.signal,
        )
        return r.value as JsonRecord
      },
      timeoutMs: config.timeoutMs,
      isConcurrencySafe: () => false,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'abaqus_submit_job',
      description:
        'Submit an existing Abaqus job by name and wait for completion. The job must already be defined in the session (e.g. mdb.Job). Returns the final job status.',
      parameters: {
        jobName: { type: 'string', required: true, description: 'Job name defined in the current session' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const v = (value ?? {}) as JsonRecord
          return [{ type: 'text', text: `Job "${String(v.job ?? '')}" finished: ${String(v.status ?? 'UNKNOWN')}` }]
        },
      },
      async execute(args, exec) {
        const jn = JSON.stringify(String(args.jobName))
        const r = await runKernelCode(
          br,
          `from abaqus import mdb
jn=${jn}
if jn not in mdb.jobs: raise KeyError("Job not found: "+jn)
j=mdb.jobs[jn]
j.submit(consistencyChecking=False)
j.waitForCompletion()
result={"success":True,"job":jn,"status":str(getattr(j,"status","UNKNOWN"))}
result`,
          3_600_000,
          exec.signal,
        )
        return r.value as JsonRecord
      },
      timeoutMs: 3_600_000,
      isConcurrencySafe: () => false,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'abaqus_run_python',
      description:
        'Execute arbitrary Python code in the live Abaqus/CAE kernel (mdb, session, odbAccess available). Single-line expressions are evaluated and returned; for multi-line scripts, assign a `result` variable to return structured data. PREFER the dedicated abaqus_* tools when they cover the operation; use this only as a fallback for operations without a dedicated tool.',
      parameters: {
        code: { type: 'string', required: true, description: 'Abaqus Python code to run' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : safeStringify(value) }],
      },
      async execute(args, exec) {
        const r = await runKernelCode(br, String(args.code), config.timeoutMs, exec.signal)
        if (r.stdout && r.value !== undefined) {
          return { stdout: r.stdout, value: r.value } as JsonRecord
        }
        if (r.value !== undefined) return r.value as JsonValue
        return { ok: true, message: 'executed, no return value' } as JsonRecord
      },
      timeoutMs: config.timeoutMs,
      isConcurrencySafe: () => false,
    }),
  )
}
