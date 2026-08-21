/**
 * tools/material.js — Tier 2 controlled modeling: material definition and
 * section assignment. Parameter design follows FEA best practice (units
 * mm-t-s-N-MPa, elastic/plastic/thermal properties, section-type selection),
 * adapted from the CAE-Agent-Hub abaqus-material methodology — all generated
 * code is written here from scratch.
 */
import { registerTool, runKernelCode } from '../core.js';

// Freeze shared property tables (used only for validation/description in the
// generated code; the API surface is Abaqus's own Python objects).
const VALID_SECTION_TYPES = ['solid', 'shell', 'beam'];
const VALID_SHAPE_TYPES = ['SOLID', 'SHELL', 'BEAM'];

export function register(ctx, config) {
  registerTool(ctx, config, {
    name: 'abaqus_create_material',
    description:
      'Create an Abaqus material and place it on the given model. `props` is a JSON object mapping property names to values, e.g. ' +
      '{"elastic":{"E":210000,"nu":0.3},"density":{"density":7.85e-9},"plastic":{"table":[[250,0],[300,0.02]]}}. ' +
      'Supported keys: elastic {E,nu} (MPa, unitless), density {density} (t/mm^3), plastic {table:[[yieldStress,plasticStrain],...]}, ' +
      'thermal {conductivity, expansionCoefficient, specificHeat} (W/m/K and 1/K). Units follow the mm-tonne-s-N-MPa system.',
    params: {
      model: { type: 'string', required: true, description: 'Model name (e.g. "Model-1")' },
      name: { type: 'string', required: true, description: 'Desired material name (e.g. "Steel")' },
      props: { type: 'string', required: true, description: 'JSON string of properties (see tool description)' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const name = JSON.stringify(String(args.name));
      const props = JSON.parse(String(args.props || '{}'));
      const code = `from abaqus import mdb
m=mdb.models[${model}]
mat=m.Material(name=${name})
def _ensure(o,k): 
    if k not in o: return {} 
    return o[k]
add=mat.elastic
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
result={"model":${model},"name":mat.name,"materialExists":mat.name in m.materials,"properties":${JSON.stringify(props)}}`;
      return runKernelCode(br, code);
    },
  });

  registerTool(ctx, config, {
    name: 'abaqus_assign_section',
    description:
      'Create a section referencing an existing material and assign it to a region of a part. Region is chosen by a named set on the part/assembly, or by bare geometric cell/face/edge indices (0-based). sectionType: solid|shell|beam. thickness only for shell, profile only for beam.',
    params: {
      model: { type: 'string', required: true, description: 'Model name' },
      part: { type: 'string', required: true, description: 'Part name' },
      material: { type: 'string', required: true, description: 'Existing material name' },
      sectionName: { type: 'string', description: 'Desired section name (default \\"<part>-Section\\")' },
      sectionType: { type: 'string', description: 'solid|shell|beam (default solid)' },
      region: { type: 'string', description: 'Named set on the part to assign the section to. If omitted, assigns to all cells/faces/edges of the part by type.' },
      thickness: { type: 'number', description: 'Shell thickness (only for shell sections)' },
    },
    executeImpl: async (args, _exec, br) => {
      const model = JSON.stringify(String(args.model));
      const part = JSON.stringify(String(args.part));
      const mat = JSON.stringify(String(args.material));
      const secName = JSON.stringify(String(args.sectionName || args.part + '-Section'));
      const stype = String(args.sectionType || 'solid').toLowerCase();
      if (!VALID_SECTION_TYPES.includes(stype)) throw new Error('sectionType must be solid|shell|beam');
      const region = args.region ? JSON.stringify(String(args.region)) : null;
      const code = `from abaqus import mdb
from abaqusConstants import SPECIFY_THICKNESS
m=mdb.models[${model}]
p=m.parts[${part}]
stype=${JSON.stringify(stype)}
secname=${secName}
# create (replace) the section
if secname in m.sections: del m.sections[secname]
if stype=="solid":
    sec=m.HomogeneousSolidSection(name=secname, material=${mat})
elif stype=="shell":
    sec=m.HomogeneousShellSection(name=secname, material=${mat}, thicknessType=SPECIFY_THICKNESS, thickness=${Number(args.thickness ?? 1.0)})
else:
    raise ValueError("beam section creation needs a profile; use abaqus_run_python")
# select region
if ${region !== null ? 'true' : 'false'}:
    reg=p.sets[${region}]
else:
    if stype=="solid" and len(p.cells):
        reg=p.Set(name=secname+"-AllCells", cells=p.cells)
    elif stype=="shell" and len(p.faces):
        reg=p.Set(name=secname+"-AllFaces", faces=p.faces)
    elif len(p.edges):
        reg=p.Set(name=secname+"-AllEdges", edges=p.edges)
    else:
        raise RuntimeError("No assignable region (cells/faces/edges) on part "+${part})
p.SectionAssignment(region=reg, sectionName=secname)
result={"model":${model},"part":${part},"section":secname,"material":${mat},"type":stype,"assignedRegion":reg.name}`;
      return runKernelCode(br, code);
    },
  });
}
