import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode } from '../core.js';
export function registerInteraction(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_create_interaction',
        description: 'Create a contact or tie interaction between two surface sets on assembly instances, within a step (default last non-Initial step). kind: contact (surface-to-surface, with friction) or tie (bonded, no relative motion). Provide masterSurface and slaveSurface as "[instance]:[setName]". Contact formulation defaults to surface-to-surface; friction default 0.3. Master should be on the coarser/stiffer body.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            step: { type: 'string', description: 'Step name (default last non-Initial step)' },
            name: { type: 'string', description: 'Interaction name (default Int-1/...)' },
            kind: { type: 'string', required: true, enum: ['contact', 'tie'], description: 'contact|tie' },
            masterSurface: { type: 'string', required: true, description: '"[instance]:[surfaceSet]" master surface' },
            slaveSurface: { type: 'string', required: true, description: '"[instance]:[surfaceSet]" slave surface' },
            friction: { type: 'number', description: 'Friction coefficient (default 0.3); 0 for frictionless' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Interaction "${String(v.interaction ?? '')}" (${String(v.kind ?? '')}) between ${String(v.master ?? '')} and ${String(v.slave ?? '')}` },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = args.name ? JSON.stringify(String(args.name)) : 'None';
            const kind = String(args.kind).toLowerCase();
            if (!['contact', 'tie'].includes(kind))
                throw new Error('kind must be contact|tie');
            const step = args.step ? JSON.stringify(String(args.step)) : 'None';
            const friction = Number(args.friction ?? 0.3);
            const parseSurf = (s) => {
                if (!s || !s.includes(':'))
                    throw new Error('surface must be "[instance]:[surfaceSet]"');
                const idx = s.indexOf(':');
                const inst = s.slice(0, idx).trim();
                const set = s.slice(idx + 1).trim();
                return { inst: JSON.stringify(inst), set: JSON.stringify(set) };
            };
            const m = parseSurf(String(args.masterSurface));
            const sl = parseSurf(String(args.slaveSurface));
            const propName = JSON.stringify(friction > 0 ? 'fric' : 'fricless');
            const r = await runKernelCode(br, `from abaqus import mdb
m=mdb.models[${model}]
stepname=${step}
if stepname is None:
    keys=list(m.steps.keys()); stepname=keys[-1] if keys and keys[-1]!="Initial" else "Initial"
if stepname not in m.steps: stepname="Initial"
name=${name}
if name is None:
    i=1; cand="Int-"+str(i)
    while cand in m.interactions: i+=1; cand="Int-"+str(i)
    name=cand
if name in m.interactions: del m.interactions[name]
master=m.rootAssembly.instances[${m.inst}].sets[${m.set}].faces
slave_=m.rootAssembly.instances[${sl.inst}].sets[${sl.set}].faces
kind=${JSON.stringify(kind)}
propName=${propName}
if kind=="contact":
    from abaqusConstants import FINITE
    m.SurfaceToSurfaceContactStd(name=name, createStepName=stepname, master=master, slave=slave_, sliding=FINITE, interactionProperty=(propName,))
elif kind=="tie":
    from abaqusConstants import COMPUTED, ON
    m.Tie(name=name, main=master, secondary=slave_, positionToleranceMethod=COMPUTED, adjust=ON)
else:
    raise ValueError("kind must be contact|tie")
result={"interaction":name,"step":stepname,"kind":kind,"master":${m.inst}+":"+${m.set},"slave":${sl.inst}+":"+${sl.set}}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_set_friction',
        description: 'Define (or update) an interaction property on a model, used to set friction in a surface-to-surface contact. name (default "fric"/"fricless"). friction 0 = frictionless; use a small value or ROUGH for no-slide. Registers a ContactProperty.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', description: 'Property name (default "fric")' },
            friction: { type: 'number', required: true, description: 'Friction coefficient (0 = frictionless)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Interaction property "${String(v.property ?? '')}" friction=${String(v.friction ?? 0)}` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name || (Number(args.friction ?? 0) > 0 ? 'fric' : 'fricless')));
            const friction = Number(args.friction ?? 0);
            const r = await runKernelCode(br, `from abaqus import mdb
from abaqusConstants import PENALTY, ISOTROPIC, OFF, FRACTION, HARD, ON, FRICTIONLESS
m=mdb.models[${model}]
name=${name}
if name in m.interactionProperties: del m.interactionProperties[name]
ip=m.ContactProperty(name)
ip.TangentialBehavior(formulation=PENALTY, directionality=ISOTROPIC, slipRateDependency=OFF, pressureDependency=OFF, temperatureDependency=OFF, dependencies=0, table=(( ${friction}, ),), shearStressLimit=None, maximumElasticSlip=FRACTION, fraction=0.005)
if ${friction} <= 0.0:
    ip.NormalBehavior(pressureOverclosure=HARD, allowSeparation=ON)
result={"property":name,"friction":${friction}}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
