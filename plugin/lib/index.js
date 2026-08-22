import Schema from '@deepseek-ai/schemastery';
import { registerRead } from './tools/read.js';
import { registerMaterial } from './tools/material.js';
import { registerGeometry } from './tools/geometry.js';
import { registerSetup } from './tools/setup.js';
import { registerInteraction } from './tools/interaction.js';
import { registerMesh } from './tools/mesh.js';
import { registerJob } from './tools/job.js';
export const name = 'dsh-cae-agent';
/** Runtime dependencies this plugin requires before it can load. `attachments`
 * is needed by `capture_viewport` (image persistence); `tools` is the registry
 * every tool is registered on. Both are required, so both belong in inject. */
export const inject = ['tools', 'attachments'];
/** Schemastery schema for {@link Config}; defaults live in the schema. */
export const Config = Schema.object({
    host: Schema.string().default('127.0.0.1'),
    port: Schema.number().default(48152),
    timeoutMs: Schema.number().default(120_000),
});
/** Register every tool domain on the provided context + config. */
export function apply(ctx, config) {
    registerRead(ctx, config);
    registerMaterial(ctx, config);
    registerGeometry(ctx, config);
    registerSetup(ctx, config);
    registerInteraction(ctx, config);
    registerMesh(ctx, config);
    registerJob(ctx, config);
}
