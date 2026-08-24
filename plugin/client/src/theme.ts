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
  --cae-ease: cubic-bezier(0.22, 1, 0.36, 1);
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

/* ── live progress stepper (Mac-style status rail) ─────────────────────── */
.cae-step { display: flex; gap: 10px; align-items: stretch; }
.cae-rail { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 18px; }
.cae-dot {
  width: 15px; height: 15px; border-radius: 999px;
  border: 2px solid var(--cae-faint); background: var(--cae-card);
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0; margin-top: 6px;
}
.cae-line { flex: 1; width: 2px; background: var(--cae-border); margin: 3px 0 0; min-height: 10px; }
.cae-step:last-child .cae-line { display: none; }
.cae-dot-done { background: var(--cae-ok); border-color: var(--cae-ok); }
.cae-dot-error { background: var(--cae-err); border-color: var(--cae-err); }
.cae-dot-active { background: var(--cae-accent); border-color: var(--cae-accent); animation: caePulse 1.6s ease-out infinite; }
@keyframes caePulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cae-accent) 45%, transparent); }
  70%  { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.cae-card-active {
  border-color: var(--cae-accent) !important;
  box-shadow: 0 0 0 1px var(--cae-accent-soft), var(--cae-shadow) !important;
}
.cae-card-error {
  border-color: var(--cae-err) !important;
  background: var(--cae-err-soft) !important;
}
.cae-card-done { border-left: 3px solid var(--cae-ok) !important; }

/* ── section cards + smooth expand/collapse ────────────────────────────── */
.cae-section {
  border: 1px solid var(--cae-border);
  border-radius: var(--cae-radius);
  background: var(--cae-card);
  box-shadow: var(--cae-shadow);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.2s var(--cae-ease), box-shadow 0.2s var(--cae-ease);
}
.cae-section-open { border-color: color-mix(in srgb, var(--cae-accent) 35%, var(--cae-border)); }
.cae-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  text-align: left;
  transition: background 0.15s var(--cae-ease);
}
.cae-section-header:hover { background: var(--cae-card-hover); }
.cae-section-chevron {
  display: inline-flex;
  color: var(--cae-faint);
  transform: rotate(0deg);
  transition: transform 0.24s var(--cae-ease);
  flex-shrink: 0;
}
.cae-section-open .cae-section-chevron { transform: rotate(90deg); }
.cae-section-title { font-weight: 700; font-size: 13px; color: var(--cae-fg); }
.cae-section-count { font-size: 11px; color: var(--cae-faint); }
/* the animatable collapse region: 0fr -> 1fr */
.cae-section-body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.3s var(--cae-ease), opacity 0.24s var(--cae-ease);
}
.cae-section-open .cae-section-body { grid-template-rows: 1fr; opacity: 1; }
.cae-section-body-inner {
  overflow: hidden;
  min-height: 0;
  padding: 0 12px 10px 12px;
}
/* staggered card fade/slide-in: set --i per card, delay scales with it */
.cae-step {
  --i: 0;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.26s var(--cae-ease) calc(var(--i) * 40ms),
              transform 0.26s var(--cae-ease) calc(var(--i) * 40ms);
}
.cae-section-open .cae-step { opacity: 1; transform: translateY(0); }
/* the section hint line fades in too */
.cae-section-hint {
  font-size: 11px;
  color: var(--cae-faint);
  margin: 0 0 8px 2px;
  transition: opacity 0.22s var(--cae-ease);
}

/* ── reduced motion: drop the fancy transitions (no a11y regression) ────── */
@media (prefers-reduced-motion: reduce) {
  .cae-section-body,
  .cae-step,
  .cae-section-chevron,
  .cae-section,
  .cae-section-header { transition: none !important; }
  .cae-step { opacity: 1; transform: none; }
}
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
