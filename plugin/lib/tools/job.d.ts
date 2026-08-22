/**
 * tools/job.ts — job submission/control (Tier 2) plus the arbitrary-code
 * fallback (Tier 3) and the workdir utility (Tier 2).
 *
 * run_python is intentionally the Tier-3 escape hatch: it executes any Abaqus
 * Python. Guard it with an `ask`/approval policy in DSH when a strict policy is
 * desired (the deployment strategy belongs in tools/pre-execute, not here).
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerJob(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
