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
        'Seed and generate a mesh on a part in a model. elementFamily: solid (default) or shell. solid -> C3D8R (hex) / C3D4R (tet) via elemShape auto; shell -> S4R. size: approximate global seed size; if omitted, auto = bounding-box diagonal / 10.',
      parameters: {
        model: { type: 'string', required: true, description: 'Model name' },
        part: { type: 'string', description: 'Part name (default: mesh the first part)' },
        elementFamily: { type: 'string', enum: ['solid', 'shell'], description: 'solid|shell (default solid)' },
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
        const part = args.part ? JSON.stringify(String(args.part)) : 'null'
        const family = String(args.elementFamily || 'solid').toLowerCase()
        if (!['solid', 'shell'].includes(family)) throw new Error('elementFamily must be solid|shell')
        const elemShape = String(args.elemShape || 'hex')
        if (!['hex', 'tet'].includes(elemShape)) throw new Error('elemShape must be hex|tet')
        const r = await runKernelCode(
          br,
          `import math
from abaqus import mdb
from part import ElemType
from abaqusConstants import EXPLICIT, C3D8R, C3D4R, S4R
m=mdb.models[${model}]
part=${part}
if part is None:
    pts=list(m.parts.keys())
    if not pts: raise RuntimeError("No part in model")
    part=pts[0]
p=m.parts[part]
family=${JSON.stringify(family)}
if family=="solid":
    if ${JSON.stringify(elemShape)}.lower()=="tet":
        p.setElementType(regions=(p.cells,), elemTypes=(ElemType(elemCode=C3D4R, elemLibrary=EXPLICIT),))
    else:
        p.setElementType(regions=(p.cells,), elemTypes=(ElemType(elemCode=C3D8R, elemLibrary=EXPLICIT),))
elif family=="shell":
    p.setElementType(regions=(p.faces,), elemTypes=(ElemType(elemCode=S4R, elemLibrary=EXPLICIT),))
else:
    raise ValueError("elementFamily must be solid|shell")
size=${Number(args.size ?? -1)}
if size<=0:
    xs=[v.pointOn[0][0] for v in p.vertices] or [0.0]
    ys=[v.pointOn[0][1] for v in p.vertices] or [0.0]
    zs=[v.pointOn[0][2] for v in p.vertices] or [0.0]
    diag=math.sqrt((max(xs)-min(xs))**2+(max(ys)-min(ys))**2+(max(zs)-min(zs))**2)
    size=max(diag/10.0, 1e-6)
p.seedPart(size=size, deviationFactor=0.1)
p.generateMesh()
result={"part":part,"family":family,"size":size,"elements":len(p.elements),"nodes":len(p.nodes),"cells":len(p.cells) if hasattr(p,"cells") else None}`,
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
