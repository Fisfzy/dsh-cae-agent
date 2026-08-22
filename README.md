# dsh-cae-agent

一个 **DSH（DeepSeek Harness）的 Cordis 插件**，通过 **原生工具**直接操作本机正在运行的 **Abaqus/CAE** 会话，覆盖完整建模链（几何、材料、网格、接触、分析步、载荷、边界、作业、ODB）。它是将 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) 的 Abaqus 集成迁移为 DSH 原生插件，取代了原先的 MCP 桥接方案。**源代码为 TypeScript，按 `dsh-plugin-dev` 规范开发。**

**版本：** `0.2.0`（`plugin/` 内另有 `v0.2.0` tag）

**语言：** 中文 | [English](README.en.md)

## 它做什么

Abaqus/CAE 内运行一个 socket bridge（`abaqus_mcp_plugin.py`，v5 协议，默认 `127.0.0.1:48152`），在 GUI 主线程派发 Abaqus Python。本插件用 Node TCP **直连**这个 bridge（**不走 MCP**），并把每个 Abaqus 操作注册为 DSH **原生工具**。

```
DSH(agent) ──原生工具──> dsh-cae-agent（本插件, TCP）──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## 工具：21 个原生工具，三档授权 + 一个运维工具

| 类别 | 工具 | 策略 |
|---|---|---|
| **1 — 只读**（并发安全） | `abaqus_ping`、`abaqus_get_model_info`、`abaqus_list_jobs`、`abaqus_monitor_job`、`abaqus_inspect_odb`、`abaqus_capture_viewport` | 可直接放行 |
| **2 — 受控写**（独占 + schema 守卫） | `abaqus_create_part`、`abaqus_create_set`、`abaqus_instantiate`、`abaqus_create_material`、`abaqus_assign_section`、`abaqus_define_step`、`abaqus_apply_load`、`abaqus_set_bc`、`abaqus_generate_mesh`、`abaqus_create_interaction`、`abaqus_set_friction`、`abaqus_submit_job`、`abaqus_set_workdir` | 写操作需门禁/确认 |
| **3 — 任意代码**（最高权限） | `abaqus_run_python` | 使用前需确认 |
| **运维** | `abaqus_launch_cae` | 拉启本机 Abaqus/CAE 并自动开 bridge |

每个建模工具都在内部生成正确的 Abaqus Python——agent 只需提供业务参数（材料 E/ν、几何、摩擦等），不用写裸 Abaqus API。参数设计借鉴上游有限元方法论，但全部生成代码、描述、schema 均为自写。

### 关于 `abaqus_launch_cae`
- **幂等**：48152 已在监听 → 直接复用现有会话；否则拉启 `abaqus cae` 并自动加载 bridge（免手动点菜单）。
- 需要在**交互式桌面会话**里运行（Abaqus GUI 内核启动依赖图形上下文），会弹出 Abaqus/CAE 窗口。

### 关于 `abaqus_submit_job`（异步）
`submit()` 后**立即返回**（`mode=submitted`），不阻塞桥 → 求解期间其它工具照常可用；用 `abaqus_monitor_job` 轮询 `.sta/.lck` 跟踪进度。

## 仓库结构

```
├── plugin/                 # DSH Cordis 插件包（源码 TS —— 纯 TypeScript）
│   ├── src/                # ★ 源码（要改这里）
│   │   ├── index.ts        #   Cordis 入口: name/Config(Schemastery)/inject/apply
│   │   ├── core.ts         #   socket-bridge 客户端 + runKernelCode（支持 exec.signal）
│   │   └── tools/          #   read/geometry/material/setup/interaction/mesh/job/launch
│   ├── lib/                # 构建产物（tsc 从 src 编译输出 + .d.ts，勿手改）
│   ├── tsconfig.json       # NodeNext -> lib/
│   ├── scripts/            # link-deps.ps1（junction 运行时依赖）
│   ├── test/               # smoke/codegen/load（离线）+ e2e（真实桥回归）
│   └── package.json        # build/test/e2e 脚本
├── docs/
│   └── MIGRATION.md        # 迁移说明 + 真机测试记录
├── LICENSE
└── README.md / README.en.md
```

> **开发规范**：源码在 `src/*.ts`，`lib/*.js` 是 `npm run build`（`tsc`）编译产物，DSH 加载的是 `lib/index.js`。改名/改代码后需重新 `build`。

## 测试

```bash
cd plugin
powershell -File scripts/link-deps.ps1   # 一次性：junction 运行时依赖
npm run build                            # tsc -> lib/
npm test                                 # smoke + codegen + load（离线）
npm run e2e                              # 真机回归：连 48152 桥跑 19 项检查（需 Abaqus 桥开着）
```

- **e2e（`test/e2e.mjs`）**：连正在运行的 Abaqus/CAE bridge，用插件协议驱动真实工具（只读 + create_part/create_set/instantiate/create_material/assign_section/define_step/apply_load/set_bc/generate_mesh/set_workdir/run_python/set_friction + 非阻塞 submit_job/monitor_job）。已用它在真机上抓并修复过一批模板缺陷。

## 历史 / 迁移说明

本仓库是 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub)（MIT，Copyright 2026 Thompson Labs）的 **fork 与改写**。它保留了 Abaqus/CAE socket bridge 架构（基于 MIT 许可的 [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP)），但：

- 重写为 **DSH 原生 Cordis 插件**（不走 MCP），并按规范改为 **TypeScript 源码**（`src/*.ts` → `lib/`）；
- **21 个工具、三档授权 + 运维工具** 取代原先单个 `run_python` 收口；
- 新增 `abaqus_launch_cae`（拉启 Abaqus + 自动开桥）、`abaqus_submit_job` 异步化；
- 新增真机 `e2e` 回归，修复了一大批模板缺陷（几何/壳/独立实例/厚度常量/null 注入/材料/网格/friction）。
- **移除了上游 `Skill/abaqus/*` 目录**（第三方受限许可内容不随本仓库分发）。

详细迁移与修复记录见 [`docs/MIGRATION.md`](docs/MIGRATION.md)。

## License

MIT —— 见 [`LICENSE`](LICENSE) 与 [`plugin/NOTICE`](plugin/NOTICE)。
