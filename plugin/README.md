# dsh-cae-agent

DSH（DeepSeek Harness）的 Abaqus/CAE Cordis 插件：通过 DSH **原生工具**直接操作本机正在运行的 Abaqus/CAE 会话，覆盖完整建模链。

基于 MIT 许可的 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) 与 [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP) 改造。详见 [NOTICE](NOTICE)。

## 架构

Abaqus/CAE 内运行一个 socket bridge（`abaqus_mcp_plugin.py`，v5 协议，本机 `127.0.0.1:48152`），它在 GUI 主线程派发 Abaqus Python。本插件在 DSH 进程内用 Node TCP **直连**这个 bridge（**不走 MCP**），把每个 Abaqus 操作注册为 DSH 原生工具。

```
DSH(agent) ──原生工具──> dsh-cae-agent(本插件, TCP) ──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## 工具（20 个，三档授权）

### 档位 1 — 只读查询（并发安全，可直接放行）
| 工具 | 作用 |
|---|---|
| `abaqus_ping` | 连接状态 + 实时会话信息 |
| `abaqus_get_model_info` | 模型/部件/材料/步骤/载荷/BC/集合清单 |
| `abaqus_list_jobs` / `abaqus_monitor_job` | 作业清单 / tail `.sta` + grep `.msg` |
| `abaqus_inspect_odb` | ODB 步骤/帧/输出变量元数据 |
| `abaqus_capture_viewport` | 视口 PNG 截图（持久化为 DSH 附件） |

### 档位 2 — 受控建模/写操作（schema 守卫，独占执行）
| 域 | 工具 |
|---|---|
| 几何 | `abaqus_create_part`（box/cylinder 基元）、`abaqus_create_set`（按类型/坐标选几何）、`abaqus_instantiate` |
| 材料+截面 | `abaqus_create_material`（弹性/塑性/密度/热）、`abaqus_assign_section`（solid/shell） |
| 分析 | `abaqus_define_step`（static/dynamic/modal）、`abaqus_apply_load`（pressure/concentrated/gravity）、`abaqus_set_bc`（encastre/pinned/displacement/symmetry） |
| 接触 | `abaqus_create_interaction`（contact/tie）、`abaqus_set_friction` |
| 网格 | `abaqus_generate_mesh`（C3D8R/C3D4R/S4R，自动种子） |
| 作业 | `abaqus_submit_job`、`abaqus_set_workdir` |

### 档位 3 — 任意代码兜底（最高权限）
| 工具 | 作用 |
|---|---|
| `abaqus_run_python` | 在 Abaqus kernel 执行任意 Python。仅当档位 1/2 覆盖不到时使用；建议在 DSH 里对其设置 `ask`/确认。 |

### 运维 — 调起 Abaqus/CAE
| 工具 | 作用 |
|---|---|
| `abaqus_launch_cae` | 拉启本地 Abaqus/CAE GUI 并**自动开 socket bridge**（默认 127.0.0.1:48152），之后即可用其它 `abaqus_*` 工具操作。幂等：桥已在跑则复用。需交互桌面会话（会弹 Abaqus 窗口）。 |

## 代码结构

```
plugin/
├── src/                     # TypeScript 源码（dsh-plugin-dev 规范）
│   ├── index.ts             # Cordis 入口: name/Config(Schemastery)/inject/apply, 聚合各域
│   ├── core.ts              # socket bridge 客户端 + runKernelCode（支持 exec.signal 取消）
│   └── tools/
│       ├── read.ts          # 档1 只读
│       ├── geometry.ts      # part/set/instantiate
│       ├── material.ts      # create_material/assign_section
│       ├── setup.ts         # define_step/apply_load/set_bc
│       ├── interaction.ts   # create_interaction/set_friction
│       ├── mesh.ts          # generate_mesh
│       └── job.ts           # submit_job/set_workdir/run_python
├── lib/                     # tsc 构建产物（Dsh 加载入口 lib/index.js，含 .d.ts）
├── scripts/
│   └── link-deps.ps1        # 构建期把发行包 @deepseek-ai/* junction 进 node_modules
├── test/
│   ├── smoke.test.mjs       # 契约 + 21 工具注册 + 分档断言 + 并发安全
│   ├── codegen.test.mjs     # 每个工具生成 Python 的 ast 语法校验
│   └── load.test.mjs        # 真实 Cordis 运行时加载 + Schemastery 校验 + 卸载
└── package.json / LICENSE / NOTICE / README.md
```

## 安装（DSH 本地）

在 `~/.dsh/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-cae-agent
      name: "file://<repo>/plugin/lib/index.js"        # <repo> = 本仓库绝对路径
      config:
        host: "127.0.0.1"
        port: 48152
        timeoutMs: 120000
        # 以下各项都可省略——均有可移植默认（见 src/index.ts），按需覆盖即可：
        # abaqusCommand: "…/abaqus.bat"                # Abaqus 启动命令
        # bridgePluginPath: "~/.abaqus-mcp/abaqus_mcp_plugin.py"  # CAE 内 socket bridge 插件
        # workspaceDir: "~/.abaqus-cae"                # launch_cae 工作目录
        # launchTimeoutMs: 180000                      # 等桥就绪超时
```
> 示例中 `<repo>` 与 `~` 需替换为你本机的实际绝对路径；**不要**把含本机用户名的路径提交进仓库。

前提（二选一）：
- **手动**：Abaqus/CAE 已开启 → `Plug-ins > Abaqus MCP > Start Socket Bridge`；
- **自动**：调 `abaqus_launch_cae`，插件自动拉启 CAE 并加载 bridge（需交互桌面会话，会弹 Abaqus 窗口）。

## 开发与测试

```bash
cd plugin
powershell -File scripts/link-deps.ps1     # 一次性：junction 运行时依赖(@deepseek-ai/cordis,dsh-tools,schemastery,dsh-attachment)
npm run build                             # tsc -p tsconfig.json → lib/（含 .d.ts）
npm test                                  # smoke + codegen + load（21 工具，真实 Cordis 加载）
npm run e2e                               # 真机回归：连 48152 桥跑关键工具（需 Abaqus 桥开着）
npm run typecheck                         # tsc --noEmit
```

**真机 e2e**（`test/e2e.mjs`）：连上正在运行的 Abaqus/CAE socket bridge（默认 127.0.0.1:48152），用插件协议驱动真实工具（只读 + create_part/create_set/instantiate/create_material/assign_section/define_step/apply_load/set_bc/generate_mesh），在临时测试模型里跑写工具，输出 PASS/FAIL。要求 Abaqus/CAE 已开桥。它会自动修整/发现模板缺陷——是插件"系统性自检"的关键。

> 依赖说明：`@deepseek-ai/{cordis,dsh-tools,schemastery,dsh-attachment}` 是 restricted/私有包，外网不能直接 `npm i`；`scripts/link-deps.ps1` 从已安装的 DSH 发行包把它们 junction 进 `plugin/node_modules`，类型与运行时都能解析。

## 关于 Skill/ 目录（提醒）

上游 `Skill/abaqus/*`（Abaqus 建模工作流指令）来自第三方受限许可（`restricted`/`NOASSERTION`，非 MIT），**不作为本插件的一部分分发**。本插件工具的业务参数设计借鉴其方法论（材料决策表、section 类型选择、接触摩擦、单位制与校验），但全部生成代码/描述/schema 均为自写。

## License

MIT — 见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
