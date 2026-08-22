/**
 * tools/read.ts — Tier 1 (read-only) Abaqus tools. Safe to auto-authorize:
 * these never mutate the model or submit work. All are concurrency-safe
 * (`isConcurrencySafe: () => true`). Every tool returns a canonical JSON value
 * and exposes human text via `output.render`.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare function registerRead(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
