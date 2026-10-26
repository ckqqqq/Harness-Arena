import {isAbsolute,parse,resolve} from 'node:path';
/** Shared scalar contract for generated configs and directly loaded Cordis overlays. */
export function validateConfiguration(config,{requireHostPort=false}={}){
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('Configuration must be an object');
  for(const key of ['pluginDir','dataDir','keyFile','dshDir','nodeDir','pythonDir','dockerPath'])if(typeof config[key]!=='string'||!isAbsolute(config[key]))throw new Error(`${key} must be an absolute path`);
  for(const key of ['dshDir','nodeDir','pythonDir']){const path=resolve(config[key]);if(path===parse(path).root||['/usr','/home','/opt'].includes(path))throw new Error(`${key} must identify a dedicated runtime directory`);}
  for(const key of ['host','gatewayHost'])if(typeof config[key]!=='string'||!config[key].trim()||/[\s/\\\0]/.test(config[key]))throw new Error(`${key} must be a nonempty bind address`);
  const ports=['port','gatewayPort',...(requireHostPort||config.hostPort!==undefined?['hostPort']:[])];
  for(const key of ports)if(!Number.isInteger(config[key])||config[key]<1024||config[key]>65535)throw new Error(`${key} must be a port from 1024 to 65535`);
  if(new Set(ports.map(key=>config[key])).size!==ports.length)throw new Error('The configured ports must differ');
  for(const key of ['timeoutSeconds','maxTurns','sketchTimeoutSeconds','sketchMaxImageBytes','sketchMaxOutputTokens','artifactMaxBytes','artifactTokenSeconds'])if(!Number.isSafeInteger(config[key])||config[key]<1)throw new Error(`${key} must be a positive safe integer`);
  for(const key of ['timeoutSeconds','sketchTimeoutSeconds'])if(config[key]>2147483)throw new Error(`${key} exceeds the supported timer range`);
  for(const key of ['model','sketchModel'])if(typeof config[key]!=='string'||!/^deepseek-[a-z0-9.-]+$/.test(config[key]))throw new Error(`${key} must be a DeepSeek model id`);
  if(typeof config.image!=='string'||!/^sha256:[a-f0-9]{64}$/.test(config.image))throw new Error('image must be a local Docker image sha256 digest');
  return config;
}
