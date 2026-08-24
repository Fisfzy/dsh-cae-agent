import { Context } from "@deepseek-ai/cordis";
//#region client/src/index.d.ts
declare const name = "dsh-cae-agent-sidebar";
/**
 * OPTIONAL-dependency pattern: `betterSidebar` is never put in `inject`, so the
 * plugin loads and does nothing when dsh-better-sidebar is absent (graceful
 * degradation). When the service IS present we register a single "Abaqus 工作流"
 * tab that renders {@link WorkflowView}. `registerTab` returns a disposer which
 * `ctx.effect` ties to the fiber lifecycle (unload/HMR-safe).
 */
declare function apply(ctx: Context): void;
//#endregion
export { apply, name };