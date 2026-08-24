import type {} from 'dsh-better-sidebar' // trigger ctx.betterSidebar type merge
import type { Context } from '@deepseek-ai/cordis'
import type { TabComponentProps, FileViewerProps } from 'dsh-better-sidebar'
import { WorkflowView } from './WorkflowView.js'
import { CsvGrid } from './CsvGrid.js'
import { ensureCaeStyles } from './theme.js'

// Module name the DSH client-modules loader reads from module.exports.
const name = 'dsh-cae-agent'

// Follows the reference tab plugin @huanlin/dsh-plugin-better-sidebar-plugin-office:
// the better-sidebar client service is a REQUIRED inject, accessed as ctx.betterSidebar.
const inject = ['betterSidebar'] as const

function apply(ctx: Context) {
  const betterSidebar = ctx.betterSidebar
  // Defensive (inject guarantees it, but keep the guard like the reference plugin).
  if (betterSidebar === void 0) return
  // Inject the theme tokens up-front so any tab/viewer renders styled.
  ensureCaeStyles()
  // Sidebar tab: Abaqus modeling workflow + operation logic. The full
  // TabComponentProps rides through so the view gets scope + visible (for the
  // workspace detector's visible-gated polling) and ctx for future wiring.
  ctx.effect(
    () =>
      betterSidebar.registerTab({
        id: 'dsh-cae-agent:workflow',
        title: 'Abaqus 工作流',
        order: 60,
        component: (props: TabComponentProps) => <WorkflowView {...props} />,
      }),
    'dsh-cae-agent: workflow tab',
  )
  // CSV file viewer for Abaqus result exports (text via fsRead).
  ctx.effect(
    () =>
      betterSidebar.registerFileViewer({
        id: 'dsh-cae-agent:csv',
        title: 'Abaqus CSV',
        exts: ['csv'],
        fetchStrategy: 'fsRead',
        component: (props: FileViewerProps) => <CsvGrid content={props.content} path={props.path} />,
      }),
    'dsh-cae-agent: csv viewer',
  )
}

export { name, inject, apply }
