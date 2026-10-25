import {isAbsolute,resolve,join} from 'node:path';
/** Resolve deployment paths once; all generated files stay outside tracked source. */
export function resolveConfig(input,root) {
  const config={pluginDir:root,dataDir:join(root,'data'),keyFile:join(root,'private/deepseek.key'),pythonDir:join(root,'python-runtimes'),dockerPath:'/usr/bin/docker',host:'127.0.0.1',gatewayHost:'172.17.0.1',port:3081,gatewayPort:3083,hostPort:3082,model:'deepseek-flash',timeoutSeconds:240,maxTurns:16,sketchModel:'deepseek-flash',sketchTimeoutSeconds:90,sketchMaxImageBytes:2097152,sketchMaxOutputTokens:4096,...input};
  config.pluginDir=root;
  for(const key of ['dshDir','nodeDir','pythonDir','dataDir','keyFile','dockerPath']) {
    if(typeof config[key]!=='string'||!isAbsolute(config[key]))throw new Error(`${key} must be an absolute path`);
    config[key]=resolve(config[key]);
  }
  for(const key of ['dshDir','nodeDir','pythonDir'])if(['/','/usr','/home','/opt'].includes(config[key]))throw new Error(`${key} must identify a dedicated runtime directory`);
  for(const key of ['port','gatewayPort','hostPort'])if(!Number.isInteger(config[key])||config[key]<1024||config[key]>65535)throw new Error(`${key} must be a port from 1024 to 65535`);
  if(new Set([config.port,config.gatewayPort,config.hostPort]).size!==3)throw new Error('The three ports must differ');
  for(const key of ['model','sketchModel'])if(typeof config[key]!=='string'||!/^deepseek-[a-z0-9.-]+$/.test(config[key]))throw new Error(`${key} must be a DeepSeek model id`);
  if(typeof config.image!=='string'||!/^sha256:[a-f0-9]{64}$/.test(config.image))throw new Error('image must be a local Docker image sha256 digest');
  return config;
}
