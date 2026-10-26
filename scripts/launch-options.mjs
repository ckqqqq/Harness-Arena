import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';

export const launchHelp='Usage: npm start -- [--patch PATH]...\nAdditional trusted DSH overlays load after the generated Studio overlay, in order.\nRelative paths resolve from the current working directory.';

export function parseLaunchOptions(args,cwd=process.cwd()){
  if(args.length===1&&['--help','-h'].includes(args[0]))return {help:true,patches:[]};
  const patches=[];
  for(let i=0;i<args.length;i++){
    if(args[i]!=='--patch'||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Expected --patch PATH; use --help for usage.');
    patches.push(resolve(cwd,args[++i]));
  }
  return {help:false,patches};
}

export async function validatePatches(paths){
  for(const path of paths){
    let overlay;
    try{overlay=JSON.parse(await readFile(path,'utf8'));}catch{throw new Error('An additional overlay is unreadable or contains invalid JSON.');}
    if(!Array.isArray(overlay))throw new Error('An additional overlay must be a JSON array of DSH patch operations.');
  }
}

export function patchArguments(base,extras){return [base,...extras].flatMap(path=>['--patch',path]);}
