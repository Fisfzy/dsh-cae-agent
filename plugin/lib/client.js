window.__ModuleLoader__.load({
	id: "dsh-cae-agent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region client/src/WorkflowView.tsx
		const STEPS = [
			{
				n: "1",
				goal: "拉起 Abaqus 会话",
				tools: "abaqus_launch_cae",
				note: "幂等：bridge(48152) 已在监听则复用；否则拉起 CAE 并自动开 socket bridge。"
			},
			{
				n: "2",
				goal: "几何",
				tools: "abaqus_create_part → abaqus_create_set → abaqus_instantiate",
				note: "box/cylinder 基元建零件；选几何(按类型/坐标)；装配到 rootAssembly。"
			},
			{
				n: "3",
				goal: "材料",
				tools: "abaqus_create_material（各向同性）/ abaqus_define_orthotropic_material（工程常数/正交/各向异性）",
				note: "单位 mm-t-s-N-MPa；动力学/重力需 density。"
			},
			{
				n: "4",
				goal: "截面",
				tools: "abaqus_assign_section（solid/shell/beam）/ abaqus_define_composite_layup（壳复合铺层）",
				note: "复合/层合板用 CompositeShellSection+SectionLayer，默认 SHELL/S4R（避免实体叠层）。"
			},
			{
				n: "5",
				goal: "网格",
				tools: "abaqus_generate_mesh（solid C3D8R/C3D4R · shell S4R，可设 seed）",
				note: "壳零件→S4R，实体→C3D8R。"
			},
			{
				n: "6",
				goal: "分析步",
				tools: "abaqus_define_step（static / dynamic / modal / heat / coupled）",
				note: "热/耦合步需给 deltmx；一个模型内非耦合步序列要合法。"
			},
			{
				n: "7",
				goal: "载荷 / 边界",
				tools: "abaqus_apply_load（pressure/concentrated/gravity）、abaqus_set_bc（encastre/pinned/displacement/symmetry）、abaqus_define_amplitude（时变）、abaqus_define_predefined_field（初始场）",
				note: "载荷需 Surface/Region(由集合自动转)；时变载荷用 amplitude 乘子。"
			},
			{
				n: "8",
				goal: "接触 / 输出",
				tools: "abaqus_create_interaction（contact/tie）、abaqus_set_friction、abaqus_set_output（field/history）",
				note: "定义接触对与摩擦；控制要保存的场/历史结果。"
			},
			{
				n: "9",
				goal: "求解",
				tools: "abaqus_set_workdir → abaqus_submit_job → abaqus_monitor_job",
				note: "submit 非阻塞；轮询 .sta/.lck 直至 COMPLETED。"
			},
			{
				n: "10",
				goal: "后处理",
				tools: "abaqus_plot_contour（视口云图）、abaqus_export_results_csv（ODB→CSV）、abaqus_inspect_odb、abaqus_capture_viewport",
				note: "先 plot 设视口→capture 截图；CSV 便于表格分析。"
			},
			{
				n: "11",
				goal: "兜底",
				tools: "abaqus_run_python（任意 Abaqus Python）",
				note: "上面都不够时用：在 Abaqus kernel 执行任意脚本。建议对其开启 ask/确认。"
			}
		];
		function WorkflowView({ scope }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "10px 12px",
					fontFamily: "inherit",
					fontSize: 12,
					lineHeight: 1.5
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontWeight: 700,
							marginBottom: 2
						},
						children: "dsh-cae-agent · Abaqus 工作流"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							opacity: .7,
							marginBottom: 10
						},
						children: [
							"会话 ",
							scope.sessionId,
							" · 按建模链调用对应工具"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
						style: {
							margin: 0,
							paddingLeft: 18
						},
						children: STEPS.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							style: { marginBottom: 8 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: { fontWeight: 600 },
									children: s.goal
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontFamily: "monospace",
										fontSize: 11,
										opacity: .9
									},
									children: s.tools
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: { opacity: .7 },
									children: s.note
								})
							]
						}, s.n))
					})
				]
			});
		}
		//#endregion
		//#region client/src/CsvGrid.tsx
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
		/** A minimal CSV grid viewer, following the FileViewer custom/fsRead contract. */
		function CsvGrid({ content, path }) {
			const rows = parseCsv(content ?? "");
			const header = rows[0] ?? [];
			const body = rows.slice(1);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: "8px 10px",
					fontFamily: "monospace",
					fontSize: 11
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontWeight: 600,
							marginBottom: 6
						},
						children: path ?? "Abaqus CSV"
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { opacity: .6 },
						children: "空文件 / 无内容"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						style: {
							borderCollapse: "collapse",
							width: "100%"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: header.map((h, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
							style: {
								border: "1px solid #8884",
								padding: "2px 4px",
								textAlign: "left"
							},
							children: h
						}, i)) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: body.slice(0, 200).map((r, ri) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: r.map((c, ci) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
							style: {
								border: "1px solid #8883",
								padding: "2px 4px"
							},
							children: c
						}, ci)) }, ri)) })]
					}),
					body.length > 200 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							opacity: .6,
							marginTop: 4
						},
						children: [
							"… 仅显示前 200 行（共 ",
							body.length,
							" 行）"
						]
					})
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
			ctx.effect(() => betterSidebar.registerTab({
				id: "dsh-cae-agent:workflow",
				title: "Abaqus 工作流",
				order: 60,
				component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkflowView, { scope: props.scope })
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
