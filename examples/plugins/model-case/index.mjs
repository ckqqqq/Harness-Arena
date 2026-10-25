/** A real Cordis consumer plugin: registration lives exactly as long as its fiber. */
export const name='studio-example-model-case';
export const inject=['studioModelCases'];
export function apply(ctx){
  ctx.effect(()=>ctx.studioModelCases.register('example-ring-pack',[{
    id:'example-ring',title:'Parametric ring',
    brief:'Create a freestanding ring with outer diameter 0.12 m, inner diameter 0.08 m, and height 0.02 m. Center x=y=0 with bottom z=0. Preserve the actual through-hole and use one metallic material.',
    checks:{dimensions:{x:[.119,.121],y:[.119,.121],z:[.019,.021]},minMeshes:1,minMaterials:1,rays:[{origin:[0,0,.03],target:[0,0,-.01],expect:'clear'},{origin:[.05,0,.03],target:[.05,0,-.01],expect:'blocked'}]}
  }]));
}
