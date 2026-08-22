# HANDOFF — dsh-cae-agent TypeScript 重构完成

日期：2026-08-22

## 状态：JS → TS 重构已完成，构建通过，测试全绿

`plugin/` 已按 `dsh-plugin-dev` 技能规范从纯 JS 重写为 TypeScript，产物仍输出到 `plugin/lib/`，`~/.dsh/cordis.patch.yml` 中 `dsh-cae-agent` 的 `file://` 指向无需改动。

## 交付清单

**源码（TypeScript，`plugin/src/`）**
- `src/index.ts` —— `name` / `inject=['tools','attachments']` / `Config:Schemastery` / `apply`，聚合 7 个域
- `src/core.ts` —— bridge 客户端 + `runKernelCode`（支持 `exec.signal` 取消）
- `src/tools/{read,material,geometry,setup,interaction,mesh,job}.ts` —— 20 个工具

**构建/测试（`plugin/`）**
- `tsconfig.json`（NodeNext → `lib/`）、`package.json`（`build`/`test`/`typecheck`/`link-deps`）、`scripts/link-deps.ps1`
- `test/`：`smoke.test.mjs` + `codegen.test.mjs` + `load.test.mjs`（真实 Cordis 运行时加载）

**文档**：`docs/MIGRATION.md` 新增重构说明；`plugin/README.md` 更新结构/开发/测试。

## 规范符合点（对照硬规则）
- defineTool + `parameters` DSL + `output.schema`/`output.render` 分离（execute 返回规范 JSON 值，render 负责人类可读）
- `Config` 用 Schemastery（interface + Schema，默认值进 schema）
- Tier-1 只读工具 `isConcurrencySafe: () => true`；Tier-2/3 写工具未声明 → 独占
- 每个 `execute(args, exec)` 把 `exec.signal` 传入 bridge（可取消）
- `capture_viewport` 用 `ctx.attachments.saveImage({data, mediaType})`（dsh-attachment 服务）

## 验证结果
- `node_modules/typescript/bin/tsc -p tsconfig.json` → 0 错误
- `npm test` → 全绿：20 工具注册 / 每个工具生成 Python ast 语法通过 / 真实 Cordis 加载 + 卸载干净

## 唯一剩余手动步骤：让运行中的 DSH 加载新构建
当前 web 进程（`--profile web --port 3081`）是在重构前启动的，仍保留旧/失败状态。**重启 DSH 后**：
1. 该 `file:///D:/AIWORK/dsh-cae-agent/plugin/lib/index.js` 将被重新加载。
2. 验证：`window.__DSH_BOOT__.entries` 应包含 `dsh-cae-agent`；或用 DSH 模型工具列表搜索 `abaqus_` 原生工具。
3. 若 Abaqus 未启动 bridge，`abaqus_ping` 会报 "Cannot reach ... Start Socket Bridge"，属预期。

> 未自行重启 web：会杀掉当前 agent 宿主进程。请在您方便时重启（或信任 dsh-web-guard 的自愈拉起 + 硬刷新页面）。

## 依赖备注
`@deepseek-ai/{cordis,dsh-tools,schemastery,dsh-attachment}` 为 restricted 私有包，外网不可 `npm i`。新机器/新安装先跑 `powershell -File scripts/link-deps.ps1`（从已装 DSH 发行包 junction），再 `npm run build`。
