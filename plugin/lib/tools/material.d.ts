/**
 * tools/material.ts — Tier 2 controlled modeling: material definition and
 * section assignment. Parameter design follows FEA best practice (units
 * mm-t-s-N-MPa, elastic/plastic/thermal properties, section-type selection).
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerMaterial(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
