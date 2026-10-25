/** Pure model admission checks, shared by the server and isolated browser viewer. */
export const modelLimits={bytes:104857600,nodes:4096,meshes:2048,materials:1024,textures:128,vertices:2000000,triangles:2000000};
const requiredExtensions=new Set(['KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_ior','KHR_materials_specular','KHR_materials_transmission','KHR_materials_volume','KHR_materials_emissive_strength','KHR_mesh_quantization']);
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
function requireModel(ok,message){if(!ok)throw new Error('模型校验：'+message);}
export function inspectModel(input,filename='model.glb'){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);requireModel(bytes.length>0&&bytes.length<=modelLimits.bytes,'文件为空或超过 100 MiB');
  let document,binBytes=0,binOffset=0;
  if(filename.toLowerCase().endsWith('.glb')){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);requireModel(bytes.length>=20,'GLB 头不完整');
    requireModel(view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2,'需要 glTF 2.0 GLB');requireModel(view.getUint32(8,true)===bytes.length,'GLB 声明长度与实际文件不符');
    let offset=12,chunks=0;
    while(offset<bytes.length){requireModel(offset+8<=bytes.length&&++chunks<=2,'GLB 分块结构无效');const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;requireModel(size%4===0&&offset+size<=bytes.length,'GLB 分块越界');
      if(chunks===1){requireModel(type===0x4e4f534a&&size<=4194304,'首块必须是小于 4 MiB 的 JSON');document=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+size)));}
      else{requireModel(type===0x004e4942,'第二块必须是 BIN');binBytes=size;binOffset=offset;}offset+=size;
    }
  }else{requireModel(bytes.length<=4194304,'文本 glTF JSON 超过 4 MiB，请使用 GLB');document=JSON.parse(new TextDecoder().decode(bytes));}
  const d=document;requireModel(d&&d.asset?.version==='2.0','需要 glTF 2.0');
  const list=k=>{requireModel(d[k]===undefined||Array.isArray(d[k]),k+' 必须是数组');return d[k]||[];};
  const nodes=list('nodes'),meshes=list('meshes'),materials=list('materials'),textures=list('textures'),buffers=list('buffers'),views=list('bufferViews'),accessors=list('accessors'),images=list('images');
  for(const [name,items,max]of [['nodes',nodes,4096],['meshes',meshes,2048],['materials',materials,1024],['textures',textures,128],['images',images,128],['accessors',accessors,16384],['bufferViews',views,16384]])requireModel(items.length<=max,name+' 超过资源上限');
  for(const ext of list('extensionsRequired'))requireModel(requiredExtensions.has(ext),'暂不支持必需扩展 '+ext+'；请导出未压缩模型');
  const checkRef=(value,items,label)=>requireModel(integer(value,items.length-1),label+' 引用无效');
  let embeddedBytes=0;
  const dataSize=(uri,image=false)=>{requireModel(typeof uri==='string','资源 URI 无效');const re=image?/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/:/^data:application\/(?:octet-stream|gltf-buffer);base64,([A-Za-z0-9+/]*={0,2})$/;const m=re.exec(uri);requireModel(m&&m[1].length%4===0,'只允许内嵌二进制及 PNG/JPEG/WebP 纹理，禁止外部资源');const size=m[1].length/4*3-(m[1].endsWith('==')?2:m[1].endsWith('=')?1:0);embeddedBytes+=size;requireModel(embeddedBytes<=modelLimits.bytes,'内嵌资源过大');return size;};
  buffers.forEach((b,i)=>{requireModel(b&&integer(b.byteLength,modelLimits.bytes),'buffer 长度无效');const size=b.uri!==undefined?dataSize(b.uri):i===0?binBytes:0;requireModel(b.byteLength<=size,'buffer 数据不足');});
  views.forEach(v=>{checkRef(v.buffer,buffers,'bufferView');requireModel(integer(v.byteOffset||0)&&integer(v.byteLength)&&Number.isSafeInteger((v.byteOffset||0)+v.byteLength)&&(v.byteOffset||0)+v.byteLength<=buffers[v.buffer].byteLength,'bufferView 越界');if(v.byteStride!==undefined)requireModel(integer(v.byteStride,252)&&v.byteStride>=4&&v.byteStride%4===0,'byteStride 无效');});
  const components={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
  accessors.forEach(a=>{requireModel(a&&integer(a.count,6000000)&&components[a.componentType]&&types[a.type],'accessor 无效');if(a.bufferView!==undefined){checkRef(a.bufferView,views,'accessor');const v=views[a.bufferView],component=components[a.componentType],columns=a.type==='MAT3'?3:a.type==='MAT2'?2:a.type==='MAT4'?4:1;const element=columns>1?columns*Math.ceil(columns*component/4)*4:component*types[a.type],stride=v.byteStride||element;requireModel(integer(a.byteOffset||0)&&stride>=element&&(a.byteOffset||0)+(a.count?stride*(a.count-1)+element:0)<=v.byteLength,'accessor 数据越界');}if(a.sparse){requireModel(integer(a.sparse.count,a.count),'sparse 数量无效');checkRef(a.sparse.indices?.bufferView,views,'sparse indices');checkRef(a.sparse.values?.bufferView,views,'sparse values');}});
  images.forEach(i=>{if(i.uri!==undefined)dataSize(i.uri,true);else{checkRef(i.bufferView,views,'image');requireModel(['image/png','image/jpeg','image/webp'].includes(i.mimeType),'纹理类型无效');}});
  const decoded=new Map();let texturePixels=0;
  const decode=uri=>Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0));
  for(const image of images){let data;if(image.uri)data=decode(image.uri);else{const v=views[image.bufferView];if(!decoded.has(v.buffer))decoded.set(v.buffer,buffers[v.buffer].uri?decode(buffers[v.buffer].uri):bytes.subarray(binOffset,binOffset+binBytes));data=decoded.get(v.buffer).subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let width=0,height=0;
    if(data.length>=24&&view.getUint32(0)===0x89504e47){width=view.getUint32(16);height=view.getUint32(20);}
    else if(data.length>=4&&data[0]===255&&data[1]===216){let p=2;while(p+8<data.length){if(data[p++]!==255)break;const marker=data[p++];if(marker===217||marker===218)break;const length=view.getUint16(p);if(length<2||p+length>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=view.getUint16(p+3);width=view.getUint16(p+5);break;}p+=length;}}
    else if(data.length>=25&&view.getUint32(0)===0x52494646&&view.getUint32(8)===0x57454250){const kind=view.getUint32(12);if(kind===0x56503858&&data.length>=30){width=1+data[24]+(data[25]<<8)+(data[26]<<16);height=1+data[27]+(data[28]<<8)+(data[29]<<16);}else if(kind===0x56503820&&data.length>=30){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}else if(kind===0x5650384c&&data[20]===47){const bits=view.getUint32(21,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}}
    requireModel(width>0&&height>0&&width<=8192&&height<=8192&&width*height<=16777216,'纹理头无效或超过像素上限');texturePixels+=width*height;requireModel(texturePixels<=33554432,'模型纹理累计超过 3200 万像素');
  }
  let vertices=0,triangles=0;
  meshes.forEach(m=>{requireModel(Array.isArray(m.primitives)&&m.primitives.length<=256,'网格 primitive 无效');m.primitives.forEach(p=>{checkRef(p.attributes?.POSITION,accessors,'POSITION');const a=accessors[p.attributes.POSITION];requireModel(a.type==='VEC3','POSITION 需要 VEC3');vertices+=a.count;let count=a.count;if(p.indices!==undefined){checkRef(p.indices,accessors,'indices');count=accessors[p.indices].count;}const mode=p.mode??4;requireModel(integer(mode,6),'primitive mode 无效');triangles+=mode===4?Math.floor(count/3):mode>=5?Math.max(0,count-2):0;if(p.material!==undefined)checkRef(p.material,materials,'material');});});
  requireModel(meshes.length&&vertices>0,'没有可显示的网格');requireModel(vertices<=modelLimits.vertices&&triangles<=modelLimits.triangles,'网格超过 200 万顶点或三角形上限');
  const parents=new Set(),marks=new Map();let instances=0;
  nodes.forEach(n=>{if(n.mesh!==undefined){checkRef(n.mesh,meshes,'node mesh');instances++;}for(const key of ['translation','rotation','scale','matrix'])if(n[key]!==undefined)requireModel(Array.isArray(n[key])&&n[key].length===(key==='matrix'?16:key==='rotation'?4:3)&&n[key].every(Number.isFinite),'节点变换无效');requireModel(n.extensions?.EXT_mesh_gpu_instancing===undefined,'暂不支持 GPU 实例扩展');if(n.children!==undefined)requireModel(Array.isArray(n.children),'children 无效');for(const child of n.children||[]){checkRef(child,nodes,'child');requireModel(!parents.has(child),'节点有多个父节点');parents.add(child);}});
  function visit(i,depth){requireModel(depth<128&&marks.get(i)!==1,'节点层级过深或存在环');if(marks.get(i)===2)return;marks.set(i,1);for(const child of nodes[i].children||[])visit(child,depth+1);marks.set(i,2);}nodes.forEach((_,i)=>visit(i,0));
  let renderedTriangles=0,renderedVertices=0;nodes.forEach(n=>{if(n.mesh!==undefined)for(const p of meshes[n.mesh].primitives){renderedVertices+=accessors[p.attributes.POSITION].count;const count=accessors[p.indices??p.attributes.POSITION].count;renderedTriangles+=(p.mode??4)===4?Math.floor(count/3):(p.mode??4)>=5?Math.max(0,count-2):0;}});requireModel(renderedTriangles<=modelLimits.triangles&&renderedVertices<=modelLimits.vertices,'实例化后超过 200 万顶点或三角形');
  const scenes=list('scenes');requireModel(scenes.length<=16,'场景数量过多');let expandedNodes=0;
  scenes.forEach(s=>{requireModel(Array.isArray(s.nodes||[]),'scene nodes 无效');const seen=new Set();function expand(i){checkRef(i,nodes,'scene node');requireModel(!seen.has(i)&&++expandedNodes<=8192,'重复或过多场景节点');seen.add(i);for(const child of nodes[i].children||[])expand(child);}for(const n of s.nodes||[])expand(n);});if(d.scene!==undefined)checkRef(d.scene,scenes,'default scene');
  const animations=list('animations'),skins=list('skins');requireModel(animations.length<=64&&skins.length<=128,'动画或骨骼数量过多');let samples=0,channels=0;
  animations.forEach(a=>{requireModel(Array.isArray(a.channels)&&Array.isArray(a.samplers),'动画结构无效');for(const c of a.channels){requireModel(++channels<=512,'动画通道过多');checkRef(c.sampler,a.samplers,'animation sampler');const sampler=a.samplers[c.sampler];checkRef(sampler.input,accessors,'animation input');checkRef(sampler.output,accessors,'animation output');samples+=accessors[sampler.input].count+accessors[sampler.output].count;requireModel(samples<=1000000,'动画采样过多');}});
  skins.forEach(s=>{requireModel(Array.isArray(s.joints)&&s.joints.length<=256,'骨骼数量无效');for(const joint of s.joints)checkRef(joint,nodes,'joint');if(s.inverseBindMatrices!==undefined)checkRef(s.inverseBindMatrices,accessors,'inverseBindMatrices');});
  let morphVertices=0;meshes.forEach(m=>m.primitives.forEach(p=>{requireModel(p.targets===undefined||Array.isArray(p.targets)&&p.targets.length<=32,'形态目标过多');for(const target of p.targets||[])for(const index of Object.values(target)){checkRef(index,accessors,'morph target');morphVertices+=accessors[index].count;requireModel(morphVertices<=2000000,'形态目标数据过多');}}));
  return {document:d,meshes:meshes.length,nodes:nodes.length,materials:materials.length,vertices,triangles,instances,renderedTriangles};
}
