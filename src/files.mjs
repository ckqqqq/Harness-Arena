import {realpath,lstat,readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
/** Resolve existing files and new leaf files inside the private workspace, rejecting symlinks. */
export async function workspacePath(root, name, create=false) {
  if (typeof name !== 'string' || name.includes('\0') || name.includes('\\') || name.split('/').includes('..') || isAbsolute(name)) throw new Error('文件路径不允许');
  const base=await realpath(root), dest=resolve(base,name);
  if (relative(base,dest).startsWith('..')) throw new Error('文件超出工作区');
  let cursor=base;
  for (const part of relative(base,dest).split(sep).filter(Boolean)) {
    cursor=resolve(cursor,part);
    try {if ((await lstat(cursor)).isSymbolicLink()) throw new Error('不允许符号链接');}
    catch(error) {if (!(create && cursor===dest && error.code==='ENOENT')) throw error;}
  }
  return dest;
}
export async function listFiles(root,name='') {
  const dir=await workspacePath(root,name);
  return (await readdir(dir,{withFileTypes:true})).filter(x=>!x.isSymbolicLink()).slice(0,300).map(x=>({name:x.name,path:[name,x.name].filter(Boolean).join('/'),directory:x.isDirectory()})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));
}
export async function getFile(root,name) {
  const path=await workspacePath(root,name), info=await lstat(path);
  if (!info.isFile() || info.size>262144) throw new Error('只支持 256 KB 以内的文本文件');
  const text=await readFile(path,'utf8'); if(text.includes('\0')) throw new Error('不支持二进制文件'); return text;
}
export async function putFile(root,name,text,createOnly=false) {
  if(typeof text!=='string'||Buffer.byteLength(text)>262144) throw new Error('文本超过 256 KB');
  const path=await workspacePath(root,name,true); await writeFile(path,text,{mode:0o600,flag:createOnly?'wx':'w'});
}
