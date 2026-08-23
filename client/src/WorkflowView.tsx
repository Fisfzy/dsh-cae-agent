import type { TabComponentProps } from 'dsh-better-sidebar'

/** The session scope type as carried by a sidebar tab component. */
type SessionScope = TabComponentProps['scope']

/** One workflow step of the dsh-cae-agent (Abaqus/CAE) tool chain. */
interface Step {
  n: string
  goal: string
  tools: string
  note: string
}

const STEPS: Step[] = [
  { n: '1', goal: '拉起 Abaqus 会话', tools: 'abaqus_launch_cae', note: '幂等：bridge(48152) 已在监听则复用；否则拉起 CAE 并自动开 socket bridge。' },
  { n: '2', goal: '几何', tools: 'abaqus_create_part → abaqus_create_set → abaqus_instantiate', note: 'box/cylinder 基元建零件；选几何(按类型/坐标)；装配到 rootAssembly。' },
  { n: '3', goal: '材料', tools: 'abaqus_create_material（各向同性）/ abaqus_define_orthotropic_material（工程常数/正交/各向异性）', note: '单位 mm-t-s-N-MPa；动力学/重力需 density。' },
  { n: '4', goal: '截面', tools: 'abaqus_assign_section（solid/shell/beam）/ abaqus_define_composite_layup（壳复合铺层）', note: '复合/层合板用 CompositeShellSection+SectionLayer，默认 SHELL/S4R（避免实体叠层）。' },
  { n: '5', goal: '网格', tools: 'abaqus_generate_mesh（solid C3D8R/C3D4R · shell S4R，可设 seed）', note: '壳零件→S4R，实体→C3D8R。' },
  { n: '6', goal: '分析步', tools: 'abaqus_define_step（static / dynamic / modal / heat / coupled）', note: '热/耦合步需给 deltmx；一个模型内非耦合步序列要合法。' },
  { n: '7', goal: '载荷 / 边界', tools: 'abaqus_apply_load（pressure/concentrated/gravity）、abaqus_set_bc（encastre/pinned/displacement/symmetry）、abaqus_define_amplitude（时变）、abaqus_define_predefined_field（初始场）', note: '载荷需 Surface/Region(由集合自动转)；时变载荷用 amplitude 乘子。' },
  { n: '8', goal: '接触 / 输出', tools: 'abaqus_create_interaction（contact/tie）、abaqus_set_friction、abaqus_set_output（field/history）', note: '定义接触对与摩擦；控制要保存的场/历史结果。' },
  { n: '9', goal: '求解', tools: 'abaqus_set_workdir → abaqus_submit_job → abaqus_monitor_job', note: 'submit 非阻塞；轮询 .sta/.lck 直至 COMPLETED。' },
  { n: '10', goal: '后处理', tools: 'abaqus_plot_contour（视口云图）、abaqus_export_results_csv（ODB→CSV）、abaqus_inspect_odb、abaqus_capture_viewport', note: '先 plot 设视口→capture 截图；CSV 便于表格分析。' },
  { n: '11', goal: '兜底', tools: 'abaqus_run_python（任意 Abaqus Python）', note: '上面都不够时用：在 Abaqus kernel 执行任意脚本。建议对其开启 ask/确认。' },
]

export function WorkflowView({ scope }: { scope: SessionScope }) {
  return (
    <div style={{ padding: '10px 12px', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>dsh-cae-agent · Abaqus 工作流</div>
      <div style={{ opacity: 0.7, marginBottom: 10 }}>
        会话 {scope.sessionId} · 按建模链调用对应工具
      </div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {STEPS.map((s) => (
          <li key={s.n} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{s.goal}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.9 }}>{s.tools}</div>
            <div style={{ opacity: 0.7 }}>{s.note}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
