/** Bridge connection target resolved from plugin config. */
export interface BridgeHandle {
    host: string;
    port: number;
}
/** Per-call bridge timeout in ms; default when none is given. */
export declare const DEFAULT_TIMEOUT_MS = 60000;
/** Lossless-safe JSON serializer (never returns the JS `undefined` value). */
export declare function safeStringify(value: unknown): string;
/**
 * Open one JSON-over-TCP request to the Abaqus socket bridge and await one
 * response. Each call opens a fresh TCP connection; concurrent calls are
 * independent. Rejects with a descriptive error when the bridge is unreachable,
 * times out, or returns an `ok: false` result.
 */
export declare function bridgeRequest<T = unknown>(handle: BridgeHandle, method: string, params: Record<string, unknown>, timeoutMs?: number, signal?: AbortSignal): Promise<T>;
/** Parsed result of running Abaqus Python in the live kernel. */
export interface KernelResult {
    value: unknown;
    stdout: string;
    stderr: string;
}
/**
 * Execute Abaqus Python in the live kernel. A `result` variable (multi-line) or
 * expression value (single-line) is returned as a lossless JSON value; errors
 * carry AST-level diagnostics. On bridge failure the generated source is
 * attached to the thrown error as `abqCode` so static (offline) Python-syntax
 * tests can run without a live bridge.
 */
export declare function runKernelCode(handle: BridgeHandle, code: string, timeoutMs?: number, signal?: AbortSignal): Promise<KernelResult>;
/** Render a canonical JSON value as a single human-readable text content block. */
export declare function textRender(args: unknown, value: unknown): Array<{
    type: 'text';
    text: string;
}>;
