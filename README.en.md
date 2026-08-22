# dsh-cae-agent

A **DSH (DeepSeek Harness) Cordis plugin** that operates a live **Abaqus/CAE** session through native tools — covering the entire modeling chain (geometry, material, mesh, contact, steps, loads, BCs, jobs, ODB). It is a migration of the Abaqus integration of [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) into a native DSH plugin, replacing the prior MCP-bridge approach.

**Language:** [中文](README.md) | English

## What it does

Abaqus/CAE runs a socket bridge (`abaqus_mcp_plugin.py`, v5 protocol, `127.0.0.1:48152`) that dispatches Abaqus Python on the GUI main thread. This plugin talks to that bridge over Node TCP **directly — no MCP hop** — and registers each Abaqus operation as a **native DSH tool**.

```
DSH(agent) ──native tool──> dsh-cae-agent (this plugin, TCP) ──> Abaqus/CAE socket bridge ──> Abaqus kernel
```

## Tools: 20 native tools in three authorization tiers

| Tier | Tools | Policy |
|---|---|---|
| **1 — read-only** (concurrency-safe) | `abaqus_ping`, `abaqus_get_model_info`, `abaqus_list_jobs`, `abaqus_monitor_job`, `abaqus_inspect_odb`, `abaqus_capture_viewport` | can be auto-authorized |
| **2 — controlled write** (exclusive, schema-guarded) | `abaqus_create_part`, `abaqus_create_set`, `abaqus_instantiate`, `abaqus_create_material`, `abaqus_assign_section`, `abaqus_define_step`, `abaqus_apply_load`, `abaqus_set_bc`, `abaqus_generate_mesh`, `abaqus_create_interaction`, `abaqus_set_friction`, `abaqus_submit_job`, `abaqus_set_workdir` | guard/approve writes |
| **3 — arbitrary code** (max authority) | `abaqus_run_python` | approve before use |

Every modeling tool generates the correct Abaqus Python internally — the agent supplies business parameters (material E/ν, geometry, friction, etc.), not raw Abaqus API calls. Parameter design borrows upstream FEA methodology (material decisions, section types, contact friction, units, validation) but all generated code, descriptions and schemas are self-written.

## Repository layout

```
├── plugin/            # the DSH Cordis plugin package
│   ├── lib/
│   │   ├── index.js   # Cordis entry: name/Config/inject/apply
│   │   ├── core.js    # socket-bridge client + runKernelCode + registerTool
│   │   └── tools/     # read / geometry / material / setup / interaction / mesh / job
│   └── test/          # smoke + codegen (validates generated Python syntax)
├── docs/
│   └── MIGRATION.md   # migration notes + local test checklist
├── LICENSE
└── README.md / README.en.md
```

See [`plugin/README.md`](plugin/README.md) for install, tool details and development.

## History / migration note

This repository is a **fork and rewrite** of [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) (MIT, Copyright 2026 Thompson Labs). It keeps the Abaqus/CAE socket-bridge architecture (based on the MIT-licensed [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP)) but:

- reworks the integration into a **native DSH Cordis plugin** (no MCP hop);
- exposes a **20-tool, three-tier native toolset** instead of a single `run_python` funnel;
- **drops the upstream `Skill/abaqus/*` directory** (third-party `restricted`-licensed content is not redistributed).

Upstream attribution is preserved in [`plugin/NOTICE`](plugin/NOTICE) and [`LICENSE`](LICENSE).

## License

MIT — see [`LICENSE`](LICENSE) and [`plugin/NOTICE`](plugin/NOTICE).
