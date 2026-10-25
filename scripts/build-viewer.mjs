import {build} from 'esbuild';
await build({entryPoints:['src/viewer/viewer.js'],bundle:true,format:'iife',minify:true,legalComments:'eof',outfile:'src/public/model-viewer.js',target:['es2022']});
