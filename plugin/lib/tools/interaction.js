/**
 * tools/interaction.js — Tier 2 controlled modeling: contact / tie
 * interactions between surfaces. Param design follows contact methodology
 * (surface-to-surface vs tie, friction, master/slave; coarser-mesh-as-master),
 * all code generated from scratch.
 */
import { registerTool, runKernelCode } from '../core.js';

export function register(ctx, config) {
  registerTool(ctx, config, {
    name: 'abaqus_create_interaction',
    description:
      'Create a contact or tie interaction between two surface sets on assembly instances, within a step (default last non-Initial step). kind: contact (surface-to-surface, with friction) or tie (bonded, no relative motion). Provide masterSurface and slaveSurface as "instance:setName". Contact formulation defaults to surface-to-surface (surfaceToSurfaceContactStd); friction default 0.3. Master should be on the coarser/stiffer body.',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      step: { type: 'string', description: 'Step name (default last non-Initial step)' },
      name: { type: 'string', description: 'Interaction name (default Int-1/...)' },
      kind: { type: 'string', required: true, description: 'contact|tie' },
      masterSurface: { type: 'string', required: true, description: '"[instance]:[surfaceSet]" master surface' },
      slaveSurface: { type: 'string', required: true, description: '"[instance]:[surfaceSet]" slave surface' },
      friction: { type: 'number', description: 'Friction coefficient (default 0.3); 0 for frictionless' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const name = args.name ? JSON.stringify(String(args.name)) : 'null';
      const kind = String(args.kind).toLowerCase();
      const step = args.step ? JSON.stringify(String(args.step)) : 'null';
      const friction = Number(args.friction ?? 0.3);
      const parseSurf = (s) => {
        if (!s || !s.includes(':')) throw new Error('surface must be "[instance]:[surfaceSet]"');
        const [inst, set] = s.split(':');
        return { inst: JSON.stringify(inst.trim()), set: JSON.stringify(set.trim()) };
      };
      const m = parseSurf(args.masterSurface);
      const sl = parseSurf(args.slaveSurface);
      // Interaction property name depends on friction only when a contact prop is used.
      const propName = JSON.stringify(friction > 0 ? 'fric' : 'fricless');
      const code = `from abaqus import mdb
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
result={"interaction":name,"step":stepname,"kind":kind,"master":${m.inst}+":"+${m.set},"slave":${sl.inst}+":"+${sl.set}}`;
      return runKernelCode(br, code);
    },
  });

  registerTool(ctx, config, {
    name: 'abaqus_set_friction',
    description:
      'Define (or update) an interaction property on a model, used to set friction in a surface-to-surface contact. name (default "fric"/"fricless"). friction 0 = frictionless; use a small value or ROUGH for no-slide. Registers a ContactProperty.',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      name: { type: 'string', description: 'Property name (default "fric")' },
      friction: { type: 'number', required: true, description: 'Friction coefficient (0 = frictionless)' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const name = JSON.stringify(String(args.name || (Number(args.friction ?? 0) > 0 ? 'fric' : 'fricless')));
      const friction = Number(args.friction ?? 0);
      const code = `from abaqus import mdb
m=mdb.models[${model}]
name=${name}
if name in m.interactionProperties: del m.interactionProperties[name]
ip=m.ContactProperty(name)
ip.TangentialBehavior(formulation=PENALTY, directionality=ISOTROPIC, slipRateDependence=OFF, pressureDependence=OFF, temperatureDependence=OFF, dependencies=0, table=(( ${friction}, ),), shearStressLimit=None, maximumElasticSlip=FRACTION)
if ${friction} <= 0.0:
    from abaqusConstants import FRICTIONLESS
    ip.NormalBehavior(pressureOverclosure=HARD, allowSeparation=ON)
result={"property":name,"friction":${friction}}`;
      return runKernelCode(br, code);
    },
  });
}
