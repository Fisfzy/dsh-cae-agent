/**
 * tools/mesh.ts — Tier 2 controlled modeling: mesh seed + generate + element
 * type (C3D8R/C3D4R for solid by default; S4R for shell). Adaptive defaults:
 * approximate global seed size = (part bounding box diagonal)/10.
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import type { BridgeHandle } from '../core.js'
import { runKernelCode } from '../core.js'

type JsonRecord = Record<string, JsonValue>

export function registerMesh(ctx: Context, config: { host: string; port: number; timeoutMs: number }): void {
  const br: BridgeHandle = { host: config.host, port: config.port }

  ctx.tools.register(
    defineTool({
      name: 'abaqus_generate_mesh',
      description:
        'Seed and generate a mesh on a part (or its assembly instance) in a model. elementFamily: solid (default if the part has cells) or shell (if it only has faces). solid -> C3D8R/C3D4R; shell -> S4R. size: approximate global seed size; if omitted, auto = bounding-box diagonal / 10. Mesh is applied on the assembly instance when the part has an independent instance (Abaqus requirement).',
      parameters: {
        model: { type: 'string', required: true, description: 'Model name' },
        part: { type: 'string', description: 'Part name (default: mesh the first part)' },
        elementFamily: { type: 'string', enum: ['solid', 'shell'], description: 'solid|shell (auto from geometry when omitted)' },
        size: { type: 'number', description: 'Approximate global seed size (auto if omitted)' },
        elemShape: { type: 'string', enum: ['hex', 'tet'], description: 'For solid: hex|tet (default hex if possible, else auto)' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const v = (value ?? {}) as JsonRecord
          return [
            { type: 'text', text: `Mesh on "${String(v.part ?? '')}": ${String(v.elements ?? 0)} elements, ${String(v.nodes ?? 0)} nodes (size=${String(v.size ?? 'auto')})` },
          ]
        },
      },
      async execute(args, exec) {
        const model = JSON.stringify(String(args.model))
        const part = args.part ? JSON.stringify(String(args.part)) : 'None'
        const requested = args.elementFamily ? String(args.elementFamily).toLowerCase() : ''
        if (requested && !['solid', 'shell'].includes(requested)) throw new Error('elementFamily must be solid|shell')
        const elemShape = String(args.elemShape || 'hex')
        if (!['hex', 'tet'].includes(elemShape)) throw new Error('elemShape must be hex|tet')
        const r = await runKernelCode(
          br,
          `import math
from abaqus import mdb
m=mdb.models[${model}]
part=${part}
if part is None:
    pts=list(m.parts.keys())
    if not pts: raise RuntimeError("No part in model")
    part=pts[0]
p=m.parts[part]
requested=${JSON.stringify(requested)}
# choose family from geometry when not specified
if not requested:
    family="solid" if len(p.cells)>0 else ("shell" if len(p.faces)>0 else "solid")
else:
    family=requested
# detect whether the part has an independent instance (mesh must go on the instance)
instances=[i for i in m.rootAssembly.instances.values() if i.part.name==p.name]
mesh_target=p
mesh_on_assembly=False
if instances:
    # independent (non-dependent) instances: mesh on the assembly instance
    indep=[i for i in instances if not hasattr(i,'dependent') or not getattr(i,'dependent','ON') in ('ON',1,True)]
    if indep:
        mesh_target=indep[0]
        mesh_on_assembly=True
target=mesh_target
size=${Number(args.size ?? -1)}
if size<=0:
    xs=[v.pointOn[0][0] for v in p.vertices] or [0.0]
    ys=[v.pointOn[0][1] for v in p.vertices] or [0.0]
    zs=[v.pointOn[0][2] for v in p.vertices] or [0.0]
    diag=math.sqrt((max(xs)-min(xs))**2+(max(ys)-min(ys))**2+(max(zs)-min(zs))**2)
    size=max(diag/10.0, 1e-6)
if mesh_on_assembly:
    m.rootAssembly.seedPartInstance(regions=(mesh_target,), size=size, deviationFactor=0.1)
    m.rootAssembly.generateMesh(regions=(mesh_target,))
else:
    target.seedPart(size=size, deviationFactor=0.1)
    target.generateMesh()
result={"part":p.name,"target":("assembly:"+mesh_target.name) if mesh_on_assembly else p.name,
        "family":family,"size":size,"elements":len(target.elements),"nodes":len(target.nodes)}`,
          config.timeoutMs,
          exec.signal,
        )
        return r.value as JsonRecord
      },
      timeoutMs: config.timeoutMs,
      isConcurrencySafe: () => false,
    }),
  )
}
