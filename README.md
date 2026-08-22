# dsh-cae-agent

一个 **DSH（DeepSeek Harness）的 Cordis 插件**，通过 **原生工具**直接操作本机正在运行的 **Abaqus/CAE** 会话，覆盖完整建模链（几何、材料、网格、接触、分析步、载荷、边界、作业、ODB）。它是将 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) 的 Abaqus 集成迁移为 DSH 原生插件，取代了原先的 MCP 桥接方案。

**语言：** 中文 | [English](README.en.md)

## 它做什么

Abaqus/CAE 内运行一个 socket bridge（`abaqus_mcp_plugin.py`，v5 协议，`127.0.0.1:48152`），在 GUI 主线程派发 Abaqus Python。本插件用 Node TCP **直连**这个 bridge（**不走 MCP**），并把每个 Abaqus 操作注册为 DSH **原生工具**。

```
DSH(agent) ──原生工具──> dsh-cae-agent（本插件, TCP）──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## 工具：20 个原生工具，三档授权

| 档位 | 工具 | 策略 |
|---|---|---|
| **1 — 只读**（并发安全） | `abaqus_ping`、`abaqus_get_model_info`、`abaqus_list_jobs`、`abaqus_monitor_job`、`abaqus_inspect_odb`、`abaqus_capture_viewport` | 可直接放行 |
| **2 — 受控写**（独占 + schema 守卫） | `abaqus_create_part`、`abaqus_create_set`、`abaqus_instantiate`、`abaqus_create_material`、`abaqus_assign_section`、`abaqus_define_step`、`abaqus_apply_load`、`abaqus_set_bc`、`abaqus_generate_mesh`、`abaqus_create_interaction`、`abaqus_set_friction`、`abaqus_submit_job`、`abaqus_set_workdir` | 写操作需门禁/确认 |
| **3 — 任意代码**（最高权限） | `abaqus_run_python` | 使用前需确认 |

每个建模工具都在内部生成正确的 Abaqus Python——agent 只需提供业务参数（材料 E/ν、几何、摩擦等），不用写裸 Abaqus API。参数设计借鉴上游有限元方法论（材料决策、截面类型、接触摩擦、单位制、校验清单），但全部生成代码、描述、schema 均为自写。

## 仓库结构

```
├── plugin/            # DSH Cordis 插件包
│   ├── lib/
│   │   ├── index.js   # Cordis 入口: name/Config/inject/apply
│   │   ├── core.js    # socket-bridge 客户端 + runKernelCode + registerTool
│   │   └── tools/     # read / geometry / material / setup / interaction / mesh / job
│   └── test/          # smoke + codegen（校验生成的 Python 语法）
├── docs/
│   └── MIGRATION.md   # 迁移说明 + 本地测试清单
├── LICENSE
└── README.md / README.en.md
```

安装、工具细节与开发说明见 [`plugin/README.md`](plugin/README.md)。

## 历史 / 迁移说明

本仓库是 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub)（MIT，Copyright 2026 Thompson Labs）的 **fork 与改写**。它保留了 Abaqus/CAE socket bridge 架构（基于 MIT 许可的 [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP)），但：

- 将集成重写为 **DSH 原生 Cordis 插件**（不再走 MCP）；
- **20 个工具、三档授权** 取代原先单个 `run_python` 收口；
- **移除了上游 `Skill/abaqus/*` 目录**（第三方受限许可内容不随本仓库分发）。

上游归属声明见 [`plugin/NOTICE`](plugin/NOTICE) 与 [`LICENSE`](LICENSE)。

## License

MIT —— 见 [`LICENSE`](LICENSE) 与 [`plugin/NOTICE`](plugin/NOTICE)。
