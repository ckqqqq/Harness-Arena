import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const cases=JSON.parse(await readFile(join(root,'site/cases.json'),'utf8'));
const lanes=[['claude','Claude Code'],['codex','Codex'],['hermes','Hermes'],['dsh','DSH']];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=[];
for(const c of cases){
  if(!c.images&&!c.videos)continue;
  const figures=[];
  for(const [id,name]of lanes){
    if(c.videos){
      const video=c.videos[id],poster=c.images?.[id];
      if(typeof video!=='string'||!/^media\/[a-z0-9-]+\.mp4$/.test(video)||typeof poster!=='string'||!/^images\/[a-z0-9-]+\.jpg$/.test(poster))throw Error('Invalid gallery video');
      await access(join(root,'site',video));await access(join(root,'site',poster));
      figures.push(`<figure><figcaption>${name}</figcaption><video controls playsinline preload="none" poster="${poster}" aria-label="${escape(c.title)} — ${name}"><source src="${video}" type="video/mp4"></video></figure>`);
      continue;
    }
    const path=c.images[id];
    if(typeof path!=='string'||!/^images\/[a-z0-9-]+\.jpg$/.test(path))throw Error('Invalid gallery image');
    await access(join(root,'site',path));
    figures.push(`<figure><figcaption>${name}</figcaption><img src="${path}" width="600" height="278" loading="${sections.length?'lazy':'eager'}" decoding="async" alt="${escape(c.title)} — ${name}"></figure>`);
  }
  sections.push(`<section id="${escape(c.id)}"><h2><span>${String(sections.length+1).padStart(2,'0')}</span>${escape(c.title)}</h2><div class="comparison">${figures.join('')}</div></section>`);
}
await writeFile(join(root,'site/index.html'),`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Harness-Arena 四栏作品长廊"><title>Harness-Arena · Gallery</title><link rel="stylesheet" href="style.css?v=2"></head>
<body><header><h1>HARNESS ARENA<span>作品长廊</span></h1><a href="https://github.com/ckqqqq/Harness-Arena">GitHub ↗</a></header><main>${sections.join('\n')}</main><footer><a href="https://github.com/ckqqqq/Harness-Arena/blob/main/docs/3d-validation.md">实验记录 ↗</a></footer></body></html>\n`);
console.log(`Built ${sections.length} image rows, without client JavaScript or runtime JSON requests.`);
