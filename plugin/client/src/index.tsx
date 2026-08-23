import type {} from 'dsh-better-sidebar'
import type { Context } from '@deepseek-ai/cordis'
import type { BetterSidebarService } from 'dsh-better-sidebar'
import { WorkflowView } from './WorkflowView.js'

export const name = 'dsh-cae-agent-sidebar'

/**
 * OPTIONAL-dependency pattern: `betterSidebar` is never put in `inject`, so the
 * plugin loads and does nothing when dsh-better-sidebar is absent (graceful
 * degradation). When the service IS present we register a single "Abaqus 工作流"
 * tab that renders {@link WorkflowView}. `registerTab` returns a disposer which
 * `ctx.effect` ties to the fiber lifecycle (unload/HMR-safe).
 */
export function apply(ctx: Context) {
  const bs = ctx.get<BetterSidebarService>('betterSidebar')
  if (!bs) return
  ctx.effect(() =>
    bs.registerTab({
      id: 'dsh-cae-agent:workflow',
      title: 'Abaqus 工作流',
      order: 60,
      component: (props) => <WorkflowView scope={props.scope} />,
    }),
  )
}
