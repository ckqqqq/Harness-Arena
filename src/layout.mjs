/** Validate the persisted declarative layout; arbitrary scripts and HTML are never accepted. */
export function validateLayout(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.components) || value.components.length > 24) throw new Error('布局格式错误，最多 24 个组件');
  const ids = new Set();
  return {version:1,components:value.components.map(c => {
    if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(c.id) || ids.has(c.id)) throw new Error('组件 ID 错误或重复');
    ids.add(c.id);
    if (!['chat','files','preview','note'].includes(c.type)) throw new Error('未知组件');
    for (const k of ['x','y','w','h']) if (!Number.isFinite(c[k]) || c[k] < 0 || c[k] > 100) throw new Error('坐标错误');
    if (c.w < 8 || c.h < 8 || c.x+c.w > 100.01 || c.y+c.h > 100.01) throw new Error('组件超出白板');
    return {id:c.id,type:c.type,x:c.x,y:c.y,w:c.w,h:c.h,title:String(c.title||'').slice(0,120)};
  })};
}
export const initialLayout = {version:1,components:[{id:'chat',type:'chat',x:0,y:0,w:68,h:100,title:'DSH 对话'},{id:'files',type:'files',x:70,y:0,w:30,h:47,title:'工作区文件'},{id:'preview',type:'preview',x:70,y:50,w:30,h:50,title:'文件预览'}]};
