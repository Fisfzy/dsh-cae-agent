import { defineTool } from '@deepseek-ai/dsh-tools';
import { runKernelCode } from '../core.js';
const VALID_ELEMENT_TYPES = ['SHELL', 'SOLID', 'CONTINUUM_SHELL', 'BEAM'];
export function registerComposite(ctx, config) {
    const br = { host: config.host, port: config.port };
    ctx.tools.register(defineTool({
        name: 'abaqus_define_composite_layup',
        description: 'Define a composite (layered) section on a part and assign it to a region. Each ply is a SectionLayer whose orientation angle is given by plyAngles (degrees, relative to the section/base orientation). Creates a CompositeShellSection (elementType=SHELL) or CompositeSolidSection (SOLID) on the model, then assigns it to the part faces (or a named part set). Options: model, part, material, plyAngles (array), plyThickness, elementType, sectionName, region.',
        parameters: {
            model: { type: 'string', required: true, description: 'Model name' },
            part: { type: 'string', required: true, description: 'Part name' },
            material: { type: 'string', required: true, description: 'Material name used by every ply' },
            plyAngles: {
                type: 'string',
                required: true,
                description: 'Array of ply orientation angles in degrees, e.g. "[0,90,0,90]"',
            },
            plyThickness: { type: 'number', required: true, description: 'Thickness of each ply in model units' },
            elementType: {
                type: 'string',
                enum: ['SHELL', 'SOLID', 'CONTINUUM_SHELL', 'BEAM'],
                description: 'Composite element type (default SHELL)',
            },
            sectionName: { type: 'string', description: 'Section name (default "<part>-Composite")' },
            region: {
                type: 'string',
                description: 'Part-level set name to assign the section to; default = whole part faces',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const v = (value ?? {});
                return [
                    {
                        type: 'text',
                        text: `Composite section "${String(v.section ?? '')}" (${String(v.elementType ?? '')}, ${String(v.numPlies ?? 0)} plies) assigned on part "${String(v.part ?? '')}"${v.region ? ` region=${String(v.region)}` : ''}.`,
                    },
                ];
            },
        },
        async execute(args, exec) {
            const model = JSON.stringify(String(args.model));
            const part = JSON.stringify(String(args.part));
            const material = JSON.stringify(String(args.material));
            const secName = args.sectionName ? JSON.stringify(String(args.sectionName)) : 'None';
            const region = args.region ? JSON.stringify(String(args.region)) : 'None';
            const elementType = String(args.elementType || 'SHELL').toUpperCase();
            if (!VALID_ELEMENT_TYPES.includes(elementType)) {
                throw new Error(`elementType must be ${VALID_ELEMENT_TYPES.join('|')}`);
            }
            // plyAngles may come in as a JSON array string or already-array.
            let angles;
            if (Array.isArray(args.plyAngles)) {
                angles = args.plyAngles;
            }
            else {
                angles = JSON.parse(String(args.plyAngles));
            }
            if (!Array.isArray(angles) || angles.length === 0) {
                throw new Error('plyAngles must be a non-empty array of numbers, e.g. "[0,90,0,90]"');
            }
            const plyThickness = Number(args.plyThickness);
            if (!Number.isFinite(plyThickness) || plyThickness <= 0) {
                throw new Error('plyThickness must be a positive number');
            }
            const anglesPy = JSON.stringify(angles);
            const r = await runKernelCode(br, `from abaqus import mdb
import section, regionToolset
from abaqusConstants import AXIS_3
m=mdb.models[${model}]
p=m.parts[${part}]
mat=${material}
secname=${secName}
reg=${region}
eles=${JSON.stringify(elementType)}
angles=${anglesPy}
tp=${plyThickness}
# default section name
if secname is None:
    secname=p.name+"-Composite"
# choose geometry collection by element type: SHELL->faces, SOLID->cells
if eles in ("SHELL","CONTINUUM_SHELL","BEAM"):
    gcol = p.sets[reg].faces if reg is not None else p.faces
    region = regionToolset.Region(faces=gcol)
else:
    gcol = p.sets[reg].cells if reg is not None else p.cells
    region = regionToolset.Region(cells=gcol)
# plies (each ply = a SectionLayer object)
layup=tuple(section.SectionLayer(thickness=tp, material=mat, orientAngle=a, axis=AXIS_3) for a in angles)
# create the composite section
Sect = m.CompositeShellSection if eles in ("SHELL","CONTINUUM_SHELL","BEAM") else m.CompositeSolidSection
sec = Sect(name=secname, layup=layup)
# (re)assign: drop any existing assignment of the same section name, then assign
for sa in list(p.sectionAssignments):
    if str(sa.sectionName)==secname:
        try: p.sectionAssignments.delete(sa)
        except Exception: pass
p.SectionAssignment(region=region, sectionName=secname)
result={"section":secname,"elementType":eles,"numPlies":len(layup),"part":${part},"region":reg,
        "assignments":[str(sa.sectionName) for sa in p.sectionAssignments]}`, config.timeoutMs, exec.signal);
            return r.value;
        },
        timeoutMs: config.timeoutMs,
        isConcurrencySafe: () => false,
    }));
}
