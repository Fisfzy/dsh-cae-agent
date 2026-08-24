/**
 * dsh-cae-agent client theme — design tokens as CSS custom properties.
 *
 * One stylesheet is injected once into <head> (id "cae-agent-theme") and every
 * component references the tokens via var(--cae-*). Light values are the
 * default; dark values override under `prefers-color-scheme: dark` AND under a
 * host theme hint (`[data-theme="dark"]` / `.dark` on any ancestor), so the
 * panel follows the shell regardless of which mechanism the host uses.
 *
 * Components wrap themselves in a `.cae-root` element so the tokens scope to
 * this plugin only and never leak into the host sidebar.
 */

const STYLE_ID = 'cae-agent-theme'

const CSS = `
.cae-root {
  --cae-fg: #1f2328;
  --cae-muted: #6a737d;
  --cae-faint: #8a9199;
  --cae-border: rgba(27, 31, 35, 0.14);
  --cae-card: #ffffff;
  --cae-card-hover: #f6f8fa;
  --cae-inset: rgba(27, 31, 35, 0.04);
  --cae-accent: #0969da;
  --cae-accent-soft: rgba(9, 105, 218, 0.1);
  --cae-ok: #1a7f37;
  --cae-ok-soft: rgba(26, 127, 55, 0.12);
  --cae-warn: #9a6700;
  --cae-warn-soft: rgba(154, 103, 0, 0.14);
  --cae-err: #d1242f;
  --cae-err-soft: rgba(209, 36, 47, 0.1);
  --cae-run: #8250df;
  --cae-run-soft: rgba(130, 80, 223, 0.12);
  --cae-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --cae-radius: 8px;
  --cae-radius-sm: 5px;
  --cae-shadow: 0 1px 2px rgba(27, 31, 35, 0.06);
}
.cae-root[data-cae-dark="1"],
[data-theme="dark"] .cae-root,
.dark .cae-root {
  --cae-fg: #e6e9ec;
  --cae-muted: #9aa2ab;
  --cae-faint: #7d858e;
  --cae-border: rgba(230, 233, 236, 0.16);
  --cae-card: #1b1f24;
  --cae-card-hover: #232830;
  --cae-inset: rgba(230, 233, 236, 0.06);
  --cae-accent: #4493f8;
  --cae-accent-soft: rgba(68, 147, 248, 0.16);
  --cae-ok: #3fb950;
  --cae-ok-soft: rgba(63, 185, 80, 0.16);
  --cae-warn: #d29922;
  --cae-warn-soft: rgba(210, 153, 34, 0.18);
  --cae-err: #f85149;
  --cae-err-soft: rgba(248, 81, 73, 0.16);
  --cae-run: #a371f7;
  --cae-run-soft: rgba(163, 113, 247, 0.16);
  --cae-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
@media (prefers-color-scheme: dark) {
  .cae-root:not([data-cae-dark="0"]) {
    --cae-fg: #e6e9ec;
    --cae-muted: #9aa2ab;
    --cae-faint: #7d858e;
    --cae-border: rgba(230, 233, 236, 0.16);
    --cae-card: #1b1f24;
    --cae-card-hover: #232830;
    --cae-inset: rgba(230, 233, 236, 0.06);
    --cae-accent: #4493f8;
    --cae-accent-soft: rgba(68, 147, 248, 0.16);
    --cae-ok: #3fb950;
    --cae-ok-soft: rgba(63, 185, 80, 0.16);
    --cae-warn: #d29922;
    --cae-warn-soft: rgba(210, 153, 34, 0.18);
    --cae-err: #f85149;
    --cae-err-soft: rgba(248, 81, 73, 0.16);
    --cae-run: #a371f7;
    --cae-run-soft: rgba(163, 113, 247, 0.16);
    --cae-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
}
.cae-root {
  color: var(--cae-fg);
  font-family: inherit;
  line-height: 1.5;
}
.cae-root * { box-sizing: border-box; }
.cae-root button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.cae-root input[type="text"] {
  font: inherit;
  color: var(--cae-fg);
  background: var(--cae-card);
  border: 1px solid var(--cae-border);
  border-radius: var(--cae-radius-sm);
  padding: 4px 8px;
  width: 100%;
  outline: none;
}
.cae-root input[type="text"]:focus {
  border-color: var(--cae-accent);
  box-shadow: 0 0 0 2px var(--cae-accent-soft);
}
.cae-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.cae-root ::-webkit-scrollbar-thumb { background: var(--cae-border); border-radius: 4px; }
`

/** Inject the plugin stylesheet once. Idempotent — safe to call per mount. */
export function ensureCaeStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}
