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

## 2026-08-22 重构：JS → TypeScript（dsh-plugin-dev 规范）

纯 JS（`plugin/lib/*.js`）版已按 `dsh-plugin-dev` 技能标准整体重写为 TypeScript（`plugin/src/*.ts`），构建产物仍输出到 `plugin/lib/`（`file://` 指向不变）。

### 变更点

- **源码形态**：`plugin/src/`（`core.ts` + `tools/{read,material,geometry,setup,interaction,mesh,job}.ts` + `index.ts`），`main`/`exports` 指向 `lib/index.js`。
- **`inject`**：`['tools', 'attachments']`（两者均为必需依赖；`attachments` 供 `capture_viewport` 持久化截图）。
- **`Config`**：改用 Schemastery 的 `export interface Config` + `export const Config: Schema<Config>`（默认值写进 schema），而非普通对象。
- **工具注册**：全部改用 `ctx.tools.register(defineTool({...}))`；`parameters` 用 DSL 声明、`output.schema`/`output.render` 分离（execute 返回规范 JSON 值，render 负责人类可读文本）。
- **并发安全**：Tier-1 只读工具 `isConcurrencySafe: () => true`；Tier-2/3 写工具未声明 → fail-closed 独占。
- **取消**：`execute(args, exec)` 将 `exec.signal` 传入 bridge 客户端（TCP 请求可中止）。
- **`capture_viewport` 依赖**：`ctx.attachments.saveImage({ data, mediaType:'image/png' })`（dsh-attachment 服务，经 `@deepseek-ai/dsh-attachment` 类型增强）。
- **构建**：`tsc -p tsconfig.json`（NodeNext → `lib/`）；`scripts/link-deps.ps1` 把发行包的 `@deepseek-ai/{cordis,dsh-tools,schemastery,dsh-attachment}` 与 `@types/node` junction 进 `plugin/node_modules`（私有 restricted 包，外网不可装）。

### 构建与测试

```bash
cd plugin
powershell -File scripts/link-deps.ps1   # 一次性：junction 运行时依赖
npm install --no-save typescript@^5.6.3   # 编译器（或先 npm i -D typescript）
npm run build                             # tsc -> lib
npm test                                  # smoke + codegen（20 工具，Python 语法校验）
```

### DSH 接入

`~/.dsh/cordis.patch.yml` 中 `dsh-cae-agent` 仍指向 `file:///D:/AIWORK/dsh-cae-agent/plugin/lib/index.js`（TS 构建产物），无需改动；重启 DSH 后 `window.__DSH_BOOT__.entries` 应出现 `dsh-cae-agent`。

### 新增运维工具 `abaqus_launch_cae`（第 21 个工具）

新增 `src/tools/launch.ts`：「一条指令调起 Abaqus/CAE」。它把插件从"依赖已运行 Abaqus"扩展到"能主动拉启 Abaqus/CAE 并自动开 bridge"：

- 幂等：48152 已在监听 → 直接复用；否则拉启。
- 在 `workspaceDir` 生成一个 startup 文件（加载 `abaqus_mcp_plugin.py` 到 `__main__` 并调用 `mcp_start()`），让 bridge **自动开**，无需手动点菜单。
- `spawn abaquesCommand cae startup=<file>`（detached + unref，CAE 窗口存活于本工具调用之后）。
- 轮询 bridge 端口直到可 `ping`，遵守 `exec.signal` 取消 + `launchTimeoutMs`。
- 新增配置项：`abaqusCommand` / `bridgePluginPath` / `workspaceDir` / `launchTimeoutMs`。

**约束**：调起 Abaqus/CAE 需要**交互式桌面会话**（Abaqus GUI 内核初始化依赖图形上下文）；headless 下 `from abaqus import ...` 会挂起（非脚本问题，是 Abaqus 架构）。所以该工具的用户侧验证需在桌面会话里弹窗完成。

## 2026-08-22 真机 e2e 暴露并修复的插件缺陷

新增 `test/e2e.mjs`（连 48152 桥、驱动真实工具、临时测试模型跑写工具），一把抓出一批模板缺陷并全部修复：

- **通用 null 注入 bug（影响 6 个工具）**：`JSON.stringify(null)` 会在 Python 模板里变成裸 `null`/`true`/`false`，触发 `NameError`。已在 `assign_section`/`apply_load`/`set_bc`/`define_step`/`create_interaction`/`instantiate`/`generate_mesh`/`create_set` 统一改为输出 Python `None` + `is not None` 判断。
- **`create_part`**：移除死导入 `FOUR_NODE_TET`；`shape` 关键字在 Abaqus 2024 非法（去掉）；`type` 从字符串"DEFORMABLE"映射到枚举常量 `DEFORMABLE_BODY` 等；`part.MainSketch` 不存在 → 改用 `m.ConstrainedSketch` + `BaseSolidExtrude`。
- **`create_material`**：移除死代码 `add=mat.elastic`（新材料访问会 AttributeError）。
- **`define_step`**：`maxInc=1e5` ≥ `timePeriod` 被 Abaqus 拒绝 → 改为 `maxInc=timePeriod`。
- **`assign_section`**：默认按几何自适应 solid/shell；shell 厚度 `SPECIFY_THICKNESS` → `UNIFORM`；`reg.name`（Set 无该属性）→ 返回集合名字符串。
- **`generate_mesh`**：`from part import ElemType` 在当前内核不可导入（去掉显式 setElementType，用默认网格器）；独立实例模型自动改到装配实例上 `seedPartInstance`+`generateMesh`。

e2e 现覆盖 19 项（只读 + create_part/create_set/instantiate/create_material/assign_section/define_step/apply_load/set_bc/generate_mesh/set_workdir/run_python/set_friction + 非阻塞 submit_job/桥响应/monitor_job + 复核），全绿。作为后续改动的回归兜底。

### 后续一轮（本轮）修复

- **`submit_job` 改异步**：去掉 `waitForCompletion()`（它会阻塞桥的 GUI 派遣器，导致求解期间插件整体不可用/其它工具超时）。改为 `submit()` 后立即返回 `mode=submitted`，用 `monitor_job` 轮询 `.sta/.lck`。实测提交返回约 2.7s、桥保持响应。**这是把"求解会让插件瘫痪"这个实测缺陷修掉的关键。**
- **`set_friction`**：补 `abaqusConstants` 引入（`PENALTY/ISOTROPIC/OFF/FRACTION/HARD/ON/FRICTIONLESS`）；kwarg 名 `pressureDependence`→`pressureDependency`（`slipRateDependency`/`temperatureDependency` 同）；`maximumElasticSlip=FRACTION` 需配套 `fraction=0.005`（否则报"弹性滑动容差分数必须大于零"）。
- **e2e 扩到 19 项**：新增 set_workdir / run_python / set_friction / submit_job(非阻塞) / bridge响应 / monitor_job。

## License

MIT。详见 `plugin/LICENSE` 与 `plugin/NOTICE`。
