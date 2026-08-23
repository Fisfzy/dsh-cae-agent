# dsh-cae-agent-sidebar

A **DSH web client plugin** that contributes a sidebar tab to
[`dsh-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) showing the
[`dsh-cae-agent`](../README.md) (Abaqus/CAE) **modeling workflow and operation logic**.

## Behavior

- When `dsh-better-sidebar` is **present**, it registers a tab titled **"Abaqus 工作流"**
  that renders the 11-step modeling chain (launch CAE → geometry → material → section →
  mesh → step → load/BC → contact/output → solve → post-process → run_python fallback),
  each with the tool(s) to call and a short operational note.
- When `dsh-better-sidebar` is **absent**, the plugin is a **no-op** — it probes the
  service with `ctx.get('betterSidebar')` (it is **not** in `inject`), so the host UI
  keeps working. This is the graceful-degradation pattern.

## Registering a tab

`ctx.get('betterSidebar')?.registerTab({ id, title, component })` — the returned disposer
is passed to `ctx.effect`, so it is cleaned up on unload/HMR. See `src/index.tsx`.

## Build

Requires the client bundler (`tsdown`) and the DSH client peer deps. In `client/`:

```sh
npm run typecheck   # tsc --noEmit
npm run build       # tsdown -> lib/
```

## Install into a profile

```sh
cd dsh-cae-agent/client
dsh plugin --profile <name> add .
```

(Keep `dsh-better-sidebar` installed + mounted in the same profile.)
