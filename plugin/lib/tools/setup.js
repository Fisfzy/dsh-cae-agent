/**
 * tools/setup.js — Tier 2 controlled modeling: analysis step, loads, and
 * boundary conditions. Parameter design follows FEA workflow methodology
 * (static/dynamic step, load types, BC types incl. symmetry) — all generated
 * code written here from scratch.
 */
import { registerTool, runKernelCode } from '../core.js';

const VALID_STEP_TYPES = ['static', 'dynamic', 'modal'];

export function register(ctx, config) {
  registerTool(ctx, config, {
    name: 'abaqus_define_step',
    description:
      'Create an analysis step on a model (after the initial step). type: static (default), dynamic, or modal. timePeriod = step duration; maxIncrements / initialIncrement for static/dynamic; nlgeom ON for large deformation; for modal set eigenfrequencies (numEigen) and optionally frequencyRange. Returns the step name and procedure.',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      name: { type: 'string', description: 'Step name (default Step-1/2/...)' },
      type: { type: 'string', description: 'static|dynamic|modal (default static)' },
      timePeriod: { type: 'number', description: 'Step time period (default 1.0)' },
      initialIncrement: { type: 'number', description: 'Initial increment size' },
      maxIncrements: { type: 'number', description: 'Max number of increments' },
      nlgeom: { type: 'boolean', description: 'Enable large-deformation nonlinear geometry (default false)' },
      numEigen: { type: 'number', description: 'For modal: number of eigenfrequencies to extract' },
      prevStepName: { type: 'string', description: 'Previous step name (default the last step, usually Initial)' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const type = String(args.type || 'static').toLowerCase();
      if (!VALID_STEP_TYPES.includes(type)) throw new Error('type must be static|dynamic|modal');
      const name = args.name ? JSON.stringify(String(args.name)) : null;
      const prev = args.prevStepName ? JSON.stringify(String(args.prevStepName)) : null;
      const tp = Number(args.timePeriod ?? 1.0);
      const nlgeom = args.nlgeom === true;
      // Python expression for the `previous` step: a literal name if given,
      // otherwise the last existing step name (falling back to "Initial").
      const basedPy = prev !== null ? prev : '("Initial" if len(m.steps)==1 else m.steps[m.steps.keys()[-1]].name)';
      const code = `from abaqus import mdb
m=mdb.models[${model}]
based=${basedPy}
stype=${JSON.stringify(type)}
name=${name}
if name is None:
    i=1; cand="Step-"+str(i)
    while cand in m.steps: i+=1; cand="Step-"+str(i)
    name=cand
if name in m.steps: del m.steps[name]
if stype=="modal":
    s=m.FrequencyStep(name=name, previous=based, numEigen=${Number(args.numEigen ?? 1)})
    proc="linear perturbation (frequency)"
else:
    nl=${nlgeom ? 'True' : 'False'}
    s=m.StaticStep(name=name, previous=based, timePeriod=${tp}, initialInc=${Number(args.initialIncrement ?? 0.1)}, maxInc=1e5, minInc=1e-12, maxNumInc=${Number(args.maxIncrements ?? 100)}, nlgeom=nl)
    proc="static, general" if stype=="static" else "dynamic, explicit/general"
result={"model":${model},"step":s.name,"type":stype,"previous":based,"procedure":proc}`;
      return runKernelCode(br, code);
    },
  });

  registerTool(ctx, config, {
    name: 'abaqus_apply_load',
    description:
      'Apply a load to a region of an instance in a model+step. type: pressure (on faces, needs magnitude in Pa), concentrated (point force on a vertex set, magnitude is a JSON array [Fx,Fy,Fz] in N), or gravity (magnitude in m/s^2, direction axis e.g. "Y"). region: a named set on the assembly instance, or leave empty for gravity (applies to whole model).',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      step: { type: 'string', description: 'Step name to apply in (default last non-Initial step)' },
      name: { type: 'string', description: 'Load name (default Load-1/2/...)' },
      type: { type: 'string', required: true, description: 'pressure|concentrated|gravity' },
      region: { type: 'string', description: 'Set name on the assembly instance; required for pressure/concentrated' },
      instance: { type: 'string', description: 'Assembly instance name holding the region set' },
      magnitude: { type: 'string', description: 'Pressure value, or JSON array [Fx,Fy,Fz], or gravity magnitude' },
      direction: { type: 'string', description: 'For gravity: X|Y|Z (means -X/-Y/-Z) or empty for -Y' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const name = args.name ? JSON.stringify(String(args.name)) : 'null';
      const step = args.step ? JSON.stringify(String(args.step)) : 'null';
      const type = String(args.type).toLowerCase();
      const region = args.region ? JSON.stringify(String(args.region)) : 'null';
      const inst = args.instance ? JSON.stringify(String(args.instance)) : 'null';
      let magnitude = JSON.stringify(args.magnitude ?? null);
      // Helpers serialized into the code so the execute impl stays simple.
      const code = `from abaqus import mdb
from abaqusConstants import UNIFORM
m=mdb.models[${model}]
stepname=${step}
if stepname is None:
    keys=list(m.steps.keys())
    stepname=keys[-1] if keys and keys[-1]!="Initial" else "Initial"
if stepname not in m.steps: stepname="Initial"
name=${name}
itype=${JSON.stringify(type)}
reg=${region}
inst=${inst}
# resolve region: instance.set else assembly.set
sel=None
if reg is not None:
    if inst is not None:
        sel=m.rootAssembly.instances[inst].sets[reg]
    else:
        sel=m.rootAssembly.sets[reg]
# unique load name
if name is None:
    i=1; cand="Load-"+str(i)
    while cand in m.loads: i+=1; cand="Load-"+str(i)
    name=cand
if name in m.loads: del m.loads[name]
if itype=="pressure":
    if sel is None: raise RuntimeError("pressure load needs a region set on a face")
    m.Pressure(name=name, createStepName=stepname, region=sel, magnitude=${magnitude} if ${magnitude} is not None else 0.0)
elif itype=="concentrated":
    if sel is None: raise RuntimeError("concentrated load needs a vertex set on the instance")
    f=[float(x) for x in (${magnitude} if isinstance(${magnitude},list) else [0.0,0.0,0.0])]
    m.ConcentratedForce(name=name, createStepName=stepname, region=sel, cf1=f[0] if len(f)>0 else 0.0, cf2=f[1] if len(f)>1 else 0.0, cf3=f[2] if len(f)>2 else 0.0)
elif itype=="gravity":
    d=(0,-1,0)
    dir=${JSON.stringify(String(args.direction || ''))}
    if dir: d={"X":(-1,0,0),"x":(-1,0,0),"Y":(0,-1,0),"y":(0,-1,0),"Z":(0,0,-1),"z":(0,0,-1),"X+":(1,0,0),"Y+":(0,1,0),"Z+":(0,0,1)}[dir]
    m.Gravity(name=name, createStepName=stepname, comp1=d[0], comp2=d[1], comp3=d[2])
else:
    raise ValueError("type must be pressure|concentrated|gravity")
result={"load":name,"step":stepname,"type":itype,"region":reg}`;
      return runKernelCode(br, code);
    },
  });

  registerTool(ctx, config, {
    name: 'abaqus_set_bc',
    description:
      'Set a boundary condition on a region/set of an assembly instance in a step (default Initial). type: encastre (fix all 6), pinned (fix translations), displacement (prescribe values), or symmetry (X/Y/Z). For displacement, give u1/u2/u3 (0 = fixed). Sensible defaults keep the model statically stable.',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      step: { type: 'string', description: 'Step name (default Initial)' },
      name: { type: 'string', description: 'BC name (default BC-1/...)' },
      type: { type: 'string', required: true, description: 'encastre|pinned|displacement|symmetry' },
      region: { type: 'string', required: true, description: 'Set name on the assembly instance (geometric region)' },
      instance: { type: 'string', description: 'Assembly instance name containing the set (recommended)' },
      u1: { type: 'number', description: 'For displacement: U1 value (0 = fixed)' },
      u2: { type: 'number', description: 'For displacement: U2 value (0 = fixed)' },
      u3: { type: 'number', description: 'For displacement: U3 value (0 = fixed)' },
      symmetry: { type: 'string', description: 'For symmetry: X|Y|Z' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const btype = String(args.type).toLowerCase();
      const step = args.step ? JSON.stringify(String(args.step)) : JSON.stringify('Initial');
      const region = JSON.stringify(String(args.region));
      const inst = args.instance ? JSON.stringify(String(args.instance)) : null;
      const name = args.name ? JSON.stringify(String(args.name)) : null;
      const symUpper = JSON.stringify(String(args.symmetry || 'Z').toUpperCase());
      const code = `from abaqus import mdb
m=mdb.models[${model}]
stepname=${step}
if stepname not in m.steps: stepname="Initial"
sel=m.rootAssembly.instances[${inst}].sets[${region}] if ${inst !== null ? 'true' : 'false'} else m.rootAssembly.sets[${region}]
bc=${name}
if bc is None:
    i=1; cand="BC-"+str(i)
    while cand in m.boundaryConditions: i+=1; cand="BC-"+str(i)
    bc=cand
if bc in m.boundaryConditions: del m.boundaryConditions[bc]
bt=${JSON.stringify(btype)}
if bt=="encastre":
    m.EncastreBC(name=bc, createStepName=stepname, region=sel)
elif bt=="pinned":
    m.DisplacementBC(name=bc, createStepName=stepname, region=sel, u1=0.0, u2=0.0, u3=0.0)
elif bt=="displacement":
    m.DisplacementBC(name=bc, createStepName=stepname, region=sel, u1=${Number(args.u1 ?? 0)}, u2=${Number(args.u2 ?? 0)}, u3=${Number(args.u3 ?? 0)})
elif bt=="symmetry":
    sy=${symUpper}
    if sy=="X": m.XsymmBC(name=bc, createStepName=stepname, region=sel)
    elif sy=="Y": m.YsymmBC(name=bc, createStepName=stepname, region=sel)
    else: m.ZsymmBC(name=bc, createStepName=stepname, region=sel)
else:
    raise ValueError("type must be encastre|pinned|displacement|symmetry")
result={"bc":bc,"step":stepname,"type":bt,"region":${region}}`;
      return runKernelCode(br, code);
    },
  });
}
