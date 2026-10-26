/** A real Cordis consumer plugin: registration lives exactly as long as its fiber. */
import catalog from './cases.json' with {type:'json'};
import {parseModelCaseCatalog} from '../../../src/model-case-registry.mjs';
export const name='studio-example-model-case';
export const inject=['studioModelCases'];
export function apply(ctx){
  ctx.effect(()=>ctx.studioModelCases.register('example-ring-pack',parseModelCaseCatalog(catalog)));
}
