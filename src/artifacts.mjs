import {readdir,lstat,open,mkdir,unlink,readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {constants} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {workspacePath} from './files.mjs';
import {inspectModel} from './model.mjs';
const formats={'.glb':'model/gltf-binary','.gltf':'model/gltf+json','.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
export const previewPolicy="sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; font-src data:; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";
export async function listArtifacts(root,maxBytes){
  const items=[];let visited=0;
  async function walk(dir,depth){
    if(depth>6||visited>2000)return;
    const path=await workspacePath(root,dir);
    const entries=await readdir(path,{withFileTypes:true});
    entries.sort((a,b)=>Number(a.isDirectory())-Number(b.isDirectory())||a.name.localeCompare(b.name));
    for(const e of entries){if(++visited>2000)return;if(e.isSymbolicLink()||e.name.startsWith('.')||['node_modules','__pycache__'].includes(e.name))continue;
      const name=[dir,e.name].filter(Boolean).join('/');
      if(e.isDirectory())await walk(name,depth+1);
      else if(formats[extname(e.name).toLowerCase()]){const info=await lstat(await workspacePath(root,name));if(info.size>0&&info.size<=maxBytes)items.push({path:name,bytes:info.size,type:formats[extname(name).toLowerCase()].split(';')[0]});}
    }
  }
  await walk('',0);return items.sort((a,b)=>(a.type==='text/html'?0:a.type.startsWith('video')?1:2)-(b.type==='text/html'?0:b.type.startsWith('video')?1:2)||a.path.localeCompare(b.path)).slice(0,32);
}
/** Grants expose one artifact, never the Studio access code or a directory capability. */
export class ArtifactPreviews {
  constructor({maxBytes,ttlSeconds,dir}){this.maxBytes=maxBytes;this.ttlSeconds=ttlSeconds;this.dir=dir;this.grants=new Map();this.pending=Promise.resolve();}
  async init(){await mkdir(this.dir,{recursive:true,mode:0o700});}
  async remove(token){const g=this.grants.get(token);if(!g)return;this.grants.delete(token);try{await unlink(join(g.root,g.path));}catch(error){if(error.code!=='ENOENT')throw error;}}
  async grant(root,path,withRead){
    const previous=this.pending;let release;this.pending=new Promise(resolve=>{release=resolve;});await previous;
    const token=randomBytes(24).toString('hex'),ext=extname(path).toLowerCase(),name=token+ext;
    try{
      if(!formats[ext])throw new Error('不支持的作品格式');
      for(const [key,g]of this.grants)if(g.expires<Date.now())await this.remove(key);
      if(this.grants.size>=32)await this.remove(this.grants.keys().next().value);
      await withRead(root,async()=>{
        const source=await open(await workspacePath(root,path),constants.O_RDONLY|(constants.O_NOFOLLOW||0));let target;
        try{const info=await source.stat();if(!info.isFile()||!info.size||info.size>this.maxBytes)throw new Error('作品为空或超过预览大小限制');
          target=await open(join(this.dir,name),'wx',0o600);let bytes=0;
          for await(const chunk of source.createReadStream({autoClose:false})){bytes+=chunk.length;if(bytes>this.maxBytes)throw new Error('作品超过预览大小限制');await target.writeFile(chunk);}
        }finally{await source.close();if(target)await target.close();}
      });
      if(ext==='.glb'||ext==='.gltf')inspectModel(await readFile(join(this.dir,name)),name);
      this.grants.set(token,{root:this.dir,path:name,label:path,expires:Date.now()+this.ttlSeconds*1000});return '/artifact/'+token;
    }catch(error){try{await unlink(join(this.dir,name));}catch(cleanup){if(cleanup.code!=='ENOENT')throw cleanup;}throw error;}
    finally{release();}
  }
  async dispose(){await Promise.all([...this.grants.keys()].map(key=>this.remove(key)));}
  async serve(req,res,token,canRead=()=>true){
    const grant=this.grants.get(token);if(!grant||grant.expires<Date.now()){res.writeHead(404);res.end();return;}
    if(!canRead(grant.root)){res.writeHead(409);res.end('工作区正在运行，请完成后刷新预览');return;}
    const path=await workspacePath(grant.root,grant.path),type=formats[extname(path).toLowerCase()];
    if(!type)throw new Error('不支持的作品格式');
    const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try{
      const stat=await handle.stat();if(!stat.isFile()||!stat.size||stat.size>this.maxBytes)throw new Error('作品为空或超过预览大小限制');
      let start=0,end=stat.size-1,partial=false;
      if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
        if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else start=Math.max(0,stat.size-Number(match[2]));
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}partial=true;
      }
      const headers={'Content-Type':type,'Content-Length':end-start+1,'Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':previewPolicy,'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'};
      if(type.startsWith('model/'))headers['Access-Control-Allow-Origin']='*';
      if(partial)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      if(new URL(req.url,'http://artifact').searchParams.get('download')==='1')headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(grant.label.split('/').pop());
      res.writeHead(partial?206:200,headers);
      const stream=handle.createReadStream({start,end,autoClose:false});const onClose=()=>stream.destroy();res.once('close',onClose);
      try{for await(const chunk of stream){if(res.destroyed)break;if(!res.write(chunk))await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});}res.end();}finally{res.off('close',onClose);stream.destroy();}
    }finally{await handle.close();}
  }
}
