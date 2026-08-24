import { Context } from "@deepseek-ai/cordis";
//#region client/src/index.d.ts
declare const name = "dsh-cae-agent-sidebar";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };