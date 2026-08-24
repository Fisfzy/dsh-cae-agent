import type {} from 'dsh-better-sidebar' // trigger ctx.betterSidebar type merge
import type { Context } from '@deepseek-ai/cordis'
import type { BetterSidebarService, TabComponentProps, FileViewerProps } from 'dsh-better-sidebar'
import { WorkflowView } from './WorkflowView.js'
import { CsvGrid } from './CsvGrid.js'

// Module name the DSH client-modules loader reads from module.exports.
const name = 'dsh-cae-agent'

// Opportunistic consumption (matches the reference plugin ego-browser):
// betterSidebar is never required via `inject`; we probe with ctx.get() so the
// client half loads even when the sidebar service is absent (graceful no-op).
const inject: string[] = []

function apply(ctx: Context) {
  const betterSidebar = ctx.get<BetterSidebarService>('betterSidebar')
  if (!betterSidebar) return
  // Sidebar tab: Abaqus modeling workflow + operation logic.
  ctx.effect(() =>
    betterSidebar.registerTab({
      id: 'dsh-cae-agent:workflow',
      title: 'Abaqus 工作流',
      order: 60,
      component: (props: TabComponentProps) => <WorkflowView scope={props.scope} />,
    }),
  )
  // CSV file viewer for Abaqus result exports (text via fsRead).
  ctx.effect(() =>
    betterSidebar.registerFileViewer({
      id: 'dsh-cae-agent:csv',
      title: 'Abaqus CSV',
      exts: ['csv'],
      fetchStrategy: 'fsRead',
      component: (props: FileViewerProps) => <CsvGrid content={props.content} path={props.path} />,
    }),
  )
}

export { name, inject, apply }
