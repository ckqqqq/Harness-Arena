"""Run inside Blender: --background --disable-autoexec --python ... -- --input ... --output ... [--checks ...]."""
import argparse,json,sys,math
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_checks import interval_check

p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--checks');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(a.input).resolve()))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
if not points:raise ValueError('No mesh geometry')
lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
report={'meshes':len(meshes),'materials':len({slot.material.name for o in meshes for slot in o.material_slots if slot.material}),'bounds':{'min':lo,'max':hi},'dimensions':[hi[i]-lo[i] for i in range(3)],'vertices':0,'triangles':0,'boundaryEdges':0,'nonManifoldEdges':0,'objects':[],'checks':[]}
for o in meshes:
    m=o.data;m.calc_loop_triangles();report['vertices']+=len(m.vertices);report['triangles']+=len(m.loop_triangles)
    bm=bmesh.new();bm.from_mesh(m);report['boundaryEdges']+=sum(e.is_boundary for e in bm.edges);report['nonManifoldEdges']+=sum(not e.is_manifold for e in bm.edges);bm.free()
    report['objects'].append({'name':o.name,'parent':o.parent.name if o.parent else None,'vertices':len(m.vertices),'triangles':len(m.loop_triangles)})
if a.checks:
    checks=json.loads(Path(a.checks).read_text())
    for axis,interval in checks.get('dimensions',{}).items():
        value=report['dimensions']['xyz'.index(axis)];report['checks'].append({'name':'dimension.'+axis,**interval_check(value,interval)})
    for key,field in [('minMeshes','meshes'),('minMaterials','materials')]:
        if key in checks:report['checks'].append({'name':key,'actual':report[field],'expected':checks[key],'passed':report[field]>=checks[key]})
    deps=bpy.context.evaluated_depsgraph_get()
    for i,ray in enumerate(checks.get('rays',[])):
        origin=Vector(ray['origin']);delta=Vector(ray['target'])-origin
        hit=bpy.context.scene.ray_cast(deps,origin,delta.normalized(),distance=delta.length)[0];actual='blocked' if hit else 'clear'
        report['checks'].append({'name':'ray.'+str(i),'actual':actual,'expected':ray['expect'],'passed':actual==ray['expect']})
report['finite']=all(math.isfinite(v) for v in lo+hi);report['passed']=report['finite'] and all(c['passed'] for c in report['checks'])
Path(a.output).write_text(json.dumps(report,indent=2,ensure_ascii=False))
print('MODEL_REPORT '+json.dumps({k:report[k] for k in ['meshes','materials','dimensions','vertices','triangles','passed']}))
