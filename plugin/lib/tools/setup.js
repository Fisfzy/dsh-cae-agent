import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode } from '../core.js';
const VALID_STEP_TYPES = ['static', 'dynamic', 'modal', 'heat', 'coupled'];
const VALID_LOAD_TYPES = ['pressure', 'concentrated', 'gravity'];
const VALID_BC_TYPES = ['encastre', 'pinned', 'displacement', 'symmetry'];
export function registerSetup(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_define_step',
        description: 'Create an analysis step on a model (after the initial step). type: static (default), dynamic, or modal. timePeriod = step duration; maxIncrements / initialIncrement for static/dynamic; nlgeom ON for large deformation; for modal set eigenfrequencies (numEigen).',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', description: 'Step name (default Step-1/2/...)' },
            type: { type: 'string', enum: ['static', 'dynamic', 'modal', 'heat', 'coupled'], description: 'static|dynamic|modal|heat|coupled (default static)' },
            timePeriod: { type: 'number', description: 'Step time period (default 1.0)' },
            initialIncrement: { type: 'number', description: 'Initial increment size' },
            maxIncrements: { type: 'number', description: 'Max number of increments' },
            nlgeom: { type: 'boolean', description: 'Enable large-deformation nonlinear geometry (default false)' },
            numEigen: { type: 'number', description: 'For modal: number of eigenfrequencies to extract' },
            maxTempChange: { type: 'number', description: 'For heat/coupled: max temperature change per increment (delTmX), default 10' },
            prevStepName: { type: 'string', description: 'Previous step name (default the last step, usually Initial)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Step "${String(v.step ?? '')}" (${String(v.type ?? '')}, previous=${String(v.previous ?? '')})` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const type = String(args.type || 'static').toLowerCase();
            if (!VALID_STEP_TYPES.includes(type))
                throw new Error(`type must be ${VALID_STEP_TYPES.join('|')}`);
            const name = args.name ? JSON.stringify(String(args.name)) : 'None';
            const prev = args.prevStepName ? JSON.stringify(String(args.prevStepName)) : 'None';
            const tp = Number(args.timePeriod ?? 1.0);
            const nlgeom = args.nlgeom === true;
            const basedPy = prev !== 'None' ? prev : '("Initial" if len(m.steps)<=1 else list(m.steps.keys())[-1])';
            const r = await runKernelCode(br, `from abaqus import mdb
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
elif stype=="heat":
    s=m.HeatTransferStep(name=name, previous=based, deltmx=${Number(args.maxTempChange ?? 10)}, timePeriod=${tp}, initialInc=${Number(args.initialIncrement ?? 0.1)}, maxNumInc=${Number(args.maxIncrements ?? 100)})
    proc="heat transfer"
elif stype=="coupled":
    s=m.CoupledTempDisplacementStep(name=name, previous=based, deltmx=${Number(args.maxTempChange ?? 10)}, timePeriod=${tp}, initialInc=${Number(args.initialIncrement ?? 0.1)}, maxNumInc=${Number(args.maxIncrements ?? 100)})
    proc="coupled temp-displacement"
else:
    nl=${nlgeom ? 'True' : 'False'}
    s=m.StaticStep(name=name, previous=based, timePeriod=${tp}, initialInc=${Number(args.initialIncrement ?? 0.1)}, maxInc=${tp}, minInc=1e-12, maxNumInc=${Number(args.maxIncrements ?? 100)}, nlgeom=nl)
    proc="static, general" if stype=="static" else "dynamic, explicit/general"
result={"model":${model},"step":s.name,"type":stype,"previous":based,"procedure":proc}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_apply_load',
        description: 'Apply a load to a region of an instance in a model+step. type: pressure (on faces, magnitude in Pa), concentrated (point force on a vertex set, magnitude is a JSON array [Fx,Fy,Fz] in N), or gravity (magnitude in m/s^2, direction axis e.g. "Y"). region: a named set on the assembly instance, or leave empty for gravity.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            step: { type: 'string', description: 'Step name to apply in (default last non-Initial step)' },
            name: { type: 'string', description: 'Load name (default Load-1/2/...)' },
            type: { type: 'string', required: true, enum: ['pressure', 'concentrated', 'gravity'], description: 'pressure|concentrated|gravity' },
            region: { type: 'string', description: 'Set name on the assembly instance; required for pressure/concentrated' },
            instance: { type: 'string', description: 'Assembly instance name holding the region set' },
            magnitude: { type: 'string', description: 'Pressure value, or JSON array [Fx,Fy,Fz], or gravity magnitude' },
            direction: { type: 'string', description: 'For gravity: X|Y|Z (means -X/-Y/-Z) or empty for -Y' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Load "${String(v.load ?? '')}" (${String(v.type ?? '')}) on step "${String(v.step ?? '')}"` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = args.name ? JSON.stringify(String(args.name)) : 'None';
            const step = args.step ? JSON.stringify(String(args.step)) : 'None';
            const type = String(args.type).toLowerCase();
            if (!VALID_LOAD_TYPES.includes(type))
                throw new Error(`type must be ${VALID_LOAD_TYPES.join('|')}`);
            const region = args.region ? JSON.stringify(String(args.region)) : 'None';
            const inst = args.instance ? JSON.stringify(String(args.instance)) : 'None';
            const magnitude = args.magnitude !== undefined && args.magnitude !== null ? JSON.stringify(args.magnitude) : 'None';
            const r = await runKernelCode(br, `from abaqus import mdb
from abaqusConstants import UNIFORM
import regionToolset
import json
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
    if sel is None: raise RuntimeError("pressure load needs a face set on the instance/assembly")
    pfaces = sel.faces if hasattr(sel, 'faces') else []
    if not pfaces or len(pfaces) == 0: raise RuntimeError("pressure load requires a face set (no faces found in set '%s')" % (str(reg or '')))
    surf = m.rootAssembly.Surface(name=name + '-Surf', side1Faces=pfaces)
    m.Pressure(name=name, createStepName=stepname, region=surf, magnitude=float(${magnitude}) if ${magnitude} is not None else 0.0, distributionType=UNIFORM)
elif itype=="concentrated":
    if sel is None: raise RuntimeError("concentrated load needs a vertex set on the instance")
    verts = list(sel.vertices) if hasattr(sel, 'vertices') else []
    if not verts: raise RuntimeError("concentrated load requires a vertex set (no vertices found in set '%s')" % (str(reg or '')))
    rgn = regionToolset.Region(vertices=verts)
    f=[float(x) for x in (json.loads(${magnitude}) if isinstance(${magnitude},str) else (${magnitude} if isinstance(${magnitude},list) else [0.0,0.0,0.0]))]
    m.ConcentratedForce(name=name, createStepName=stepname, region=rgn, cf1=f[0] if len(f)>0 else 0.0, cf2=f[1] if len(f)>1 else 0.0, cf3=f[2] if len(f)>2 else 0.0)
elif itype=="gravity":
    d=(0,-1,0)
    dir=${JSON.stringify(String(args.direction || ''))}
    if dir: d={"X":(-1,0,0),"x":(-1,0,0),"Y":(0,-1,0),"y":(0,-1,0),"Z":(0,0,-1),"z":(0,0,-1),"X+":(1,0,0),"Y+":(0,1,0),"Z+":(0,0,1)}[dir]
    m.Gravity(name=name, createStepName=stepname, comp1=d[0], comp2=d[1], comp3=d[2])
else:
    raise ValueError("type must be pressure|concentrated|gravity")
result={"load":name,"step":stepname,"type":itype,"region":reg}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_set_bc',
        description: 'Set a boundary condition on a region/set of an assembly instance in a step (default Initial). type: encastre (fix all 6), pinned (fix translations), displacement (prescribe values), or symmetry (X/Y/Z). For displacement, give u1/u2/u3 (0 = fixed).',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            step: { type: 'string', description: 'Step name (default Initial)' },
            name: { type: 'string', description: 'BC name (default BC-1/...)' },
            type: { type: 'string', required: true, enum: ['encastre', 'pinned', 'displacement', 'symmetry'], description: 'encastre|pinned|displacement|symmetry' },
            region: { type: 'string', required: true, description: 'Set name on the assembly instance (geometric region)' },
            instance: { type: 'string', description: 'Assembly instance name containing the set (recommended)' },
            u1: { type: 'number', description: 'For displacement: U1 value (0 = fixed)' },
            u2: { type: 'number', description: 'For displacement: U2 value (0 = fixed)' },
            u3: { type: 'number', description: 'For displacement: U3 value (0 = fixed)' },
            symmetry: { type: 'string', description: 'For symmetry: X|Y|Z' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `BC "${String(v.bc ?? '')}" (${String(v.type ?? '')}) on step "${String(v.step ?? '')}"` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const btype = String(args.type).toLowerCase();
            if (!VALID_BC_TYPES.includes(btype))
                throw new Error(`type must be ${VALID_BC_TYPES.join('|')}`);
            const step = args.step ? JSON.stringify(String(args.step)) : JSON.stringify('Initial');
            const region = JSON.stringify(String(args.region));
            const inst = args.instance ? JSON.stringify(String(args.instance)) : 'None';
            const name = args.name ? JSON.stringify(String(args.name)) : 'None';
            const symUpper = JSON.stringify(String(args.symmetry || 'Z').toUpperCase());
            const r = await runKernelCode(br, `from abaqus import mdb
m=mdb.models[${model}]
stepname=${step}
if stepname not in m.steps: stepname="Initial"
inst_arg=${inst}
sel = m.rootAssembly.instances[inst_arg].sets[${region}] if inst_arg is not None else m.rootAssembly.sets[${region}]
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
result={"bc":bc,"step":stepname,"type":bt,"region":${region}}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_define_amplitude',
        description: 'Define a time-varying amplitude that scales loads/BCs over time. amplitudeType: TABULAR (data=[[time,value],...]), SMOOTH_STEP (data=[[time,value],...]), DECAY (data=[initialValue, decayTime]), or PERIODIC (data={startTime,frequency,amplitude,cycle,phase}). timeSpan: STEP (default) or TOTAL. Use for ramp/sinusoidal/pulse loading on a load or BC.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', required: true, description: 'Amplitude name' },
            amplitudeType: {
                type: 'string',
                enum: ['TABULAR', 'SMOOTH_STEP', 'DECAY', 'PERIODIC'],
                description: 'Amplitude type (default TABULAR)',
            },
            timeSpan: { type: 'string', enum: ['STEP', 'TOTAL'], description: 'Time reference (default STEP)' },
            data: {
                type: 'string',
                required: true,
                description: 'JSON: for TABULAR/SMOOTH_STEP "[[0,0],[1,1]]"; for DECAY "[initialValue, decayTime]"; for PERIODIC "{\\"startTime\\":0,\\"frequency\\":0.5,\\"amplitude\\":5,\\"cycle\\":1,\\"phase\\":0}"',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Amplitude "${String(v.amplitude ?? '')}" (${String(v.type ?? '')}, ${String(v.points ?? 0)} pts)` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name));
            const atype = String(args.amplitudeType || 'TABULAR').toUpperCase();
            if (!['TABULAR', 'SMOOTH_STEP', 'DECAY', 'PERIODIC'].includes(atype)) {
                throw new Error('amplitudeType must be TABULAR|SMOOTH_STEP|DECAY|PERIODIC');
            }
            const tsp = String(args.timeSpan || 'STEP').toUpperCase();
            if (!['STEP', 'TOTAL'].includes(tsp))
                throw new Error('timeSpan must be STEP|TOTAL');
            let data;
            try {
                data = JSON.parse(String(args.data || '[]'));
            }
            catch {
                throw new Error('data must be a valid JSON value');
            }
            const dataPy = JSON.stringify(data);
            const r = await runKernelCode(br, `from abaqus import mdb
from abaqusConstants import STEP, TOTAL
m=mdb.models[${model}]
name=${name}
atype=${JSON.stringify(atype)}
tsp=STEP if ${JSON.stringify(tsp)}=="STEP" else TOTAL
data=${dataPy}
if atype=="TABULAR":
    d=tuple((float(t), float(v)) for t,v in data)
    a=m.TabularAmplitude(name=name, timeSpan=tsp, data=d); pts=len(d)
elif atype=="SMOOTH_STEP":
    d=tuple((float(t), float(v)) for t,v in data)
    a=m.SmoothStepAmplitude(name=name, timeSpan=tsp, data=d); pts=len(d)
elif atype=="DECAY":
    a=m.DecayAmplitude(name=name, timeSpan=tsp, initial=float(data[0]), decayTime=float(data[1])); pts=2
elif atype=="PERIODIC":
    a=m.PeriodicAmplitude(name=name, timeSpan=tsp, startTime=float(data.get("startTime",0)), frequency=float(data.get("frequency",1)), amplitude=float(data.get("amplitude",1)), cycle=int(data.get("cycle",1)), phase=float(data.get("phase",0))); pts=1
result={"amplitude":a.name,"type":atype,"points":pts,"timeSpan":("STEP" if tsp==STEP else "TOTAL")}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_define_predefined_field',
        description: 'Define an initial condition / predefined field on a region. fieldType: TEMPERATURE (magnitude in degC), STRESS (components=[s11,s22,s33,s12,s13,s23]), or VELOCITY (components=[v1,v2,v3]). region: a part/assembly set name; instance: the assembly instance. distributionType defaults to UNIFORM. createStepName defaults to Initial.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            name: { type: 'string', required: true, description: 'Predefined field name' },
            fieldType: {
                type: 'string',
                required: true,
                enum: ['TEMPERATURE', 'STRESS', 'VELOCITY'],
                description: 'TEMPERATURE|STRESS|VELOCITY',
            },
            region: { type: 'string', required: true, description: 'Set name on the part/assembly' },
            instance: { type: 'string', description: 'Assembly instance name holding the region set' },
            step: { type: 'string', description: 'Step name (default Initial)' },
            magnitude: { type: 'number', description: 'Scalar value for TEMPERATURE' },
            components: { type: 'string', description: 'JSON array for STRESS (6) or VELOCITY (3), e.g. "[0,0,0,0,0,0]"' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Predefined field "${String(v.field ?? '')}" (${String(v.type ?? '')}) on step "${String(v.step ?? '')}"` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name));
            const ftype = String(args.fieldType).toUpperCase();
            if (!['TEMPERATURE', 'STRESS', 'VELOCITY'].includes(ftype))
                throw new Error('fieldType must be TEMPERATURE|STRESS|VELOCITY');
            const region = JSON.stringify(String(args.region));
            const inst = args.instance ? JSON.stringify(String(args.instance)) : 'None';
            const step = args.step ? JSON.stringify(String(args.step)) : JSON.stringify('Initial');
            const comps = args.components ? JSON.stringify(args.components) : 'None';
            const mag = args.magnitude !== undefined && args.magnitude !== null ? Number(args.magnitude) : null;
            const r = await runKernelCode(br, `from abaqus import mdb
from abaqusConstants import UNIFORM
m=mdb.models[${model}]
stepname=${step}
if stepname not in m.steps: stepname="Initial"
inst_arg=${inst}
sel = m.rootAssembly.instances[inst_arg].sets[${region}] if inst_arg is not None else m.rootAssembly.sets[${region}]
name=${name}
ft=${JSON.stringify(ftype)}
if ft=="TEMPERATURE":
    if ${mag === null ? 'True' : 'False'}: raise ValueError("magnitude is required for TEMPERATURE")
    f=m.Temperature(name=name, createStepName=stepname, region=sel, magnitudes=(${mag},), distributionType=UNIFORM)
elif ft=="STRESS":
    c=tuple(float(x) for x in ${comps}) if ${comps} is not None else (0,0,0,0,0,0)
    f=m.Stress(name=name, createStepName=stepname, region=sel, comp1=c[0], comp2=c[1], comp3=c[2], comp4=c[3], comp5=c[4], comp6=c[5], distributionType=UNIFORM)
elif ft=="VELOCITY":
    c=tuple(float(x) for x in ${comps}) if ${comps} is not None else (0,0,0)
    f=m.Velocity(name=name, createStepName=stepname, region=sel, v1=c[0], v2=c[1], v3=c[2], distributionType=UNIFORM)
else: raise ValueError("fieldType must be TEMPERATURE|STRESS|VELOCITY")
result={"field":f.name,"type":ft,"step":stepname,"region":${region}}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_set_output',
        description: 'Configure result output requests. outputType: FIELD (full-field contour data) or HISTORY (time series at a region). variables: array of output variables, e.g. ["S","U","RF"] (FIELD) or ["U","RF"] (HISTORY). Use frequency=1 (every increment), numberOfIntervals=N (fixed frames), or lastIncrement=true (final only). region+instance only for HISTORY (a node/region set).',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            step: { type: 'string', required: true, description: 'Step name to attach output on' },
            outputType: { type: 'string', required: true, enum: ['FIELD', 'HISTORY'], description: 'FIELD|HISTORY' },
            variables: { type: 'string', required: true, description: 'JSON array of variables, e.g. "[\"S\",\"U\",\"RF\"]"' },
            name: { type: 'string', description: 'Output request name (default F-Output/H-Output-N)' },
            frequency: { type: 'number', description: 'Record every N increments (FIELD)' },
            numberOfIntervals: { type: 'number', description: 'Only last+numberOfIntervals frames (FIELD)' },
            lastIncrement: { type: 'boolean', description: 'Only the last increment (FIELD)' },
            region: { type: 'string', description: 'Set name for HISTORY output' },
            instance: { type: 'string', description: 'Assembly instance for HISTORY region' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [{ type: 'text', text: `Output "${String(v.output ?? '')}" (${String(v.type ?? '')}) on step "${String(v.step ?? '')}" vars=${String(v.vars ?? '')}` }];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const step = JSON.stringify(String(args.step));
            const otype = String(args.outputType).toUpperCase();
            if (!['FIELD', 'HISTORY'].includes(otype))
                throw new Error('outputType must be FIELD|HISTORY');
            let vars;
            try {
                vars = JSON.parse(String(args.variables || '[]'));
            }
            catch {
                throw new Error('variables must be a valid JSON array');
            }
            if (!Array.isArray(vars) || vars.length === 0)
                throw new Error('variables must be a non-empty array');
            const name = args.name ? JSON.stringify(String(args.name)) : 'None';
            const region = args.region ? JSON.stringify(String(args.region)) : 'None';
            const inst = args.instance ? JSON.stringify(String(args.instance)) : 'None';
            const freq = args.frequency !== undefined && args.frequency !== null ? Number(args.frequency) : null;
            const nIntervals = args.numberOfIntervals !== undefined && args.numberOfIntervals !== null ? Number(args.numberOfIntervals) : null;
            const lastInc = args.lastIncrement === true;
            const kwfreq = freq !== null ? `kw['frequency']=${freq}` : '';
            const kwiv = nIntervals !== null ? `kw['numIntervals']=${nIntervals}` : '';
            const kwli = lastInc ? `kw['lastIncrement']=True` : '';
            const r = await runKernelCode(br, `from abaqus import mdb
m=mdb.models[${model}]
stepname=${step}
if stepname not in m.steps: raise ValueError("no such step: "+stepname)
name=${name}
otype=${JSON.stringify(otype)}
vars=tuple(${JSON.stringify(vars)})
region=${region}
inst_arg=${inst}
if name is None:
    repo = m.fieldOutputRequests if otype=="FIELD" else m.historyOutputRequests
    i=1; cand=("F-Output-"+str(i)) if otype=="FIELD" else ("H-Output-"+str(i))
    while cand in repo:
        i+=1; cand=("F-Output-"+str(i)) if otype=="FIELD" else ("H-Output-"+str(i))
    name=cand
if otype=="FIELD":
    kw={}
    ${kwfreq}
    ${kwiv}
    ${kwli}
    o=m.FieldOutputRequest(name=name, createStepName=stepname, variables=vars, **kw)
else:
    if region is None or inst_arg is None: raise ValueError("HISTORY output needs a region set + instance")
    sel=m.rootAssembly.instances[inst_arg].sets[region]
    o=m.HistoryOutputRequest(name=name, createStepName=stepname, variables=vars, region=sel, sectionPoint=None)
result={"output":o.name,"type":otype,"step":stepname,"vars":list(vars)}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
