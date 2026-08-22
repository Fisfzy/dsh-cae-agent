import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode } from '../core.js';
const VALID_SHAPES = ['SOLID', 'SHELL', 'WIRE', 'POINT'];
const VALID_TYPES = ['DEFORMABLE', 'DISCRETE_RIGID', 'ANALYTIC_RIGID'];
const VALID_REGIONS = ['cells', 'faces', 'edges', 'vertices'];
export function registerGeometry(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_create_part',
        description: 'Create a new (deformable) part in a model. Supports a simple 3D solid primitive (box by base corner + depth, or a cylinder by radius+height) so a first geometry exists without scripting. For arbitrary sketches, use abaqus_run_python. shape: SOLID|SHELL|WIRE; type: DEFORMABLE (default).',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', required: true, description: 'Part name' },
            shape: { type: 'string', enum: ['SOLID', 'SHELL', 'WIRE'], description: 'SOLID|SHELL|WIRE (default SOLID)' },
            type: {
                type: 'string',
                enum: ['DEFORMABLE', 'DISCRETE_RIGID', 'ANALYTIC_RIGID'],
                description: 'DEFORMABLE (default)',
            },
            primitive: { type: 'string', enum: ['box', 'cylinder'], description: 'box|cylinder (default box)' },
            boxX: { type: 'number', description: 'Box size X' },
            boxY: { type: 'number', description: 'Box size Y' },
            boxZ: { type: 'number', description: 'Box size Z' },
            radius: { type: 'number', description: 'Cylinder radius' },
            height: { type: 'number', description: 'Cylinder height' },
            axis: { type: 'string', description: 'Cylinder axis: X|Y|Z (default Z)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    {
                        type: 'text',
                        text: `Part "${String(v.name ?? '')}" in model "${String(v.model ?? '')}" (cells=${String(v.cells ?? 0)}, faces=${String(v.faces ?? 0)}, edges=${String(v.edges ?? 0)})`,
                    },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name));
            const shape = String(args.shape ?? 'SOLID').toUpperCase();
            const ptype = String(args.type ?? 'DEFORMABLE').toUpperCase();
            if (!VALID_SHAPES.includes(shape))
                throw new Error('shape must be SOLID|SHELL|WIRE');
            if (!VALID_TYPES.includes(ptype))
                throw new Error('type must be DEFORMABLE|DISCRETE_RIGID|ANALYTIC_RIGID');
            const primitive = String(args.primitive ?? 'box');
            const r = await runKernelCode(br, `from abaqusConstants import THREE_D, FOUR_NODE_TET
from abaqus import mdb
m=mdb.models[${model}]
name=${name}
if name in m.parts: del m.parts[name]
shape=${JSON.stringify(shape)}
ptype=${JSON.stringify(ptype)}
part=m.Part(name=name, dimensionality=THREE_D, type=ptype, shape=shape)
origin=(0.0,0.0,0.0)
prim=${JSON.stringify(primitive)}
if prim=="box":
    w=${Number(args.boxX ?? 1.0)}; d=${Number(args.boxY ?? 1.0)}; h=${Number(args.boxZ ?? 1.0)}
    s=part.MainSketch(name="_profile_", objectToCopy=None)
    s.rectangle(point1=(0,0), point2=(w,d))
    part.BaseSolidExtrude(sketch=s, depth=h)
elif prim=="cylinder":
    r=${Number(args.radius ?? 1.0)}; he=${Number(args.height ?? 1.0)}
    s=part.MainSketch(name="_profile_", objectToCopy=None)
    s.CircleByCenterPerimeter(center=(0.0,0.0), point1=(r,0.0))
    part.BaseSolidExtrude(sketch=s, depth=he)
result={"model":${model},"name":part.name,"exists":part.name in m.parts,"cells":len(part.cells),"faces":len(part.faces),"edges":len(part.edges)}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_create_set',
        description: 'Create a named set on a part (or on the assembly if part is "Assembly") selecting geometry by element type and index list, OR by 3D point coordinates (findAt). region: "cells"|"faces"|"edges"|"vertices". indices: array of 0-based indexes, or an object {points:[[x,y,z],...]}.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', required: true, description: 'Set name' },
            part: { type: 'string', description: 'Part name, or "Assembly" for the root assembly' },
            region: {
                type: 'string',
                required: true,
                enum: ['cells', 'faces', 'edges', 'vertices'],
                description: 'cells|faces|edges|vertices',
            },
            indices: {
                type: 'string',
                description: 'JSON array of indices, or JSON object {"points":[[x,y,z],...]}. If omitted, selects all of that type.',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Set "${String(v.set ?? '')}" on ${String(v.container ?? '?')}: ${String(v.count ?? 0)} ${String(v.region ?? '')}` },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name));
            const part = JSON.stringify(String(args.part || 'Assembly'));
            const region = String(args.region || 'cells').toLowerCase();
            if (!VALID_REGIONS.includes(region))
                throw new Error('region must be cells|faces|edges|vertices');
            const spec = args.indices ? JSON.parse(String(args.indices)) : null;
            const r = await runKernelCode(br, `from abaqus import mdb
m=mdb.models[${model}]
name=${name}
target = m.rootAssembly if ${JSON.stringify(String(args.part || 'Assembly'))}.lower()=="assembly" else m.parts[${part}]
region=${JSON.stringify(region)}
spec=${JSON.stringify(spec)}
# choose the geometric collection
if region=="cells": col=target.cells
elif region=="faces": col=target.faces
elif region=="edges": col=target.edges
elif region=="vertices": col=target.vertices
else: raise ValueError("region must be cells|faces|edges|vertices")
# select
if spec is None:
    sel=col[:]
elif isinstance(spec,dict) and spec.get("points"):
    sel=target.findAt(*(spec["points"]), printWarning=False)
else:
    sel=[col[i] for i in spec]
# replace existing set of same name
if name in target.sets: del target.sets[name]
if region=="cells": target.Set(name=name, cells=sel)
elif region=="faces": target.Set(name=name, faces=sel)
elif region=="edges": target.Set(name=name, edges=sel)
else: target.Set(name=name, vertices=sel)
result={"set":name,"container":("assembly" if target is m.rootAssembly else "part"),"region":region,"count":len(sel)}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_instantiate',
        description: 'Instantiate a part into the root assembly of a model under an instance name (defaults to a deterministic name). If only one part exists, it is instantiated automatically.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            part: { type: 'string', description: 'Part name (default: instantiate the first part)' },
            instanceName: { type: 'string', description: 'Instance name' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Instance "${String(v.instance ?? '')}" of part "${String(v.part ?? '')}"${v.created ? '' : ' (already present)'}` },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const part = args.part ? JSON.stringify(String(args.part)) : 'null';
            const inst = JSON.stringify(String(args.instanceName || ''));
            const r = await runKernelCode(br, `from abaqusConstants import ON
from abaqus import mdb
m=mdb.models[${model}]
part=${part}
if part is None:
    parts=list(m.parts.keys())
    if not parts: raise RuntimeError("No parts in model")
    part=parts[0]
p=m.parts[part]
name=${inst}
if not name:
    name=part+"-1"
    i=1
    while name in m.rootAssembly.instances:
        i+=1; name=part+"-"+str(i)
if name in m.rootAssembly.instances:
    result={"already":True,"instance":name,"part":part}
else:
    a=m.rootAssembly
    a.Instance(name=name, part=p, dependent=ON)
    result={"instance":name,"part":part,"created":True}
result`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
