# 迁移说明：从 MCP 桥 迁移到 dsh-cae-agent 原生插件

本文记录本次改造（CAE-Agent-Hub → dsh-cae-agent v0.1.0）的迁移内容，作为本地测试参考。

## 迁移了什么

原来 Abaqus 通过 **MCP 桥**接入 DSH：

```
DSH ──MCP(stdin/out)──> mcp_server.py(Python) ──TCP──> Abaqus socket bridge ──> Abaqus kernel
```

迁移后改为 **DSH 原生 Cordis 插件**（本仓库 `plugin/`）：

```
DSH ──原生工具──> dsh-cae-agent(Node TCP) ──> Abaqus socket bridge ──> Abaqus kernel
```

- 去掉了 Python `mcp_server.py` 这一层 MCP 转发，Node 插件直连 Abaqus bridge。
- 工具从 `mcp__abaqus__*`（MCP 命名空间）变为原生 `abaqus_*`。

## 本次改动清单

| 改动 | 位置 |
|---|---|
| 新增 DSH Cordis 插件（9 个原生工具，三档授权） | `plugin/lib/index.js` |
| 插件包元数据 | `plugin/package.json` |
| 合规声明 | `plugin/LICENSE` / `plugin/NOTICE` |
| 使用说明 | `plugin/README.md` |
| 冒烟测试 | `plugin/test/smoke.test.mjs` |
| DSH 接入配置切换 | `~/.dsh/cordis.patch.yml`（本机） |

## 本地测试清单（由你执行）

1. **启动 Abaqus/CAE**，运行 `Plug-ins > Abaqus MCP > Start Socket Bridge`。
2. **重启 DSH**（使 `cordis.patch.yml` 的新插件配置生效）。
3. 确认 DSH 模型工具列表出现 `abaqus_*` 原生工具（不是 `mcp__abaqus__*`）。
4. 依次验证工具：
   - `abaqus_ping` → 返回 Abaqus version + 实时信息
   - `abaqus_get_model_info` → 模型/部件/材料清单
   - `abaqus_list_jobs` → 作业清单
   - `abaqus_run_python` → 如 `result = mdb.models.keys()`
   - `abaqus_set_workdir` → 切换 Abaqus 工作目录
5. 建模链验证（可选，逐步）：
   - `abaqus_create_part` → 建一个 box 部件
   - `abaqus_instantiate` → 装配实例化
   - `abaqus_create_set` → 在部件/装配上建集合
   - `abaqus_create_material` → 定义一个弹性材料
   - `abaqus_assign_section` → 赋截面
   - `abaqus_generate_mesh` → 画网格
   - `abaqus_define_step` / `abaqus_apply_load` / `abaqus_set_bc` → 定义分析步/加载荷/边界
   - `abaqus_create_interaction` / `abaqus_set_friction` → 接触（多体时）
   - `abaqus_submit_job` → 提交作业
   - `abaqus_inspect_odb` / `abaqus_capture_viewport` → 后处理/截图

开发期可先行跑
```bash
cd plugin
node test/smoke.test.mjs     # 20 工具注册 + 分档
node test/codegen.test.mjs   # 每个工具生成 Python 语法校验
```

## 回滚

若插件加载失败，把 `~/.dsh/cordis.patch.yml` 里的 `dsh-cae-agent` 块注释掉并重启 DSH 即可卸载；如需恢复 MCP 桥，可参照插件块的格式重新加回 `@deepseek-ai/dsh-mcp-client` 配置。

## License

MIT。详见 `plugin/LICENSE` 与 `plugin/NOTICE`。
