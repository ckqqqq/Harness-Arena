/** Owned registrations for the currently supported 3D task/inspection contract. */
const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const finiteVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function validateModelCases(value){
  if(!Array.isArray(value)||value.length>64)throw new Error('A model-case pack must contain at most 64 cases');
  const ids=new Set();
  return value.map(c=>{
    if(!c||typeof c.id!=='string'||!idPattern.test(c.id)||ids.has(c.id))throw new Error('Invalid or duplicate model-case id');ids.add(c.id);
    if(typeof c.title!=='string'||!c.title.trim()||c.title.length>120||typeof c.brief!=='string'||!c.brief.trim()||c.brief.length>16000)throw new Error('Invalid model-case title or brief');
    const checks=c.checks===undefined?{}:c.checks;if(!checks||typeof checks!=='object'||Array.isArray(checks)||Object.keys(checks).some(k=>!['dimensions','minMeshes','minMaterials','rays'].includes(k)))throw new Error('Unsupported model-case checks');
    const dimensions={};if(checks.dimensions!==undefined){if(!checks.dimensions||typeof checks.dimensions!=='object'||Array.isArray(checks.dimensions))throw new Error('Invalid dimensions');for(const [axis,bounds]of Object.entries(checks.dimensions)){if(!['x','y','z'].includes(axis)||!Array.isArray(bounds)||bounds.length!==2||!bounds.every(v=>Number.isFinite(v)&&v>=0)||bounds[0]>bounds[1])throw new Error('Invalid dimension interval');dimensions[axis]=[...bounds];}}
    const normalized={};if(checks.dimensions!==undefined)normalized.dimensions=dimensions;
    for(const key of ['minMeshes','minMaterials'])if(checks[key]!==undefined){if(!Number.isInteger(checks[key])||checks[key]<0||checks[key]>4096)throw new Error('Invalid minimum count');normalized[key]=checks[key];}
    if(checks.rays!==undefined){if(!Array.isArray(checks.rays)||checks.rays.length>128)throw new Error('Invalid ray checks');normalized.rays=checks.rays.map(r=>{if(!r||!finiteVector(r.origin)||!finiteVector(r.target)||r.origin.every((v,i)=>v===r.target[i])||!['clear','blocked'].includes(r.expect))throw new Error('Invalid ray segment');return {origin:[...r.origin],target:[...r.target],expect:r.expect};});}
    return {id:c.id,title:c.title,brief:c.brief,checks:normalized};
  });
}
export class ModelCaseRegistry {
  #packs=new Map();#closed=false;
  register(owner,cases){
    if(this.#closed)throw new Error('Model-case registry is closed');if(typeof owner!=='string'||!idPattern.test(owner)||this.#packs.has(owner))throw new Error('Invalid or duplicate case-pack owner');
    const normalized=validateModelCases(cases),existing=new Set(this.list().map(c=>c.id));if(normalized.some(c=>existing.has(c.id)))throw new Error('Model-case id already registered');
    if(existing.size+normalized.length>256)throw new Error('Model-case registry exceeds 256 cases');
    const registration={cases:normalized};this.#packs.set(owner,registration);let disposed=false;
    return ()=>{if(disposed)return;disposed=true;if(this.#packs.get(owner)===registration)this.#packs.delete(owner);};
  }
  list(){return structuredClone([...this.#packs.values()].flatMap(p=>p.cases));}
  close(){this.#closed=true;this.#packs.clear();}
}
export function parseModelCaseCatalog(value){if(!value||value.version!==1)throw new Error('Unsupported model-case catalog version');return validateModelCases(value.cases);}
