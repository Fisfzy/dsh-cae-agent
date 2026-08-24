window.__ModuleLoader__.load({
	id: "dsh-cae-agent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region client/src/theme.ts
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
		const STYLE_ID = "cae-agent-theme";
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
`;
		/** Inject the plugin stylesheet once. Idempotent — safe to call per mount. */
		function ensureCaeStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID)) return;
			const el = document.createElement("style");
			el.id = STYLE_ID;
			el.textContent = CSS;
			document.head.appendChild(el);
		}
		//#endregion
		//#region client/src/steps.ts
		const SECTIONS = [
			{
				key: "pre",
				title: "前处理",
				hint: "建模 → 材料 → 截面 → 网格 → 步 → 载荷/边界 → 接触/输出"
			},
			{
				key: "solve",
				title: "求解",
				hint: "提交作业并轮询直至完成"
			},
			{
				key: "post",
				title: "后处理与兜底",
				hint: "云图 / 导出 CSV / 任意 Python"
			}
		];
		const KIND_LABEL = {
			solid: "实体",
			shell: "壳",
			composite: "复合",
			beam: "梁"
		};
		const STEPS = [
			{
				n: "1",
				goal: "拉起 Abaqus 会话",
				tools: ["abaqus_launch_cae"],
				note: "幂等：bridge(48152) 已在监听则复用；否则拉起 CAE 并自动开 socket bridge。",
				section: "pre",
				kinds: "any",
				detail: {
					example: "abaqus_launch_cae()",
					pitfall: "首次拉起 CAE 较慢（数十秒）；bridge 已存在时直接复用，不要重复拉起。"
				}
			},
			{
				n: "2",
				goal: "几何",
				tools: [
					"abaqus_create_part",
					"abaqus_create_set",
					"abaqus_instantiate"
				],
				note: "box/cylinder 基元建零件；选几何(按类型/坐标)；装配到 rootAssembly。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "create_part: primitive=box(boxX/boxY/boxZ) 或 cylinder(radius/height, axis)；create_set: region=cells|faces|edges|vertices + indices 或 {points:[[x,y,z]]}。",
					example: "abaqus_create_part(model, name, boxX=50, boxY=50, boxZ=10) → abaqus_instantiate(model)",
					pitfall: "任意形状先用 abaqus_run_python 走 sketch；基元只能建 box/cylinder。"
				}
			},
			{
				n: "3",
				goal: "材料",
				tools: ["abaqus_create_material", "abaqus_define_orthotropic_material"],
				note: "各向同性用 create_material；正交/各向异性用 define_orthotropic_material。单位 mm-t-s-N-MPa；动力学/重力需 density。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "props: {\"elastic\":{\"E\":210000,\"nu\":0.3},\"density\":{\"density\":7.85e-9}}；正交：table=[[E1,E2,E3,nu12,nu13,nu23,G12,G13,G23]]。",
					example: "abaqus_create_material(model,\"Steel\",{\"elastic\":{\"E\":210000,\"nu\":0.3},\"density\":{\"density\":7.85e-9}})",
					pitfall: "忘记 density 会让 dynamic/gravity 步报错；单位制要统一（mm-tonne-s）。"
				}
			},
			{
				n: "4",
				goal: "截面",
				tools: ["abaqus_assign_section", "abaqus_define_composite_layup"],
				note: "solid/shell/beam 用 assign_section；复合铺层用 define_composite_layup（CompositeShellSection+SectionLayer，默认 SHELL/S4R）。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "assign_section: sectionType=solid|shell|beam（shell 需 thickness）；composite: plyAngles=[0,90,...], plyThickness。",
					example: "abaqus_define_composite_layup(model, part, mat, [0,90,0,90], 0.125)",
					pitfall: "复合/层合板默认走壳（避免实体叠层）；梁截面需 beam 轮廓。"
				}
			},
			{
				n: "5",
				goal: "网格",
				tools: ["abaqus_generate_mesh"],
				note: "solid→C3D8R/C3D4R；shell→S4R；可设 seed 尺寸。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "size=全局种子尺寸（省略则 = 包围盒对角线/10）；elemShape=hex|tet。",
					example: "abaqus_generate_mesh(model, part, size=5)",
					pitfall: "seed 太大→单元过少；太小→单元爆炸。网格施加在装配 instance 上。"
				}
			},
			{
				n: "6",
				goal: "分析步",
				tools: ["abaqus_define_step"],
				note: "static / dynamic / modal / heat / coupled；热/耦合步需给 deltmx；非耦合步序列要合法。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "timePeriod, initialIncrement, maxIncrements, nlgeom=ON(大变形), numEigen(modal), maxTempChange(热/耦合)。",
					example: "abaqus_define_step(model, name=\"Load\", type=\"static\", nlgeom=true)",
					pitfall: "大变形记得 nlgeom=true；modal 设 numEigen。"
				}
			},
			{
				n: "7",
				goal: "载荷 / 边界",
				tools: [
					"abaqus_apply_load",
					"abaqus_set_bc",
					"abaqus_define_amplitude",
					"abaqus_define_predefined_field"
				],
				note: "pressure/concentrated/gravity 载荷；encastre/pinned/displacement/symmetry 边界；时变用 amplitude 乘子。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "apply_load: pressure(Pa)/concentrated([Fx,Fy,Fz] N)/gravity(m/s²+方向)；set_bc: displacement 给 u1/u2/u3。",
					example: "abaqus_apply_load(model, type=\"pressure\", instance, region, magnitude=1.0)",
					pitfall: "载荷/边界需先建几何集合（faces/vertices），region 引用集合名。"
				}
			},
			{
				n: "8",
				goal: "接触 / 输出",
				tools: [
					"abaqus_create_interaction",
					"abaqus_set_friction",
					"abaqus_set_output"
				],
				note: "contact/tie 接触对 + 摩擦；控制要保存的场/历史输出。",
				section: "pre",
				kinds: "any",
				detail: {
					params: "interaction: kind=contact|tie, master/slave=\"instance:surfaceSet\", friction；set_output: FIELD(S,U,RF)/HISTORY。",
					example: "abaqus_create_interaction(model, \"contact\", \"A:surf\", \"B:surf\", friction=0.3)",
					pitfall: "master 应放在更粗/更刚的体上；接触别忘 set_friction。"
				}
			},
			{
				n: "9",
				goal: "求解",
				tools: [
					"abaqus_set_workdir",
					"abaqus_submit_job",
					"abaqus_monitor_job"
				],
				note: "submit 非阻塞；轮询 .sta/.lck 直至 COMPLETED。",
				section: "solve",
				kinds: "any",
				detail: {
					params: "set_workdir 指定求解目录；submit_job(jobName)；monitor_job 看 .sta/.msg 的 ERROR/WARNING。",
					example: "abaqus_set_workdir(path) → abaqus_submit_job(\"Job-1\") → abaqus_monitor_job(\"Job-1\")",
					pitfall: "求解耗时长，别阻塞等；靠 monitor 轮询，直到 COMPLETED 才后处理。"
				}
			},
			{
				n: "10",
				goal: "后处理",
				tools: [
					"abaqus_plot_contour",
					"abaqus_export_results_csv",
					"abaqus_inspect_odb",
					"abaqus_capture_viewport"
				],
				note: "先 plot 设视口→capture 截图；CSV 便于表格分析；inspect 看 ODB 结构。",
				section: "post",
				kinds: "any",
				detail: {
					params: "plot_contour: fieldVariable=S/U/RF..., invariant=Mises, component=U2/S11, frameIndex；export_results_csv: 到场变量+路径。",
					example: "abaqus_plot_contour(odbPath, fieldVariable=\"S\", invariant=\"Mises\") → abaqus_capture_viewport()",
					pitfall: "capture 前先 plot 定位视口；大 ODB 先 inspect 确认有哪些帧/变量。"
				}
			},
			{
				n: "11",
				goal: "兜底",
				tools: ["abaqus_run_python"],
				note: "上面都不够时用：在 Abaqus kernel 执行任意脚本。建议对其开启 ask/确认。",
				section: "post",
				kinds: "any",
				detail: {
					example: "abaqus_run_python(code=\"result = len(mdb.models)\")",
					pitfall: "能改任何状态，风险最高——生产会话里建议确认后再跑。"
				}
			}
		];
		/** 生成"整条建模链"的可复制 prompt 文本。 */
		function chainPrompt(steps = STEPS) {
			return `按 Abaqus 建模链依次调用工具：\n${steps.map((s) => `${s.n}. ${s.goal}：${s.tools.join(" / ")}`).join("\n")}`;
		}
		//#endregion
		//#region client/src/progress.ts
		/** Parse the progress file; returns null when absent/invalid (→ guide mode). */
		function parseProgress(text) {
			if (!text) return null;
			try {
				const j = JSON.parse(text);
				if (!j || !Array.isArray(j.steps)) return null;
				const steps = j.steps.filter((s) => s && typeof s.n !== "undefined").map((s) => ({
					n: String(s.n),
					status: [
						"pending",
						"active",
						"done",
						"error"
					].includes(s.status) ? s.status : "pending",
					...typeof s.at === "string" ? { at: s.at } : {},
					...typeof s.error === "string" ? { error: s.error } : {},
					...typeof s.detail === "string" ? { detail: s.detail } : {}
				}));
				return {
					...typeof j.sessionId === "string" ? { sessionId: j.sessionId } : {},
					...typeof j.updatedAt === "string" ? { updatedAt: j.updatedAt } : {},
					...typeof j.current === "string" ? { current: j.current } : {},
					steps
				};
			} catch {
				return null;
			}
		}
		/** Index a progress file by step number for O(1) lookup. */
		function nodeMap(f) {
			const m = /* @__PURE__ */ new Map();
			if (f) for (const s of f.steps) m.set(String(s.n), s);
			return m;
		}
		const PROGRESS_FILENAME = "cae-progress.json";
		//#endregion
		//#region client/src/sidebarApi.ts
		var SidebarApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.name = "SidebarApiError";
				this.code = code;
			}
		};
		async function call(method, payload, signal, base = "/sidebar/api") {
			let response;
			try {
				response = await fetch(`${base}/${method}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					signal
				});
			} catch (error) {
				throw new SidebarApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new SidebarApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		function scopePayload(scope, extra) {
			return {
				sessionId: scope.sessionId,
				...scope.cwd !== void 0 && scope.cwd !== "" ? { cwd: scope.cwd } : {},
				...scope.repoRoot !== void 0 && scope.repoRoot !== "" ? { repoRoot: scope.repoRoot } : {},
				...extra
			};
		}
		/** List a directory under the session workspace. Omit `path` to list the session cwd itself. */
		function fsTree(scope, path, signal) {
			return call("fs.tree", scopePayload(scope, path !== void 0 && path !== "" ? { path } : {}), signal);
		}
		/** Read a text file under the session workspace (workspace-relative `path`). */
		function fsRead(scope, path, signal) {
			return call("fs.read", scopePayload(scope, { path }), signal);
		}
		/** Query the Abaqus bridge for live session telemetry via the plugin route.
		*  Never throws for a bridge-offline condition — that is `{connected:false}`. */
		function caeTelemetry(signal) {
			return call("telemetry", {}, signal, "/cae/api");
		}
		/** Snapshot the live Abaqus session (per-model facets, jobs, cwd) via the plugin route. */
		function caeModelInfo(signal) {
			return call("modelinfo", {}, signal, "/cae/api");
		}
		//#endregion
		//#region client/src/icons.tsx
		function base(path, size = 14, extra) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				...extra,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: path })
			});
		}
		const IconCopy = ({ size }) => base("M5 3h8v9H5z M3 6H2v7h8v-1", size);
		const IconCheck = ({ size }) => base("M3 8.5l3.2 3.2L13 5", size);
		const IconChevron = ({ size }) => base("M5 3l5 5-5 5", size);
		const IconSearch = ({ size }) => base("M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M11 11l3.5 3.5", size);
		const IconRefresh = ({ size }) => base("M13.5 8a5.5 5.5 0 1 1-1.6-3.9 M13.5 2v3h-3", size);
		const IconFolder = ({ size }) => base("M2 4h4l1.5 1.5H14V13H2z", size);
		const IconX = ({ size }) => base("M4 4l8 8 M12 4l-8 8", size);
		//#endregion
		//#region client/src/WorkspaceStatus.tsx
		/**
		* Workspace status detector (feature ②): reads a directory under the session
		* workspace via BSB's fs.tree route and infers the Abaqus run state from the
		* files present — no backend change.
		*
		* Inference:
		*   *.lck               → 求解中（Abaqus job lock）
		*   *.odb (无 .lck)     → 有结果可后处理
		*   *.cae               → 已建模型
		*   *.jnl / *.rpy       → 建模脚本
		*   *.sta / .msg / .dat → 求解过程产物
		*
		* Constraint (host): only paths inside the session workspace are readable.
		* Default target = the session cwd; the user can point it at the Abaqus
		* workdir when that dir lives inside the workspace. Choice persists per session.
		*/
		function detect(entries) {
			const d = {
				cae: [],
				odb: [],
				lck: [],
				sta: [],
				msg: [],
				dat: [],
				script: []
			};
			for (const e of entries) {
				if (e.isDir) continue;
				const n = e.name.toLowerCase();
				if (n.endsWith(".cae")) d.cae.push(e.name);
				else if (n.endsWith(".odb")) d.odb.push(e.name);
				else if (n.endsWith(".lck")) d.lck.push(e.name);
				else if (n.endsWith(".sta")) d.sta.push(e.name);
				else if (n.endsWith(".msg")) d.msg.push(e.name);
				else if (n.endsWith(".dat")) d.dat.push(e.name);
				else if (n.endsWith(".jnl") || n.endsWith(".rpy")) d.script.push(e.name);
			}
			return d;
		}
		function phaseOf(d) {
			if (d.lck.length > 0) return "running";
			if (d.odb.length > 0) return "results";
			if (d.cae.length > 0) return "modeled";
			return "idle";
		}
		const PHASE_META = {
			running: {
				label: "求解中",
				color: "var(--cae-run)",
				soft: "var(--cae-run-soft)"
			},
			results: {
				label: "有结果",
				color: "var(--cae-ok)",
				soft: "var(--cae-ok-soft)"
			},
			modeled: {
				label: "已建模",
				color: "var(--cae-accent)",
				soft: "var(--cae-accent-soft)"
			},
			idle: {
				label: "未检测到产物",
				color: "var(--cae-faint)",
				soft: "var(--cae-inset)"
			}
		};
		const POLL_MS = 4e3;
		function WorkspaceStatus({ scope, visible }) {
			ensureCaeStyles();
			const storageKey = `cae:workdir:${scope.sessionId}`;
			const [target, setTarget] = (0, react.useState)(() => {
				try {
					return localStorage.getItem(storageKey) ?? "";
				} catch {
					return "";
				}
			});
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [resolved, setResolved] = (0, react.useState)(null);
			const [det, setDet] = (0, react.useState)(null);
			const [lastAt, setLastAt] = (0, react.useState)(null);
			const seq = (0, react.useRef)(0);
			const [tele, setTele] = (0, react.useState)(null);
			const [teleLoading, setTeleLoading] = (0, react.useState)(false);
			const teleSeq = (0, react.useRef)(0);
			const refreshTele = (0, react.useCallback)(async (signal) => {
				const my = ++teleSeq.current;
				setTeleLoading(true);
				try {
					const t = await caeTelemetry(signal);
					if (my !== teleSeq.current) return;
					setTele(t);
				} catch {
					if (my !== teleSeq.current) return;
					setTele(null);
				} finally {
					if (my === teleSeq.current) setTeleLoading(false);
				}
			}, []);
			const refresh = (0, react.useCallback)(async (signal) => {
				const my = ++seq.current;
				setLoading(true);
				setError(null);
				try {
					const res = await fsTree(scope, target, signal);
					if (my !== seq.current) return;
					setDet(detect(res.entries));
					setResolved(res.path);
					setLastAt(Date.now());
				} catch (e) {
					if (my !== seq.current) return;
					setDet(null);
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					if (my === seq.current) setLoading(false);
				}
			}, [scope, target]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const ctrl = new AbortController();
				refresh(ctrl.signal);
				const t = setInterval(() => void refresh(ctrl.signal), POLL_MS);
				return () => {
					ctrl.abort();
					clearInterval(t);
				};
			}, [visible, refresh]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const ctrl = new AbortController();
				refreshTele(ctrl.signal);
				const t = setInterval(() => void refreshTele(ctrl.signal), 5e3);
				return () => {
					ctrl.abort();
					clearInterval(t);
				};
			}, [visible, refreshTele]);
			const persist = (v) => {
				setTarget(v);
				try {
					localStorage.setItem(storageKey, v);
				} catch {}
			};
			const phase = det ? phaseOf(det) : null;
			const meta = phase ? PHASE_META[phase] : null;
			const showList = (0, react.useMemo)(() => {
				if (!det) return [];
				const rows = [];
				for (const n of det.cae) rows.push({
					name: n,
					tag: "模型"
				});
				for (const n of det.odb) rows.push({
					name: n,
					tag: "结果"
				});
				for (const n of det.sta) rows.push({
					name: n,
					tag: "状态"
				});
				for (const n of det.script) rows.push({
					name: n,
					tag: "脚本"
				});
				return rows.slice(0, 12);
			}, [det]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					border: "1px solid var(--cae-border)",
					borderRadius: "var(--cae-radius)",
					background: "var(--cae-card)",
					boxShadow: "var(--cae-shadow)",
					padding: "10px 12px",
					marginBottom: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 8
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									color: "var(--cae-muted)",
									display: "inline-flex"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolder, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontWeight: 700,
									fontSize: 12
								},
								children: "工作目录侦测"
							}),
							meta && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									marginLeft: "auto",
									fontSize: 11,
									fontWeight: 600,
									color: meta.color,
									background: meta.soft,
									padding: "1px 8px",
									borderRadius: 999
								},
								children: meta.label
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "6px 8px",
							marginBottom: 8,
							borderRadius: "var(--cae-radius-sm)",
							border: "1px solid var(--cae-border)",
							background: tele?.connected ? "var(--cae-ok-soft)" : "var(--cae-inset)",
							fontSize: 11
						},
						children: teleLoading && tele === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { color: "var(--cae-muted)" },
							children: "桥接状态检测中…"
						}) : tele?.connected ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
								width: 7,
								height: 7,
								borderRadius: 999,
								background: "var(--cae-ok)",
								flexShrink: 0,
								display: "inline-block"
							} }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									color: "var(--cae-ok)",
									fontWeight: 700,
									flexShrink: 0
								},
								children: "Abaqus 桥接已连接"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									color: "var(--cae-muted)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontFamily: "var(--cae-mono)"
								},
								title: tele.cwd ?? "",
								children: tele.cwd ?? ""
							}),
							tele.models && tele.models.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									color: "var(--cae-faint)",
									flexShrink: 0
								},
								children: [
									"· ",
									tele.models.length,
									" 模型"
								]
							}),
							tele && tele.cwd && tele.cwd !== "" && tele.cwd !== target && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => persist(tele.cwd),
								title: "把侦测目标设为桥接报告的工作目录",
								style: {
									marginLeft: "auto",
									flexShrink: 0,
									fontSize: 10.5,
									padding: "2px 8px",
									borderRadius: 999,
									border: "1px solid var(--cae-ok)",
									background: "var(--cae-card)",
									color: "var(--cae-ok)",
									cursor: "pointer"
								},
								children: "用作侦测路径"
							})
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
								width: 7,
								height: 7,
								borderRadius: 999,
								background: "var(--cae-err)",
								flexShrink: 0,
								display: "inline-block"
							} }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									color: "var(--cae-err)",
									fontWeight: 700,
									flexShrink: 0
								},
								children: "Abaqus 桥接离线"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									color: "var(--cae-muted)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								},
								title: tele?.error,
								children: "未连到 CAE 内核，正在按文件推断"
							})
						] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 6,
							marginBottom: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							value: target,
							onChange: (e) => persist(e.target.value),
							placeholder: "留空 = 会话工作目录；或填 workspace 内的 Abaqus workdir 子路径"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => void refresh(),
							title: "刷新",
							style: {
								flexShrink: 0,
								display: "inline-flex",
								alignItems: "center",
								gap: 4,
								padding: "4px 10px",
								border: "1px solid var(--cae-border)",
								borderRadius: "var(--cae-radius-sm)",
								background: loading ? "var(--cae-inset)" : "var(--cae-card)",
								color: "var(--cae-fg)",
								fontSize: 12
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									display: "inline-flex",
									animation: loading ? "none" : "none"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, { size: 13 })
							}), loading ? "…" : "刷新"]
						})]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: 11,
							color: "var(--cae-err)",
							background: "var(--cae-err-soft)",
							borderRadius: "var(--cae-radius-sm)",
							padding: "6px 8px"
						},
						children: [
							"读取失败：",
							error,
							"（路径需在 session workspace 内）"
						]
					}) : det === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 11,
							color: "var(--cae-muted)"
						},
						children: visible ? "读取中…" : "（标签页未激活，暂停侦测）"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								fontSize: 11,
								color: "var(--cae-muted)",
								marginBottom: 6,
								wordBreak: "break-all"
							},
							children: [resolved ?? "", lastAt !== null && ` · ${new Date(lastAt).toLocaleTimeString()}`]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: "3px 12px",
								fontSize: 11,
								marginBottom: det.cae.length + det.odb.length > 0 ? 6 : 0
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									style: { color: "var(--cae-accent)" },
									children: det.cae.length
								}), " 模型"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									style: { color: "var(--cae-ok)" },
									children: det.odb.length
								}), " 结果"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									style: { color: det.lck.length ? "var(--cae-run)" : "var(--cae-faint)" },
									children: det.lck.length
								}), " 进行中"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									style: { color: "var(--cae-muted)" },
									children: det.script.length
								}), " 脚本"] })
							]
						}),
						showList.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontFamily: "var(--cae-mono)",
								fontSize: 10.5,
								color: "var(--cae-muted)"
							},
							children: showList.map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 6,
									padding: "1px 0"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										color: "var(--cae-faint)",
										flexShrink: 0
									},
									children: [
										"[",
										r.tag,
										"]"
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap"
									},
									children: r.name
								})]
							}, r.tag + r.name))
						})
					] })
				]
			});
		}
		//#endregion
		//#region client/src/copy.ts
		/** Copy-to-clipboard with a legacy fallback for non-secure contexts. */
		async function copyText(text) {
			try {
				if (navigator.clipboard && window.isSecureContext !== false) {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch {}
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.focus();
				ta.select();
				const ok = document.execCommand("copy");
				ta.remove();
				return ok;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region client/src/WorkflowView.tsx
		/**
		* Abaqus 工作流 tab — 实时进度步进器（Mac 风格状态灯）。
		*
		* 两种模式：
		*   - 实时模式：会话工作目录里存在 `cae-progress.json`（agent 每跑一步就写）时，
		*     轮询它并渲染 Mac 风格步进器 —— 待办灰灯 / 进行中蓝灯脉冲 + 卡片高亮 /
		*     完成绿✓ / 出错红✕ + 卡片内联错误详情（"问题出在哪"）。
		*   - 参考模式：无进度文件时退化为可交互指南（手动点状态灯标记完成 + 搜索 +
		*     类型过滤 + 可展开的参数/示例/常见坑）。
		*
		* 零后端改动：进度文件是约定，agent 用任意文件工具写它即可（见 progress.ts）。
		*/
		function loadSet(key) {
			try {
				const raw = localStorage.getItem(key);
				if (!raw) return /* @__PURE__ */ new Set();
				const arr = JSON.parse(raw);
				return new Set(Array.isArray(arr) ? arr.map(String) : []);
			} catch {
				return /* @__PURE__ */ new Set();
			}
		}
		function saveSet(key, s) {
			try {
				localStorage.setItem(key, JSON.stringify([...s]));
			} catch {}
		}
		const card = {
			border: "1px solid var(--cae-border)",
			borderRadius: "var(--cae-radius)",
			background: "var(--cae-card)",
			boxShadow: "var(--cae-shadow)"
		};
		const chipBase = {
			fontSize: 11,
			padding: "2px 9px",
			borderRadius: 999,
			border: "1px solid var(--cae-border)",
			background: "var(--cae-card)",
			color: "var(--cae-muted)",
			cursor: "pointer"
		};
		function realStateOf(step, info) {
			if (!info || !info.connected) return null;
			const models = info.models ?? {};
			const names = Object.keys(models);
			const multi = names.length > 1;
			const facet = (pick) => {
				const seen = /* @__PURE__ */ new Set();
				const out = [];
				for (const m of names) for (const item of pick(models[m]) ?? []) {
					if (seen.has(item)) continue;
					seen.add(item);
					out.push(multi ? `${m}/${item}` : item);
				}
				return out;
			};
			const allSteps = facet((m) => m.steps);
			switch (step.n) {
				case "1": return names.length ? {
					label: "当前 CAE 会话的模型",
					items: names.map((m) => multi ? m : m)
				} : null;
				case "2": return joinReal("几何对象", [...facet((m) => m.parts), ...facet((m) => m.instances)]);
				case "3": return joinReal("已定义材料", facet((m) => m.materials));
				case "4": return joinReal("已定义截面", facet((m) => m.sections));
				case "5": return joinReal("网格对象（装配实例）", [...facet((m) => m.instances), ...facet((m) => m.parts)]);
				case "6": return joinReal("已建分析步", allSteps);
				case "7": return joinReal("载荷 / 边界 / 幅值", [
					...facet((m) => m.loads),
					...facet((m) => m.bc),
					...facet((m) => m.amplitudes)
				]);
				case "8": return joinReal("接触 / 约束", [...facet((m) => m.interactions), ...facet((m) => m.constraints)]);
				case "9": {
					const jobs = info.jobs ?? [];
					return jobs.length ? {
						label: "作业（实时状态）",
						items: jobs.map((j) => `${j.name}${j.status ? ` · ${j.status}` : ""}`)
					} : null;
				}
				case "10": return joinReal("可后处理的结果", [...(info.jobs ?? []).filter((j) => /completed|finished|done/i.test(j.status ?? "")).map((j) => j.name), ...names.length ? [`模型 ${names.length} 个`] : []]);
				case "11": return joinReal("会话环境", [info.cwd ?? "", ...names.length ? [`模型 ${names.length} 个`] : []]);
				default: return null;
			}
		}
		function joinReal(label, items) {
			return items.length ? {
				label,
				items
			} : null;
		}
		function ToolChip({ tool }) {
			const [copied, setCopied] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				onClick: () => {
					copyText(tool).then((ok) => {
						if (ok) {
							setCopied(true);
							setTimeout(() => setCopied(false), 1200);
						}
					});
				},
				title: `复制 ${tool}`,
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					fontFamily: "var(--cae-mono)",
					fontSize: 11,
					padding: "2px 6px",
					borderRadius: "var(--cae-radius-sm)",
					border: "1px solid var(--cae-border)",
					background: copied ? "var(--cae-ok-soft)" : "var(--cae-inset)",
					color: copied ? "var(--cae-ok)" : "var(--cae-fg)",
					cursor: "pointer"
				},
				children: [tool, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						display: "inline-flex",
						opacity: .7
					},
					children: copied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 11 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCopy, { size: 11 })
				})]
			});
		}
		/** Mac-style status dot. Live: shows authoritative status. Manual: click to toggle done. */
		function StatusDot({ status, onClick, title }) {
			const cls = status === "done" ? "cae-dot cae-dot-done" : status === "error" ? "cae-dot cae-dot-error" : status === "active" ? "cae-dot cae-dot-active" : "cae-dot";
			const inner = status === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 9 }) : status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconX, { size: 9 }) : null;
			if (onClick) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				onClick,
				title,
				className: cls,
				style: {
					cursor: "pointer",
					padding: 0
				},
				children: inner
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: cls,
				title,
				children: inner
			});
		}
		function StepCard({ step, status, live, error, errorDetail, real, dimmed, open, isLast, onToggleDone, onToggleOpen }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "cae-step",
				style: {
					opacity: dimmed ? .45 : 1,
					transition: "opacity 0.15s"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "cae-rail",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
						status,
						onClick: live ? void 0 : onToggleDone,
						title: live ? status === "active" ? "进行中" : status === "done" ? "已完成" : status === "error" ? "出错" : "待办" : status === "done" ? "已完成（点击取消）" : "标记此步已完成"
					}), !isLast && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "cae-line" })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `cae-card ${live ? status === "active" ? "cae-card-active" : status === "error" ? "cae-card-error" : status === "done" ? "cae-card-done" : "" : status === "done" ? "cae-card-done" : ""}`,
					style: {
						...card,
						flex: 1,
						minWidth: 0,
						padding: "8px 10px",
						marginBottom: 8
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "flex-start",
							gap: 8
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									flexShrink: 0,
									minWidth: 20,
									height: 20,
									borderRadius: 999,
									background: status === "done" ? "var(--cae-ok)" : "var(--cae-accent-soft)",
									color: status === "done" ? "#fff" : "var(--cae-accent)",
									fontSize: 11,
									fontWeight: 700,
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center"
								},
								children: step.n
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									flex: 1,
									minWidth: 0
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: 6
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontWeight: 600,
													fontSize: 13,
													textDecoration: status === "done" && !live ? "line-through" : "none",
													color: status === "done" && !live ? "var(--cae-muted)" : "var(--cae-fg)"
												},
												children: step.goal
											}),
											live && status === "active" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: 10,
													fontWeight: 700,
													color: "var(--cae-accent)",
													background: "var(--cae-accent-soft)",
													padding: "0 6px",
													borderRadius: 999
												},
												children: "进行中"
											}),
											step.kinds !== "any" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: 10,
													color: "var(--cae-faint)",
													flexShrink: 0
												},
												children: step.kinds.map((k) => KIND_LABEL[k]).join("/")
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											display: "flex",
											flexWrap: "wrap",
											gap: 4,
											margin: "5px 0"
										},
										children: step.tools.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolChip, { tool: t }, t))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 11.5,
											color: "var(--cae-muted)"
										},
										children: step.note
									}),
									real && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											marginTop: 6,
											padding: "6px 8px",
											borderRadius: "var(--cae-radius-sm)",
											border: "1px dashed color-mix(in srgb, var(--cae-accent) 45%, transparent)",
											background: "color-mix(in srgb, var(--cae-accent-soft) 55%, transparent)",
											fontSize: 11
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												fontWeight: 700,
												color: "var(--cae-accent)",
												marginBottom: 3,
												display: "flex",
												alignItems: "center",
												gap: 4
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
												width: 5,
												height: 5,
												borderRadius: 999,
												background: "var(--cae-accent)",
												display: "inline-block"
											} }), real.label]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												flexWrap: "wrap",
												gap: "2px 12px",
												color: "var(--cae-fg)"
											},
											children: [real.items.map((it, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontFamily: "var(--cae-mono)",
													fontSize: 10.5,
													color: "var(--cae-muted)",
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
													maxWidth: 220
												},
												children: it
											}, i)), real.items.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													color: "var(--cae-faint)",
													fontSize: 10.5
												},
												children: "（无）"
											})]
										})]
									}),
									status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											marginTop: 8,
											padding: "8px 10px",
											background: "var(--cae-err-soft)",
											border: "1px solid color-mix(in srgb, var(--cae-err) 40%, transparent)",
											borderRadius: "var(--cae-radius-sm)",
											fontSize: 11.5
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: 5,
												fontWeight: 700,
												color: "var(--cae-err)"
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconX, { size: 12 }), error ?? "此步骤出错"]
										}), errorDetail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: {
												marginTop: 4,
												color: "var(--cae-muted)",
												whiteSpace: "pre-wrap"
											},
											children: errorDetail
										})]
									}),
									open && step.detail && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											marginTop: 8,
											padding: "8px 10px",
											background: "var(--cae-inset)",
											borderRadius: "var(--cae-radius-sm)",
											fontSize: 11.5,
											display: "grid",
											gap: 6
										},
										children: [
											step.detail.params && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontWeight: 600,
													color: "var(--cae-fg)",
													marginBottom: 2
												},
												children: "常用参数"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontFamily: "var(--cae-mono)",
													fontSize: 11,
													color: "var(--cae-muted)",
													whiteSpace: "pre-wrap"
												},
												children: step.detail.params
											})] }),
											step.detail.example && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontWeight: 600,
													color: "var(--cae-fg)",
													marginBottom: 2
												},
												children: "示例"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontFamily: "var(--cae-mono)",
													fontSize: 11,
													color: "var(--cae-accent)",
													whiteSpace: "pre-wrap"
												},
												children: step.detail.example
											})] }),
											step.detail.pitfall && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: {
													fontWeight: 600,
													color: "var(--cae-warn)",
													marginBottom: 2
												},
												children: "常见坑"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												style: { color: "var(--cae-muted)" },
												children: step.detail.pitfall
											})] })
										]
									})
								]
							}),
							step.detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: onToggleOpen,
								title: open ? "收起详情" : "展开详情",
								style: {
									flexShrink: 0,
									border: "none",
									background: "transparent",
									color: "var(--cae-faint)",
									display: "inline-flex",
									padding: 2,
									transform: open ? "rotate(90deg)" : "none",
									transition: "transform 0.15s"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { size: 14 })
							})
						]
					})
				})]
			});
		}
		function WorkflowView(props) {
			ensureCaeStyles();
			const { scope, visible } = props;
			const progressKey = `cae:progress:${scope.sessionId}`;
			const [progress, setProgress] = (0, react.useState)(null);
			const liveSeq = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!visible) return;
				let alive = true;
				const my = ++liveSeq.current;
				const ctrl = new AbortController();
				const tick = async () => {
					try {
						const res = await fsRead(scope, PROGRESS_FILENAME, ctrl.signal);
						if (!alive || my !== liveSeq.current) return;
						setProgress(res.kind === "text" ? parseProgress(res.content) : null);
					} catch {
						if (!alive || my !== liveSeq.current) return;
						setProgress(null);
					}
				};
				tick();
				const t = setInterval(tick, 1500);
				return () => {
					alive = false;
					ctrl.abort();
					clearInterval(t);
				};
			}, [scope, visible]);
			const live = progress !== null;
			const nodes = (0, react.useMemo)(() => nodeMap(progress), [progress]);
			const [info, setInfo] = (0, react.useState)(null);
			const infoSeq = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!visible) return;
				let alive = true;
				const my = ++infoSeq.current;
				const ctrl = new AbortController();
				const tick = async () => {
					try {
						const res = await caeModelInfo(ctrl.signal);
						if (!alive || my !== infoSeq.current) return;
						setInfo(res);
					} catch {
						if (!alive || my !== infoSeq.current) return;
						setInfo(null);
					}
				};
				tick();
				const t = setInterval(tick, 4e3);
				return () => {
					alive = false;
					ctrl.abort();
					clearInterval(t);
				};
			}, [visible]);
			const [done, setDone] = (0, react.useState)(() => loadSet(progressKey));
			const [query, setQuery] = (0, react.useState)("");
			const [kind, setKind] = (0, react.useState)("any");
			const [openSteps, setOpenSteps] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [collapsed, setCollapsed] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [copiedChain, setCopiedChain] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				setDone(loadSet(progressKey));
			}, [scope.sessionId]);
			const toggleDone = (0, react.useCallback)((n) => {
				setDone((prev) => {
					const next = new Set(prev);
					if (next.has(n)) next.delete(n);
					else next.add(n);
					saveSet(progressKey, next);
					return next;
				});
			}, [progressKey]);
			const toggleOpen = (0, react.useCallback)((n) => {
				setOpenSteps((prev) => {
					const next = new Set(prev);
					if (next.has(n)) next.delete(n);
					else next.add(n);
					return next;
				});
			}, []);
			const toggleSection = (0, react.useCallback)((k) => {
				setCollapsed((prev) => {
					const next = new Set(prev);
					if (next.has(k)) next.delete(k);
					else next.add(k);
					return next;
				});
			}, []);
			const matches = (0, react.useCallback)((s) => {
				if (!query) return true;
				const q = query.toLowerCase();
				return `${s.goal} ${s.tools.join(" ")} ${s.note}`.toLowerCase().includes(q);
			}, [query]);
			const dimmed = (0, react.useCallback)((s) => {
				if (kind === "any" || s.kinds === "any") return false;
				return !s.kinds.includes(kind);
			}, [kind]);
			const statusOf = (0, react.useCallback)((s) => {
				if (live) return nodes.get(s.n)?.status ?? "pending";
				return done.has(s.n) ? "done" : "pending";
			}, [
				live,
				nodes,
				done
			]);
			const visibleBySection = (0, react.useMemo)(() => {
				const map = {
					pre: [],
					solve: [],
					post: []
				};
				for (const s of STEPS) if (matches(s)) map[s.section].push(s);
				return map;
			}, [matches]);
			const doneCount = live ? STEPS.filter((s) => (nodes.get(s.n)?.status ?? "pending") === "done").length : done.size;
			const total = STEPS.length;
			const currentNode = live && progress.current ? nodes.get(progress.current) : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "cae-root",
				style: {
					padding: "12px 14px",
					fontSize: 12,
					maxWidth: 560,
					overflowY: "auto"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: { marginBottom: 10 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontWeight: 700,
									fontSize: 14
								},
								children: "dsh-cae-agent · Abaqus 工作流"
							}), live && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: 10,
									fontWeight: 700,
									color: "var(--cae-ok)",
									background: "var(--cae-ok-soft)",
									padding: "1px 8px",
									borderRadius: 999,
									display: "inline-flex",
									alignItems: "center",
									gap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
									width: 6,
									height: 6,
									borderRadius: 999,
									background: "var(--cae-ok)",
									display: "inline-block"
								} }), "实时进度"]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								color: "var(--cae-muted)",
								fontSize: 11,
								marginTop: 2,
								wordBreak: "break-all"
							},
							children: [
								"会话 ",
								scope.sessionId,
								" · ",
								live ? "跟随 agent 的 Abaqus 操作实时更新" : "按建模链调用对应工具"
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceStatus, {
						scope,
						visible
					}),
					live && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							...card,
							padding: "8px 12px",
							marginBottom: 12,
							display: "flex",
							alignItems: "center",
							gap: 8,
							fontSize: 11.5
						},
						children: [currentNode ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "cae-dot cae-dot-active",
							style: { marginTop: 0 }
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["正在执行：", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: ["步骤 ", progress.current] })] })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { color: "var(--cae-muted)" },
							children: "实时进度已连接（无进行中步骤）"
						}), progress.updatedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								marginLeft: "auto",
								color: "var(--cae-faint)"
							},
							children: new Date(progress.updatedAt).toLocaleTimeString()
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 8,
							marginBottom: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: { position: "relative" },
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									position: "absolute",
									left: 8,
									top: "50%",
									transform: "translateY(-50%)",
									color: "var(--cae-faint)",
									display: "inline-flex"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, { size: 13 })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: query,
								onChange: (e) => setQuery(e.target.value),
								placeholder: "搜索步骤 / 工具 / 备注…",
								style: { paddingLeft: 26 }
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: 6,
								alignItems: "center"
							},
							children: [[
								"any",
								"solid",
								"shell",
								"composite",
								"beam"
							].map((k) => {
								const active = kind === k;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => setKind(k),
									style: {
										...chipBase,
										background: active ? "var(--cae-accent)" : "var(--cae-card)",
										color: active ? "#fff" : "var(--cae-muted)",
										borderColor: active ? "var(--cae-accent)" : "var(--cae-border)",
										fontWeight: active ? 600 : 400
									},
									children: k === "any" ? "全部" : KIND_LABEL[k]
								}, k);
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								onClick: () => {
									copyText(chainPrompt()).then((ok) => {
										if (ok) {
											setCopiedChain(true);
											setTimeout(() => setCopiedChain(false), 1500);
										}
									});
								},
								title: "复制整条建模链作为 prompt",
								style: {
									...chipBase,
									marginLeft: "auto",
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
									color: copiedChain ? "var(--cae-ok)" : "var(--cae-accent)",
									borderColor: copiedChain ? "var(--cae-ok)" : "var(--cae-accent)",
									background: copiedChain ? "var(--cae-ok-soft)" : "var(--cae-accent-soft)"
								},
								children: [copiedChain ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 12 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCopy, { size: 12 }), copiedChain ? "已复制" : "复制建模链 prompt"]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: { marginBottom: 12 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								justifyContent: "space-between",
								fontSize: 11,
								color: "var(--cae-muted)",
								marginBottom: 4
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: live ? "实时进度" : "建模进度（点击状态灯标记）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								doneCount,
								"/",
								total
							] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								height: 6,
								borderRadius: 999,
								background: "var(--cae-inset)",
								overflow: "hidden"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
								height: "100%",
								width: `${Math.round(doneCount / total * 100)}%`,
								background: "var(--cae-ok)",
								transition: "width 0.2s"
							} })
						})]
					}),
					SECTIONS.map((sec) => {
						const steps = visibleBySection[sec.key];
						const isCollapsed = collapsed.has(sec.key);
						const secDone = steps.filter((s) => statusOf(s) === "done").length;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `cae-section ${isCollapsed ? "" : "cae-section-open"}`.trim(),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								onClick: () => toggleSection(sec.key),
								className: "cae-section-header",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "cae-section-chevron",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { size: 13 })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "cae-section-title",
										children: sec.title
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "cae-section-count",
										children: [
											secDone,
											"/",
											steps.length
										]
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "cae-section-body",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "cae-section-body-inner",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "cae-section-hint",
										children: sec.hint
									}), steps.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 11,
											color: "var(--cae-muted)",
											margin: "0 0 4px 2px"
										},
										children: "无匹配步骤"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: { marginLeft: 8 },
										children: steps.map((s, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: { ["--i"]: i },
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StepCard, {
												step: s,
												status: statusOf(s),
												live,
												error: nodes.get(s.n)?.error,
												errorDetail: nodes.get(s.n)?.detail,
												real: realStateOf(s, info),
												dimmed: dimmed(s),
												open: openSteps.has(s.n),
												isLast: i === steps.length - 1,
												onToggleDone: () => toggleDone(s.n),
												onToggleOpen: () => toggleOpen(s.n)
											})
										}, s.n))
									})]
								})
							})]
						}, sec.key);
					})
				]
			});
		}
		//#endregion
		//#region client/src/CsvGrid.tsx
		/**
		* Abaqus CSV viewer (feature ⑤) — an enhanced grid for result exports.
		*
		*   - RFC4180-ish parser (quoted fields, escaped quotes, CRLF)
		*   - 数值列自动检测（整列可解析为有限数）
		*   - 表头点击排序（数值/字符串分别比较，升降切换）
		*   - 列显示开关（勾选显隐列）
		*   - 分页（默认 50 行/页，替代旧的"只显示前 200 行"）
		*   - 选中数值列时渲染 inline SVG sparkline 趋势
		*   - 主题走 theme.ts CSS 变量
		*/
		/** Parse CSV text into rows (RFC4180-ish; enough for Abaqus result exports). */
		function parseCsv(text) {
			if (!text) return [];
			const rows = [];
			let row = [];
			let field = "";
			let inQuotes = false;
			for (let i = 0; i < text.length; i++) {
				const c = text[i];
				if (inQuotes) {
					if (c === "\"") {
						if (text[i + 1] === "\"") {
							field += "\"";
							i++;
						} else inQuotes = false;
					} else field += c;
				} else if (c === "\"") inQuotes = true;
				else if (c === ",") {
					row.push(field);
					field = "";
				} else if (c === "\n" || c === "\r") {
					if (c === "\r" && text[i + 1] === "\n") i++;
					row.push(field);
					field = "";
					if (row.some((x) => x !== "")) rows.push(row);
					row = [];
				} else field += c;
			}
			row.push(field);
			if (row.some((x) => x !== "")) rows.push(row);
			return rows;
		}
		function isNum(s) {
			if (s === "") return false;
			const n = Number(s);
			return Number.isFinite(n);
		}
		function Sparkline({ values, width = 240, height = 44 }) {
			if (values.length < 2) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					fontSize: 11,
					color: "var(--cae-muted)"
				},
				children: "数据点不足，无法绘制趋势"
			});
			const min = Math.min(...values);
			const max = Math.max(...values);
			const span = max - min || 1;
			const step = width / (values.length - 1);
			const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v - min) / span * (height - 4) - 2).toFixed(1)}`).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width,
				height,
				style: {
					display: "block",
					background: "var(--cae-inset)",
					borderRadius: "var(--cae-radius-sm)"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
						points: pts,
						fill: "none",
						stroke: "var(--cae-accent)",
						strokeWidth: 1.6
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: 4,
						y: 11,
						fontSize: 9,
						fill: "var(--cae-faint)",
						children: ["max ", max]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: 4,
						y: height - 3,
						fontSize: 9,
						fill: "var(--cae-faint)",
						children: ["min ", min]
					})
				]
			});
		}
		const PAGE_SIZE = 50;
		function CsvGrid({ content, path }) {
			ensureCaeStyles();
			const rows = (0, react.useMemo)(() => parseCsv(content ?? ""), [content]);
			const header = rows[0] ?? [];
			const body = (0, react.useMemo)(() => rows.slice(1), [rows]);
			const numeric = (0, react.useMemo)(() => header.map((_, ci) => body.length > 0 && body.every((r) => r[ci] === "" || isNum(r[ci]))), [header, body]);
			const [sortCol, setSortCol] = (0, react.useState)(null);
			const [sortDir, setSortDir] = (0, react.useState)("asc");
			const [hidden, setHidden] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [page, setPage] = (0, react.useState)(0);
			const [sparkCol, setSparkCol] = (0, react.useState)(null);
			const sorted = (0, react.useMemo)(() => {
				if (sortCol === null) return body;
				const isNumeric = numeric[sortCol];
				const copy = [...body];
				copy.sort((a, b) => {
					const av = a[sortCol] ?? "";
					const bv = b[sortCol] ?? "";
					let cmp;
					if (isNumeric) cmp = (Number(av) || 0) - (Number(bv) || 0);
					else cmp = av.localeCompare(bv);
					return sortDir === "asc" ? cmp : -cmp;
				});
				return copy;
			}, [
				body,
				sortCol,
				sortDir,
				numeric
			]);
			const visibleCols = (0, react.useMemo)(() => header.map((_, i) => i).filter((i) => !hidden.has(i)), [header, hidden]);
			const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
			const cur = Math.min(page, pageCount - 1);
			const pageRows = sorted.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);
			const sparkValues = (0, react.useMemo)(() => {
				if (sparkCol === null || !numeric[sparkCol]) return null;
				return sorted.map((r) => Number(r[sparkCol])).filter((n) => Number.isFinite(n));
			}, [
				sparkCol,
				sorted,
				numeric
			]);
			const toggleSort = (ci) => {
				if (sortCol === ci) setSortDir((d) => d === "asc" ? "desc" : "asc");
				else {
					setSortCol(ci);
					setSortDir("asc");
				}
				setPage(0);
			};
			const toggleCol = (ci) => {
				setHidden((prev) => {
					const next = new Set(prev);
					if (next.has(ci)) next.delete(ci);
					else next.add(ci);
					return next;
				});
			};
			const th = {
				border: "1px solid var(--cae-border)",
				padding: "4px 6px",
				textAlign: "left",
				fontWeight: 600,
				background: "var(--cae-inset)",
				cursor: "pointer",
				userSelect: "none",
				whiteSpace: "nowrap",
				position: "sticky",
				top: 0
			};
			const td = {
				border: "1px solid var(--cae-border)",
				padding: "3px 6px",
				whiteSpace: "nowrap"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "cae-root",
				style: {
					padding: "10px 12px",
					fontSize: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontWeight: 600,
							marginBottom: 4,
							wordBreak: "break-all"
						},
						children: path ?? "Abaqus CSV"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: 11,
							color: "var(--cae-muted)",
							marginBottom: 8
						},
						children: [
							body.length,
							" 行 · ",
							header.length,
							" 列",
							numeric.some(Boolean) && ` · ${numeric.filter(Boolean).length} 个数值列`
						]
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							color: "var(--cae-muted)",
							padding: "12px 0"
						},
						children: "空文件 / 无内容"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						header.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: "4px 10px",
								marginBottom: 8
							},
							children: header.map((h, ci) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
									fontSize: 11,
									color: hidden.has(ci) ? "var(--cae-faint)" : "var(--cae-fg)",
									cursor: "pointer"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: !hidden.has(ci),
										onChange: () => toggleCol(ci),
										style: { accentColor: "var(--cae-accent)" }
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { fontFamily: "var(--cae-mono)" },
										children: h || `col${ci}`
									}),
									numeric[ci] && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											color: "var(--cae-accent)",
											fontSize: 10
										},
										children: "#"
									})
								]
							}, ci))
						}),
						sparkCol !== null && sparkValues && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								border: "1px solid var(--cae-border)",
								borderRadius: "var(--cae-radius)",
								background: "var(--cae-card)",
								padding: "8px 10px",
								marginBottom: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: 6,
									marginBottom: 4,
									fontSize: 11
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { fontWeight: 600 },
									children: ["趋势：", header[sparkCol]]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => setSparkCol(null),
									style: {
										marginLeft: "auto",
										border: "none",
										background: "transparent",
										color: "var(--cae-faint)",
										fontSize: 11,
										cursor: "pointer"
									},
									children: "关闭"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Sparkline, { values: sparkValues })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								overflow: "auto",
								maxHeight: 420,
								border: "1px solid var(--cae-border)",
								borderRadius: "var(--cae-radius)"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
								style: {
									borderCollapse: "collapse",
									width: "100%",
									fontFamily: "var(--cae-mono)",
									fontSize: 11
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: visibleCols.map((ci) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									style: th,
									onClick: () => toggleSort(ci),
									title: "点击排序",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: {
											display: "inline-flex",
											alignItems: "center",
											gap: 3
										},
										children: [
											header[ci] || `col${ci}`,
											numeric[ci] && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												onClick: (e) => {
													e.stopPropagation();
													setSparkCol(sparkCol === ci ? null : ci);
												},
												title: "绘制该列趋势",
												style: {
													border: "none",
													background: "transparent",
													color: sparkCol === ci ? "var(--cae-accent)" : "var(--cae-faint)",
													cursor: "pointer",
													padding: 0,
													display: "inline-flex"
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { size: 10 })
											}),
											sortCol === ci && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													color: "var(--cae-accent)",
													fontSize: 10
												},
												children: sortDir === "asc" ? "▲" : "▼"
											})
										]
									})
								}, ci)) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: pageRows.map((r, ri) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: visibleCols.map((ci) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									style: {
										...td,
										color: numeric[ci] ? "var(--cae-accent)" : "var(--cae-fg)",
										textAlign: numeric[ci] ? "right" : "left"
									},
									children: r[ci]
								}, ci)) }, ri)) })]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginTop: 8,
								fontSize: 11,
								color: "var(--cae-muted)"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => setPage((p) => Math.max(0, p - 1)),
									disabled: cur === 0,
									style: {
										padding: "2px 10px",
										borderRadius: "var(--cae-radius-sm)",
										border: "1px solid var(--cae-border)",
										background: "var(--cae-card)",
										color: "var(--cae-fg)",
										opacity: cur === 0 ? .4 : 1,
										cursor: cur === 0 ? "default" : "pointer"
									},
									children: "‹ 上一页"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									"第 ",
									cur + 1,
									" / ",
									pageCount,
									" 页"
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
									disabled: cur >= pageCount - 1,
									style: {
										padding: "2px 10px",
										borderRadius: "var(--cae-radius-sm)",
										border: "1px solid var(--cae-border)",
										background: "var(--cae-card)",
										color: "var(--cae-fg)",
										opacity: cur >= pageCount - 1 ? .4 : 1,
										cursor: cur >= pageCount - 1 ? "default" : "pointer"
									},
									children: "下一页 ›"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { marginLeft: "auto" },
									children: [
										"共 ",
										sorted.length,
										" 行"
									]
								})
							]
						})
					] })
				]
			});
		}
		//#endregion
		//#region client/src/index.tsx
		const name = "dsh-cae-agent";
		const inject = ["betterSidebar"];
		function apply(ctx) {
			const betterSidebar = ctx.betterSidebar;
			if (betterSidebar === void 0) return;
			ensureCaeStyles();
			ctx.effect(() => betterSidebar.registerTab({
				id: "dsh-cae-agent:workflow",
				title: "Abaqus 工作流",
				order: 60,
				component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowView, { ...props })
			}), "dsh-cae-agent: workflow tab");
			ctx.effect(() => betterSidebar.registerFileViewer({
				id: "dsh-cae-agent:csv",
				title: "Abaqus CSV",
				exts: ["csv"],
				fetchStrategy: "fsRead",
				component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CsvGrid, {
					content: props.content,
					path: props.path
				})
			}), "dsh-cae-agent: csv viewer");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
