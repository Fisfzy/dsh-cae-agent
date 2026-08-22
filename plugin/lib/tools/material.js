import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode } from '../core.js';
const VALID_SECTION_TYPES = ['solid', 'shell', 'beam'];
export function registerMaterial(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_create_material',
        description: 'Create an Abaqus material and place it on the given model. `props` is a JSON object mapping property names to values, e.g. ' +
            '{"elastic":{"E":210000,"nu":0.3},"density":{"density":7.85e-9},"plastic":{"table":[[250,0],[300,0.02]]}}. ' +
            'Supported keys: elastic {E,nu} (MPa), density {density} (t/mm^3), plastic {table:[[yieldStress,plasticStrain],...]}, ' +
            'thermal {conductivity, expansionCoefficient, specificHeat}. Units follow the mm-tonne-s-N-MPa system.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name (e.g. "Model-1")' },
            name: { type: 'string', required: true, description: 'Desired material name (e.g. "Steel")' },
            props: { type: 'string', required: true, description: 'JSON string of properties (see tool description)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Material "${String(v.name ?? '')}" on model "${String(v.model ?? '')}" (registered=${String(v.materialExists ?? false)})` },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const name = JSON.stringify(String(args.name));
            let props;
            try {
                props = JSON.parse(String(args.props || '{}'));
            }
            catch {
                throw new Error('props must be a valid JSON object string');
            }
            const r = await runKernelCode(br, `from abaqus import mdb
m=mdb.models[${model}]
mat=m.Material(name=${name})
def _ensure(o,k): 
    if k not in o: return {} 
    return o[k]
el=_ensure(${JSON.stringify(props)},"elastic")
if el:
    mat.Elastic(table=[[float(el.get("E",200000.0)), float(el.get("nu",0.3))]])
dens=_ensure(${JSON.stringify(props)},"density")
if dens:
    mat.Density(table=[[float(dens.get("density",0.0))]])
pl=_ensure(${JSON.stringify(props)},"plastic")
if pl and pl.get("table"):
    mat.Plastic(table=[list(map(float,r)) for r in pl["table"]])
th=_ensure(${JSON.stringify(props)},"thermal")
if th:
    if th.get("conductivity") is not None: mat.Conductivity(table=[[float(th["conductivity"])]])
    if th.get("specificHeat") is not None: mat.SpecificHeat(table=[[float(th["specificHeat"])]])
result={"model":${model},"name":mat.name,"materialExists":mat.name in m.materials,"properties":${JSON.stringify(props)}}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
    ctx.tools.register(defineTool({
        name: 'abaqus_assign_section',
        description: 'Create a section referencing an existing material and assign it to a region of a part. Region is chosen by a named set on the part/assembly, or by bare geometric cell/face/edge indices (0-based). sectionType: solid|shell|beam (auto-selected from geometry when omitted: cells->solid, faces->shell). thickness only for shell.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            part: { type: 'string', required: true, description: 'Part name' },
            material: { type: 'string', required: true, description: 'Existing material name' },
            sectionName: { type: 'string', description: 'Desired section name (default "<part>-Section")' },
            sectionType: { type: 'string', enum: ['solid', 'shell', 'beam'], description: 'solid|shell|beam (default solid)' },
            region: {
                type: 'string',
                description: 'Named set on the part to assign the section to. If omitted, assigns to all cells/faces/edges of the part by type.',
            },
            thickness: { type: 'number', description: 'Shell thickness (only for shell sections)' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    { type: 'text', text: `Section "${String(v.section ?? '')}" assigned on part "${String(v.part ?? '')}" (material ${String(v.material ?? '')})` },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const part = JSON.stringify(String(args.part));
            const mat = JSON.stringify(String(args.material));
            const secName = JSON.stringify(String(args.sectionName || `${args.part}-Section`));
            // Auto-adapt section type to the part's geometry when not explicitly given:
            // solid if the part has cells, otherwise shell if it has faces (this is
            // the common failure mode: defaulting to "solid" on a shell/2D part).
            const explicitType = args.sectionType ? String(args.sectionType).toLowerCase() : undefined;
            const region = args.region ? JSON.stringify(String(args.region)) : 'None';
            const requestedType = JSON.stringify(explicitType || '').toLowerCase();
            const r = await runKernelCode(br, `from abaqus import mdb
from abaqusConstants import UNIFORM
m=mdb.models[${model}]
p=m.parts[${part}]
# choose the section type from geometry when not specified
requested=${requestedType}
if requested and requested not in ("solid","shell","beam"):
    raise ValueError("sectionType must be solid|shell|beam")
if not requested:
    if len(p.cells) > 0:
        stype="solid"
    elif len(p.faces) > 0:
        stype="shell"
    else:
        raise RuntimeError("cannot infer sectionType: part has neither cells nor faces; pass sectionType explicitly")
else:
    stype=requested
if stype not in ("solid","shell","beam"):
    raise ValueError("sectionType must be solid|shell|beam")
secname=${secName}
# create (replace) the section
if secname in m.sections: del m.sections[secname]
if stype=="solid":
    sec=m.HomogeneousSolidSection(name=secname, material=${mat})
elif stype=="shell":
    sec=m.HomogeneousShellSection(name=secname, material=${mat}, thicknessType=UNIFORM, thickness=${Number(args.thickness ?? 1.0)})
else:
    raise ValueError("beam section creation needs a profile; use abaqus_run_python")
# select region
constrained_region=${region}   # JSON string name, or null when omitted
regname=secname+"-AllCells" if stype=="solid" else secname+"-AllFaces"
if constrained_region is not None:
    reg=p.sets[constrained_region]
    regname=constrained_region
else:
    if stype=="solid" and len(p.cells):
        reg=p.Set(name=secname+"-AllCells", cells=p.cells)
        regname=secname+"-AllCells"
    elif stype=="shell" and len(p.faces):
        reg=p.Set(name=secname+"-AllFaces", faces=p.faces)
        regname=secname+"-AllFaces"
    elif len(p.edges):
        reg=p.Set(name=secname+"-AllEdges", edges=p.edges)
        regname=secname+"-AllEdges"
    else:
        raise RuntimeError("No assignable region (cells/faces/edges) on part "+${part})
p.SectionAssignment(region=reg, sectionName=secname)
result={"model":${model},"part":${part},"section":secname,"material":${mat},"type":stype,"assignedRegion":regname}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
