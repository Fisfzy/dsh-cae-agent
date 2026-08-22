/**
 * tools/mesh.ts — Tier 2 controlled modeling: mesh seed + generate + element
 * type (C3D8R/C3D4R for solid by default; S4R for shell). Adaptive defaults:
 * approximate global seed size = (part bounding box diagonal)/10.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerMesh(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
