# dsh-cae-agent

A **DSH (DeepSeek Harness) Cordis plugin** that operates a live **Abaqus/CAE** session through native tools — covering the entire modeling chain (geometry, material, mesh, contact, steps, loads, BCs, jobs, ODB). It is a migration of the Abaqus integration of [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) into a native DSH plugin, replacing the prior MCP-bridge approach. **Source code is TypeScript, developed to the `dsh-plugin-dev` spec.**

**Version:** `0.2.0` (`v0.2.0` tag)

**Language:** [中文](README.md) | English

## What it does

Abaqus/CAE runs a socket bridge (`abaqus_mcp_plugin.py`, v5 protocol, default `127.0.0.1:48152`) that dispatches Abaqus Python on the GUI main thread. This plugin talks to that bridge over Node TCP **directly — no MCP hop** — and registers each Abaqus operation as a **native DSH tool**.

```
DSH(agent) ──native tool──> dsh-cae-agent (this plugin, TCP) ──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## Tools: 21 native tools — three authorization tiers + one ops tool

| Tier | Tools | Policy |
|---|---|---|
| **1 — read-only** (concurrency-safe) | `abaqus_ping`, `abaqus_get_model_info`, `abaqus_list_jobs`, `abaqus_monitor_job`, `abaqus_inspect_odb`, `abaqus_capture_viewport` | can be auto-authorized |
| **2 — controlled write** (exclusive, schema-guarded) | `abaqus_create_part`, `abaqus_create_set`, `abaqus_instantiate`, `abaqus_create_material`, `abaqus_assign_section`, `abaqus_define_step`, `abaqus_apply_load`, `abaqus_set_bc`, `abaqus_generate_mesh`, `abaqus_create_interaction`, `abaqus_set_friction`, `abaqus_submit_job`, `abaqus_set_workdir` | guard/approve writes |
| **3 — arbitrary code** (max authority) | `abaqus_run_python` | approve before use |
| **Ops** | `abaqus_launch_cae` | launch local Abaqus/CAE + auto-open bridge |

Every modeling tool generates the correct Abaqus Python internally — the agent supplies business parameters (material E/ν, geometry, friction, etc.), not raw Abaqus API calls. Parameter design borrows upstream FEA methodology, but all generated code, descriptions and schemas are self-written.

### `abaqus_launch_cae`
- **Idempotent**: if 48152 is already listening, the existing session is reused; otherwise it launches `abaqus cae` and auto-loads the bridge (no manual menu click).
- Requires an **interactive desktop session** (Abaqus GUI kernel boot needs a graphics context); an Abaqus/CAE window will open.

### `abaqus_submit_job` (async)
`submit()` returns immediately (`mode=submitted`) and **does not block the bridge**, so other tools stay usable during a solve; poll `abaqus_monitor_job` / `.sta` / `.lck` for progress.

## Repository layout

```
├── plugin/                 # the DSH Cordis plugin package (pure TypeScript source)
│   ├── src/                # ★ source code (edit here)
│   │   ├── index.ts        #   Cordis entry: name/Config(Schemastery)/inject/apply
│   │   ├── core.ts         #   socket-bridge client + runKernelCode (honors exec.signal)
│   │   └── tools/          #   read/geometry/material/setup/interaction/mesh/job/launch
│   ├── lib/                # build output (tsc from src + .d.ts; do not hand-edit)
│   ├── tsconfig.json       # NodeNext -> lib/
│   ├── scripts/            # link-deps.ps1 (junctions for runtime deps)
│   ├── test/               # smoke/codegen/load (offline) + e2e (live-bridge regression)
│   └── package.json        # build/test/e2e scripts
├── docs/
│   └── MIGRATION.md        # migration notes + live-test history
├── LICENSE
└── README.md / README.en.md
```

> **Spec note**: source lives in `src/*.ts`; `lib/*.js` is the `npm run build` (`tsc`) output that DSH loads. Rebuild after editing.

## Testing

```bash
cd plugin
powershell -File scripts/link-deps.ps1   # one-time: junction runtime deps
npm run build                            # tsc -> lib/
npm test                                 # smoke + codegen + load (offline)
npm run e2e                              # live regression: 19 checks against the 48152 bridge (needs Abaqus bridge up)
```

- **e2e (`test/e2e.mjs`)** connects to a running Abaqus/CAE bridge and drives the real tools (read-only + create_part/create_set/instantiate/create_material/assign_section/define_step/apply_load/set_bc/generate_mesh/set_workdir/run_python/set_friction + non-blocking submit_job/monitor_job). It has already surfaced and fixed a number of template defects live.

## History / provenance & coverage

This project **references and adapts** the **socket-bridge architecture** and **Abaqus modeling methodology** of [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) (MIT, Copyright 2026 Thompson Labs) and [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP) (MIT), then **independently rewrites and extends** them into a native DSH Cordis plugin. It is not a 1:1 reimplementation of the upstream project.

**Tool coverage vs. upstream Abaqus capability:**
- ✅ Live Abaqus session ops: `run_python` / model & job queries / `submit_job` / `monitor_job` / `inspect_odb` / `capture_viewport` / `set_workdir` (covers its MCP tool surface, **plus a complete modeling-write chain**: part/set/assembly/material/section/step/load/BC/mesh/contact/friction, and an ops tool `abaqus_launch_cae`)
- ⚠️ Upstream workflow-**guidance SKILLs** (geometry/material/mesh/step/load/bc/static/modal/dynamic/thermal/contact, etc.): this plugin covers the underlying capability with directly-executable native tools, but does not ship the upstream SKILL instruction set
- ⚠️ `result_mesh.json` **browser viewer**: not provided (judged low-value)
- ⚠️ Tosca **shape/topology optimization**: no dedicated tool; use `abaqus_run_python` manually

**Differences:** the upstream `Skill/abaqus/*` instruction tree is not carried along (third-party content not redistributed); several capabilities go further than upstream (full native modeling-write chain, one-command Abaqus launch).

Upstream attribution is preserved in [`plugin/NOTICE`](plugin/NOTICE) and [`LICENSE`](LICENSE).

## License

MIT — see [`LICENSE`](LICENSE) and [`plugin/NOTICE`](plugin/NOTICE).
