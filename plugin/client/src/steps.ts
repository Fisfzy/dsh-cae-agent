/**
 * The dsh-cae-agent (Abaqus/CAE) workflow data model.
 *
 * Pure data — no rendering. WorkflowView renders from this; keeping the chain
 * here means content edits never touch component code. Each step carries:
 *   - n / goal / tools / note      (the original guide text)
 *   - section                      (前处理 / 求解 / 后处理分组)
 *   - kinds                        (与哪些模型类型强相关，用于类型过滤高亮)
 *   - detail                       (params / example / pitfall，可展开的进阶信息)
 */

export type SectionKey = 'pre' | 'solve' | 'post'
export type ModelKind = 'solid' | 'shell' | 'composite' | 'beam'

export interface StepDetail {
  /** 常用参数速查（自由文本，monospace 渲染） */
  params?: string
  /** 一个可直接抄的调用示例 */
  example?: string
  /** 常见坑 / 注意事项 */
  pitfall?: string
}

export interface Step {
  n: string
  goal: string
  tools: string[]
  note: string
  section: SectionKey
  kinds: ModelKind[] | 'any'
  detail?: StepDetail
}

export const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  { key: 'pre', title: '前处理', hint: '建模 → 材料 → 截面 → 网格 → 步 → 载荷/边界 → 接触/输出' },
  { key: 'solve', title: '求解', hint: '提交作业并轮询直至完成' },
  { key: 'post', title: '后处理与兜底', hint: '云图 / 导出 CSV / 任意 Python' },
]

export const KIND_LABEL: Record<ModelKind, string> = {
  solid: '实体',
  shell: '壳',
  composite: '复合',
  beam: '梁',
}

export const STEPS: Step[] = [
  {
    n: '1',
    goal: '拉起 Abaqus 会话',
    tools: ['abaqus_launch_cae'],
    note: '幂等：bridge(48152) 已在监听则复用；否则拉起 CAE 并自动开 socket bridge。',
    section: 'pre',
    kinds: 'any',
    detail: {
      example: 'abaqus_launch_cae()',
      pitfall: '首次拉起 CAE 较慢（数十秒）；bridge 已存在时直接复用，不要重复拉起。',
    },
  },
  {
    n: '2',
    goal: '几何',
    tools: ['abaqus_create_part', 'abaqus_create_set', 'abaqus_instantiate'],
    note: 'box/cylinder 基元建零件；选几何(按类型/坐标)；装配到 rootAssembly。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'create_part: primitive=box(boxX/boxY/boxZ) 或 cylinder(radius/height, axis)；create_set: region=cells|faces|edges|vertices + indices 或 {points:[[x,y,z]]}。',
      example: 'abaqus_create_part(model, name, boxX=50, boxY=50, boxZ=10) → abaqus_instantiate(model)',
      pitfall: '任意形状先用 abaqus_run_python 走 sketch；基元只能建 box/cylinder。',
    },
  },
  {
    n: '3',
    goal: '材料',
    tools: ['abaqus_create_material', 'abaqus_define_orthotropic_material'],
    note: '各向同性用 create_material；正交/各向异性用 define_orthotropic_material。单位 mm-t-s-N-MPa；动力学/重力需 density。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'props: {"elastic":{"E":210000,"nu":0.3},"density":{"density":7.85e-9}}；正交：table=[[E1,E2,E3,nu12,nu13,nu23,G12,G13,G23]]。',
      example: 'abaqus_create_material(model,"Steel",{"elastic":{"E":210000,"nu":0.3},"density":{"density":7.85e-9}})',
      pitfall: '忘记 density 会让 dynamic/gravity 步报错；单位制要统一（mm-tonne-s）。',
    },
  },
  {
    n: '4',
    goal: '截面',
    tools: ['abaqus_assign_section', 'abaqus_define_composite_layup'],
    note: 'solid/shell/beam 用 assign_section；复合铺层用 define_composite_layup（CompositeShellSection+SectionLayer，默认 SHELL/S4R）。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'assign_section: sectionType=solid|shell|beam（shell 需 thickness）；composite: plyAngles=[0,90,...], plyThickness。',
      example: 'abaqus_define_composite_layup(model, part, mat, [0,90,0,90], 0.125)',
      pitfall: '复合/层合板默认走壳（避免实体叠层）；梁截面需 beam 轮廓。',
    },
  },
  {
    n: '5',
    goal: '网格',
    tools: ['abaqus_generate_mesh'],
    note: 'solid→C3D8R/C3D4R；shell→S4R；可设 seed 尺寸。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'size=全局种子尺寸（省略则 = 包围盒对角线/10）；elemShape=hex|tet。',
      example: 'abaqus_generate_mesh(model, part, size=5)',
      pitfall: 'seed 太大→单元过少；太小→单元爆炸。网格施加在装配 instance 上。',
    },
  },
  {
    n: '6',
    goal: '分析步',
    tools: ['abaqus_define_step'],
    note: 'static / dynamic / modal / heat / coupled；热/耦合步需给 deltmx；非耦合步序列要合法。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'timePeriod, initialIncrement, maxIncrements, nlgeom=ON(大变形), numEigen(modal), maxTempChange(热/耦合)。',
      example: 'abaqus_define_step(model, name="Load", type="static", nlgeom=true)',
      pitfall: '大变形记得 nlgeom=true；modal 设 numEigen。',
    },
  },
  {
    n: '7',
    goal: '载荷 / 边界',
    tools: ['abaqus_apply_load', 'abaqus_set_bc', 'abaqus_define_amplitude', 'abaqus_define_predefined_field'],
    note: 'pressure/concentrated/gravity 载荷；encastre/pinned/displacement/symmetry 边界；时变用 amplitude 乘子。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'apply_load: pressure(Pa)/concentrated([Fx,Fy,Fz] N)/gravity(m/s²+方向)；set_bc: displacement 给 u1/u2/u3。',
      example: 'abaqus_apply_load(model, type="pressure", instance, region, magnitude=1.0)',
      pitfall: '载荷/边界需先建几何集合（faces/vertices），region 引用集合名。',
    },
  },
  {
    n: '8',
    goal: '接触 / 输出',
    tools: ['abaqus_create_interaction', 'abaqus_set_friction', 'abaqus_set_output'],
    note: 'contact/tie 接触对 + 摩擦；控制要保存的场/历史输出。',
    section: 'pre',
    kinds: 'any',
    detail: {
      params: 'interaction: kind=contact|tie, master/slave="instance:surfaceSet", friction；set_output: FIELD(S,U,RF)/HISTORY。',
      example: 'abaqus_create_interaction(model, "contact", "A:surf", "B:surf", friction=0.3)',
      pitfall: 'master 应放在更粗/更刚的体上；接触别忘 set_friction。',
    },
  },
  {
    n: '9',
    goal: '求解',
    tools: ['abaqus_set_workdir', 'abaqus_submit_job', 'abaqus_monitor_job'],
    note: 'submit 非阻塞；轮询 .sta/.lck 直至 COMPLETED。',
    section: 'solve',
    kinds: 'any',
    detail: {
      params: 'set_workdir 指定求解目录；submit_job(jobName)；monitor_job 看 .sta/.msg 的 ERROR/WARNING。',
      example: 'abaqus_set_workdir(path) → abaqus_submit_job("Job-1") → abaqus_monitor_job("Job-1")',
      pitfall: '求解耗时长，别阻塞等；靠 monitor 轮询，直到 COMPLETED 才后处理。',
    },
  },
  {
    n: '10',
    goal: '后处理',
    tools: ['abaqus_plot_contour', 'abaqus_export_results_csv', 'abaqus_inspect_odb', 'abaqus_capture_viewport'],
    note: '先 plot 设视口→capture 截图；CSV 便于表格分析；inspect 看 ODB 结构。',
    section: 'post',
    kinds: 'any',
    detail: {
      params: 'plot_contour: fieldVariable=S/U/RF..., invariant=Mises, component=U2/S11, frameIndex；export_results_csv: 到场变量+路径。',
      example: 'abaqus_plot_contour(odbPath, fieldVariable="S", invariant="Mises") → abaqus_capture_viewport()',
      pitfall: 'capture 前先 plot 定位视口；大 ODB 先 inspect 确认有哪些帧/变量。',
    },
  },
  {
    n: '11',
    goal: '兜底',
    tools: ['abaqus_run_python'],
    note: '上面都不够时用：在 Abaqus kernel 执行任意脚本。建议对其开启 ask/确认。',
    section: 'post',
    kinds: 'any',
    detail: {
      example: 'abaqus_run_python(code="result = len(mdb.models)")',
      pitfall: '能改任何状态，风险最高——生产会话里建议确认后再跑。',
    },
  },
]

/** 生成"整条建模链"的可复制 prompt 文本。 */
export function chainPrompt(steps: Step[] = STEPS): string {
  const lines = steps.map((s) => `${s.n}. ${s.goal}：${s.tools.join(' / ')}`)
  return `按 Abaqus 建模链依次调用工具：\n${lines.join('\n')}`
}
