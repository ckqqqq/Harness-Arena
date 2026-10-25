export function buildModelPrompt(item){
  return `请实际完成以下 3D 建模任务：\n${item.brief}\n\n通用交付要求：环境已预装 Blender 4.0、Python、numpy；使用 Blender Python 建模，执行 blender --background --disable-autoexec -t 2 --python 你的脚本。不要下载安装软件、浏览器或第三方库，不要做截图或渲染。使用米制真实尺寸，以 z 为高度轴，应用必要变换；保留部件命名和多材质。将未压缩、自包含、含网格和材质的 GLB 导出为 /work/model.glb（export_format='GLB'），同时保留建模脚本。不要仅提供 HTML、图片或描述，不要把例子作为现成模型下载。检查导出文件存在并能重新导入，再简短说明。`;
}
