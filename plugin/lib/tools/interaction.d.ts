/**
 * tools/interaction.ts — Tier 2 controlled modeling: contact / tie
 * interactions between surfaces. Param design follows contact methodology
 * (surface-to-surface vs tie, friction, master/slave; coarser-mesh-as-master).
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerInteraction(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
