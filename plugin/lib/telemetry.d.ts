/**
 * telemetry.ts — the cae-agent HTTP route that surfaces LIVE Abaqus/CAE state
 * to the sidebar frontend by proxying the socket bridge's `ping` method.
 *
 * Why a separate route (not a BSB `/sidebar/api/*` method):
 *   dsh-better-sidebar's `buildApi` is a CLOSED dispatch table (a hard-coded
 *   object); it exposes no hook for an external plugin to add a method. So a
 *   plugin that owns a bridge (like this one) registers its own prefix route
 *   on the same host webserver and serves its own wire protocol.
 *
 * What it reports (authoritative, straight from the CAE kernel, not guessed):
 *   - connected : bridge reachable?
 *   - cwd       : os.getcwd() inside the CAE kernel == the REAL Abaqus workdir
 *   - models / viewports / abaqus_version / bridge meta (from the kernel ping)
 *
 * The wire envelope mirrors BSB's `{ok, value}` / `{ok:false, error:{code,message}}`
 * so the client's existing `call()` helper can decode it unchanged.
 *
 * Security: same browser-trust fence as BSB's routes (Host-header loopback or
 * a trusted authority + same-origin browser markers). This is a
 * DNS-rebinding / cross-site defense, not authentication. Read-only: never
 * mutates the model or submits work.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Minimal structural request face (subset of node IncomingMessage). */
interface CafeHttpRequest {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}
/** Whether a normalized URL hostname names the local loopback authority. */
export declare function isLoopbackHostname(hostname: string): boolean;
/** Whether one request may reach the plugin routes (loopback/trusted + same-origin). */
export declare function isTrustedApiRequest(request: CafeHttpRequest, trustedHosts: readonly string[]): boolean;
/** Register the `/cae/api/*` JSON prefix route on the host webserver.
 *  webServer + webRuntime are declared in the plugin's `inject`, so they are
 *  available as context properties here (ctx.webServer), exactly like
 *  dsh-better-sidebar — a nested ctx.inject(['webServer'], ...) did NOT fire,
 *  so this route registers directly instead. */
export declare function registerTelemetry(ctx: Context, config: {
    host: string;
    port: number;
    timeoutMs: number;
}): void;
export {};
