"""Optional Blender regression: solid substitutes must fail the declared void tests.
Run with this repository mounted at /repo and a writable /output directory.
These synthetic controls are not harness-generated performance evidence.
"""
import json,runpy,sys
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[2];out=Path('/output');cases={c['id']:c for c in json.loads((root/'examples/3d-cases.json').read_text())['cases']}
for name in ['bracket','vase']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if name=='bracket':
        bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.003));bpy.context.object.dimensions=(.12,.08,.006)
    else:bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.07,depth=.30,location=(0,0,.15))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB')
    (out/(name+'-checks.json')).write_text(json.dumps(cases[name]['checks']))
for name in ['bracket','vase']:
    sys.argv=['blender','--','--input',str(out/(name+'.glb')),'--output',str(out/(name+'-report.json')),'--checks',str(out/(name+'-checks.json'))]
    runpy.run_path(str(root/'scripts/inspect-model.py'),run_name='__main__')
    report=json.loads((out/(name+'-report.json')).read_text());rays=[c for c in report['checks'] if c['name'].startswith('ray.')]
    assert report['passed'] is False and rays[0]['passed'] is False and rays[-1]['passed'] is True
print('NEGATIVE_CONTROLS_PASSED')
