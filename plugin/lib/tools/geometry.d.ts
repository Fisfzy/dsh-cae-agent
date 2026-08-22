/**
 * tools/geometry.ts — Tier 2 controlled modeling: part creation, set/geometry
 * selection, and assembly instantiation. Set selection supports cells/faces/
 * edges/vertices by index or by 2D/3D point coordinates (findAt). Param-
 * eterization follows the FEA workflow (create part -> primitive -> define
 * sets -> instantiate into assembly).
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerGeometry(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
