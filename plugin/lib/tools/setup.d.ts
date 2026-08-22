/**
 * tools/setup.ts — Tier 2 controlled modeling: analysis step, loads, and
 * boundary conditions. Parameter design follows the FEA workflow (static/
 * dynamic step, load types, BC types incl. symmetry).
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerSetup(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
