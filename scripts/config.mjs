import {isAbsolute,resolve,join} from 'node:path';
import {validateConfiguration} from '../src/configuration.mjs';
/** Resolve deployment paths once; all generated files stay outside tracked source. */
export function resolveConfig(input,root) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuration must be an object');
  const config={pluginDir:root,dataDir:join(root,'data'),keyFile:join(root,'private/deepseek.key'),pythonDir:join(root,'python-runtimes'),dockerPath:'/usr/bin/docker',host:'127.0.0.1',gatewayHost:'172.17.0.1',port:3081,gatewayPort:3083,hostPort:3082,model:'deepseek-flash',timeoutSeconds:900,maxTurns:64,sketchModel:'deepseek-flash',sketchTimeoutSeconds:90,sketchMaxImageBytes:2097152,sketchMaxOutputTokens:4096,artifactMaxBytes:104857600,artifactTokenSeconds:600,...input};
  config.pluginDir=root;
  for(const key of ['dshDir','nodeDir','pythonDir','dataDir','keyFile','dockerPath']) {
    if(typeof config[key]!=='string'||!isAbsolute(config[key]))throw new Error(`${key} must be an absolute path`);
    config[key]=resolve(config[key]);
  }
  return validateConfiguration(config,{requireHostPort:true});
}
