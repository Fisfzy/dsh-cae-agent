# dsh-cae-agent

A [DeepSeek Harness](https://github.com/deepseek-ai) (DSH) **Cordis plugin** that operates a
live **Abaqus/CAE** session through **native `abaqus_*` tools** (no MCP bridge). Written in
TypeScript per the `dsh-plugin-dev` standard.

- **Version:** `0.2.1`
- **Tools:** 28 native tools across three authorization tiers + `abaqus_launch_cae`
  (geometry / material / section / mesh / step / load / BC / interaction / composite /
  output / ODB post-processing / job / arbitrary-code fallback)
- **License:** MIT

## Provenance / About

This project **references and adapts** the socket-bridge architecture and Abaqus modeling
methodology of the following upstream projects — it is **not** a 1:1 copy nor a full upstream
implementation:

- [CAE-Agent-Hub](https://github.com/Cai-aa/CAE-Agent-Hub) (MIT, Copyright 2026 Thompson Labs)
- [Abaqus-Control-MCP](https://github.com/Whfkl/Abaqus-Control-MCP) (MIT)

It is an **independent reimplementation and extension** as a DSH-native Cordis plugin. The
composite/layup path deliberately uses **shell composite** (`CompositeShellSection` +
`SectionLayer`, S4R unit) rather than the upstream solid-laminate approach, per project
requirements. Full attribution is in [`plugin/NOTICE`](plugin/NOTICE) and [`LICENSE`](LICENSE).
