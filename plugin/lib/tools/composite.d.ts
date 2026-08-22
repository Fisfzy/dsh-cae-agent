/**
 * tools/composite.ts — Tier 2 controlled modeling: composite shell/solid layup.
 *
 * Defines a composite (layered) section with per-ply angle and thickness and
 * assigns it to a part region. Composite plies in Abaqus are SectionLayer
 * objects (abaqus.SectionLayer), collected into a CompositeShellSection /
 * CompositeSolidSection `layup` tuple. Bare tuples like (thickness, material,
 * angle) are NOT accepted by that API — the layup must be a tuple of
 * SectionLayer objects. This tool builds exactly that.
 *
 * Uses the socket-bridge `runKernelCode` helper from ../core.js.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerComposite(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
