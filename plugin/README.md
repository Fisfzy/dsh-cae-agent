# dsh-cae-agent

DSH（DeepSeek Harness）的 Abaqus/CAE Cordis 插件：通过 DSH 原生工具直接操作本机正在运行的 Abaqus/CAE 会话。

基于 MIT 许可的 [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) 与 [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP) 改造。详见 [NOTICE](NOTICE)。

## 它做什么

Abaqus/CAE 内运行一个 socket bridge（`abaqus_mcp_plugin.py`，v5 协议，本机 `127.0.0.1:48152`），它把 Abaqus Python 派发到 GUI 主线程执行。本插件在 DSH 进程内用 Node TCP 客户端直接与这个 bridge 通信，并把每个 Abaqus 操作注册为 DSH 的**原生工具**（**不走 MCP**）。

```
DSH(agent) ──原生工具──> dsh-cae-agent(本插件, TCP) ──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## 工具（三个授权档）

### 档位 1 — 只读查询（可放心授权）
| 工具 | 作用 |
|---|---|
| `abaqus_ping` | 连接状态 + 实时会话信息 |
| `abaqus_get_model_info` | 模型/部件/材料/步骤/载荷/BC/装配清单 |
| `abaqus_list_jobs` / `abaqus_monitor_job` | 作业清单 / tail `.sta`+grep `.msg` 诊断 |
| `abaqus_inspect_odb` | ODB 步骤/帧/输出变量元数据 |
| `abaqus_capture_viewport` | 视口 PNG 截图（持久化为 DSH 附件） |

### 档位 2 — 受控写操作（schema 守卫，可门禁/确认）
| 工具 | 作用 |
|---|---|
| `abaqus_set_workdir` | 切换 Abaqus 工作目录 |
| `abaqus_submit_job` | 提交并等待作业完成 |

### 档位 3 — 任意代码兜底（最高权限）
| 工具 | 作用 |
|---|---|
| `abaqus_run_python` | 在 Abaqus kernel 执行任意 Python（`mdb`/`session`/`odbAccess`）。仅当档位 1/2 覆盖不到时使用。建议在 DSH 权限里对其实施 `ask`/高级确认。 |

建议在 DSH `tools/pre-execute` 或 `restrict()` 掩码中：档位 1 放行；档位 2、3 设 `ask`（确认后执行）。

## 安装（DSH 本地）

在 `~/.dsh/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-cae-agent
      name: "file:///D:/AIWORK/dsh-cae-agent/plugin/lib/index.js"
      config:
        host: "127.0.0.1"
        port: 48152
        timeoutMs: 120000
```

前提：Abaqus/CAE 已开启，且运行 `Plug-ins > Abaqus MCP > Start Socket Bridge`。

## 开发

```bash
cd plugin
npm run check              # node --check
node test/smoke.test.mjs   # 契约 + 工具注册冒烟
```

## 关于 Skill/ 目录（提醒）

上游 `Skill/abaqus/*`（Abaqus 建模工作流指令）来自第三方受限许可（`restricted`/`NOASSERTION`，非 MIT），**不作为本插件的一部分分发**。如需要，请自行按上游许可决定是否引入。

## License

MIT — 见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
