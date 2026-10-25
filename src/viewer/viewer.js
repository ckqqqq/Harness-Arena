import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {inspectModel} from '../model.mjs';
const $=id=>document.getElementById(id),status=$('status');
let renderer,controls,scene,camera,root,selection,rotation=false,box,grid;
const disposable=[];
function fail(error){status.textContent=error.message;status.className='error';}
async function main(){
  const token=new URLSearchParams(location.hash.slice(1)).get('artifact');if(!/^[a-f0-9]{48}$/.test(token||''))throw new Error('作品链接无效，请刷新作品');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x101723);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;$('stage').append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,0.01,100);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environmentMap=pmrem.fromScene(environment,.04);scene.environment=environmentMap.texture;scene.environmentIntensity=.7;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdbeeff,0x42404e,2));for(const [position,intensity]of [[[3,5,4],3],[[-4,2,-3],2]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);scene.add(light);}
  const response=await fetch('/artifact/'+token,{credentials:'omit'});if(!response.ok)throw new Error('预览已过期，请在工作台刷新作品');
  const data=await response.arrayBuffer();const isGLB=new DataView(data).getUint32(0,true)===0x46546c67;const report=inspectModel(data,isGLB?'model.glb':'model.gltf');
  // Admission rejects external URIs before the loader can request any resources.
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!url.startsWith('data:')&&!url.startsWith('blob:'))throw new Error('禁止加载模型外部资源');return url;});
  const result=await new GLTFLoader(manager).parseAsync(isGLB?data:new TextDecoder().decode(data),'');
  const original=result.scene;original.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(original),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(![...size.toArray(),...center.toArray()].every(Number.isFinite)||Math.max(...size.toArray())<=0)throw new Error('模型没有有限的空间尺寸');
  const factor=2.8/Math.max(...size.toArray());root=new THREE.Group();const centered=new THREE.Group();centered.position.copy(center).negate();centered.add(original);root.add(centered);root.scale.setScalar(factor);scene.add(root);root.updateMatrixWorld(true);
  grid=new THREE.GridHelper(6,24,0x425c75,0x253346);grid.position.y=-size.y*factor/2-.01;scene.add(grid);box=new THREE.Box3Helper(new THREE.Box3().setFromObject(root),0x7fdcc8);box.visible=false;scene.add(box);
  const meshes=[];original.traverse(o=>{if(o.isMesh){meshes.push(o);o.userData.studioMaterials=Array.isArray(o.material)?[...o.material]:o.material;}});
  $('metrics').textContent=`${report.nodes} 节点 · ${report.meshes} 网格 · ${report.renderedTriangles.toLocaleString()} 三角形 · ${report.materials} 材质`;
  $('dimensions').textContent='原始包围盒：'+size.toArray().map(v=>v.toPrecision(4)).join(' × ')+' m（glTF 单位）';
  const objectSelect=$('objects');for(const [i,o]of meshes.slice(0,512).entries()){const option=document.createElement('option');option.value=String(i);option.textContent=o.name||'Mesh '+(i+1);objectSelect.append(option);}
  objectSelect.onchange=()=>{if(selection){scene.remove(selection);selection.geometry.dispose();selection.material.dispose();selection=null;}if(objectSelect.value!==''){selection=new THREE.BoxHelper(meshes[Number(objectSelect.value)],0xffc975);scene.add(selection);}};
  $('wire').onchange=e=>{for(const mesh of meshes){if(e.target.checked){if(!mesh.userData.studioWire){const list=Array.isArray(mesh.userData.studioMaterials)?mesh.userData.studioMaterials:[mesh.userData.studioMaterials];const clones=list.map(m=>{const c=m.clone();c.wireframe=true;disposable.push(c);return c;});mesh.userData.studioWire=Array.isArray(mesh.userData.studioMaterials)?clones:clones[0];}mesh.material=mesh.userData.studioWire;}else mesh.material=mesh.userData.studioMaterials;}};
  $('bounds').onchange=e=>{box.visible=e.target.checked;};$('grid').onchange=e=>{grid.visible=e.target.checked;};$('rotate').onchange=e=>{rotation=e.target.checked;};
  function reset(){root.rotation.set(0,0,0);camera.position.set(3.5,2.4,4.2);controls.target.set(0,0,0);controls.update();}reset();$('reset').onclick=reset;
  $('stage').addEventListener('dblclick',()=>reset());const resize=new ResizeObserver(()=>{const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();});resize.observe($('stage'));
  let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(rotation)root.rotation.y+=dt*.3;controls.update();if(box.visible)box.box.setFromObject(root);if(selection)selection.update();renderer.render(scene,camera);});
  status.textContent='拖动旋转 · 滚轮缩放 · 右键平移';document.body.dataset.ready='true';
  addEventListener('pagehide',()=>{resize.disconnect();renderer.setAnimationLoop(null);controls.dispose();original.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});for(const m of disposable)m.dispose();environmentMap.dispose();renderer.dispose();},{once:true});
}
main().catch(fail);
