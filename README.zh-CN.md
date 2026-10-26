# DSH Studio

[案例长廊 / Case gallery](https://ckqqqq.github.io/Harness-Arena/) · [视频剪辑案例](docs/video-cases.md)
[English](README.md) · [文档导航](docs/README.zh-CN.md) · [安装说明](docs/installation.md) · [架构](docs/architecture.md)

独立的 DSH 插件：通过画图组合工作台，在同一页面比较 Claude Code、Codex、Hermes 和 DSH 的真实回复，统一使用 DeepSeek 模型。

![Four real harnesses generating 3D artifacts](docs/images/3d-showcase.png)

## 功能

- **白板布局**：矩形区域、自由画笔、移动、缩放、撤销，以及布局导入导出。
- **草图识别**：草图加一句说明交给 DeepSeek Flash，先预览草案，再采用、修改和保存。
- **可操作组件**：聊天、文件列表、文本预览/编辑和便笺。文件可附加到共享问题。
- **四栏真实运行**：四个原生 CLI、四份文件副本、四个独立会话；支持连续对话、停止及同一浏览器会话内的刷新恢复。
- **作品预览**：每栏自动发现GLB／自包含 glTF、HTML、MP4/WebM 和图片，支持交互、视频播放、放大和下载。
- **通用 3D 查看器**：旋转、缩放、平移、自动居中、线框、包围盒、部件高亮与尺寸统计，不依赖具体模型名称。
- **多案例验收**：机械支架、家具、曲面花瓶、关节台灯、探测车、室内场景；模型生成与独立几何检查分离。
- **视频工具链**：运行镜像预装 ffmpeg、Pillow、numpy 和 Noto CJK 字体，避免任务重复安装依赖。
- **主架构隔离**：通过 DSH overlay 加载，使用独立 profile home；不修改 DSH 核心循环。

当前是 Linux + Docker 实验项目。Windows 可以使用 WSL2 或 Linux 服务器作为执行主机。四栏的模型相同，但工具、系统指令、思考策略和协议不同，因此页面用于交互观察，不能直接当作严格公平的能力榜单。

## 安装

需要 Node 24 独立运行时、Docker、Git、uv，以及安装好依赖的 [DSH 源码](https://github.com/deepseek-ai/deepseek-harness)。

```bash
git clone https://github.com/ckqqqq/dsh-studio.git
cd dsh-studio
npm run install:harnesses
docker build -t dsh-studio-runtime:0.4 deploy
docker image inspect --format '{{.Id}}' dsh-studio-runtime:0.4
cp examples/config.json settings.json
```

编辑 `settings.json`，填写 DSH 路径、Node 运行时路径和镜像摘要。安装器会把 Python 运行时放进本项目的 `python-runtimes/`，通常不用再配置。不要把 `/usr` 等整个系统目录作为运行时挂载。

第一次配置时，通过环境变量提供密钥：

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm run configure -- settings.json
unset DEEPSEEK_API_KEY
npm run doctor
npm start
```

首次配置会创建仅当前用户可读的密钥文件，后续配置复用它；重配时不要再次设置密钥环境变量。工具不会覆盖已有密钥文件。

打开 `http://127.0.0.1:3081/`，输入 `data/access.token` 中的访问码。跨机器访问可用 SSH 隧道，或显式配置 UI 监听地址。详细参数、Docker 网桥、systemd 和依赖版本见[安装说明](docs/installation.md)。

## 使用

添加独立的建模案例插件，见[中文插件指南](docs/plugins.zh-CN.md)，包含服务注册、overlay 加载、卸载和 systemd 配置。

**四栏对比**：新建对话时，公共输入文件被复制四份；发送同一条任务后，各栏独立运行并保留自己的历史和文件。四栏发送会产生四次独立模型运行的费用。

**白板工作台**：可以直接画矩形并指定组件，也可以先画草图、写一句说明，再点“识别草图”。识别只发送线条、组件标题、布局和说明，不包含对话、文件正文或便笺内容。关闭草案不会改布局；“采用到白板”只改当前草案，“保存并使用布局”才会保存。

识别结果只使用四种预置组件，不执行模型生成的 HTML 或脚本。草图笔迹和便笺保存在浏览器中；布局导出包含笔迹。

每栏每轮默认最多 64 次模型请求、15 分钟。额度耗尽显示明确原因，保留部分输出、文件和会话，可继续对话。请求上限只统计放行的推理请求，不包含 token 估算或拒绝后的重试。

已保存的会话可通过 `/?conversation=<会话 UUID>` 直接打开，仍需插件访问码。

点击页头“演示模式”可隐藏输入区并扩展四栏，点击“退出演示”返回（主界面获得焦点时也支持 Esc）；各栏展示执行阶段与模型请求用量。

作品预览使用生成结束后的只读快照，单文件最大 100 MiB，链接有效期 10 分钟；过期后刷新作品。HTML 在无同源权限的沙箱中执行，禁止网络请求，仅支持内嵌脚本、样式和数据资源。

## 测试与数据

```bash
npm test
npm run check
```

测试不需要 API Key，也不启动真实模型。GitHub Actions 使用 Node 24/Linux 执行相同检查。此前原型的真实调用验证见[验证记录](docs/validation.md)，私人对话、密钥、访问码及现场配置不进入仓库。

`data/conversations/` 保存各栏会话、文件和原生事件；`data/proposals/` 保存成功的草图识别输入和输出。不要提交这些目录。容器只持有当前任务有效的转发凭据，真实 DeepSeek Key 留在服务端。

MIT 许可证仅适用于本项目代码，下游 harness 遵循各自许可证和服务条款。生产部署边界见 [SECURITY.md](SECURITY.md)。

## 3D 建模

在案例下拉框中选任务，点击“填入建模任务”后发送。案例只填入输入，不自动消耗模型额度。运行镜像预装 Blender 4.0。已有模型只要放入任意工作区的 GLB/glTF 文件，也会被同一个查看器发现；不用修改 UI。

查看器目前接收未压缩 GLB 和自包含 glTF 2.0，拒绝外部 URI、SVG 纹理、Draco 等需要额外解码器的必需扩展。支持内嵌 PNG/JPEG/WebP，设有像素、网格、层级和动画资源上限。尺寸显示采用 glTF 的米制 Y-up；独立 Blender 几何报告使用 Z-up。

可复用的案例定义在 `examples/3d-cases.json`，无需修改查看器。`node scripts/run-3d-cases.mjs --config config.local.json` 会让四个真实 CLI 逐案生成模型，并在无网络的独立容器中重新导入、测量。检查条件保存在模型工作区之外，结果保存在私有 `data/case-runs/`，可从页面选择记录。程序校验不能代替造型、工艺或工程审查，详情见 [3D 验证记录](docs/3d-validation.md)。

修改查看器源码后运行 `npm ci && npm run build:viewer`；构建产物随仓库提供，部署执行服务本身不需要安装前端依赖。

已有结果可用 `--recheck data/case-runs/<run-id>/summary.json` 重新验收，从不可变预览快照读取模型，不再调用四个模型。

## 扩展插件

独立 Cordis 插件可通过 `studioModelCases` 注册 3D 案例，卸载时自动撤销；重复 ID 和不支持的检查条件会报错。见 [插件开发](docs/plugins.md) 与 [可运行示例](examples/plugins/model-case/README.md)。注册案例不会自动调用模型。
