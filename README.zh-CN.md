# DSH Studio

[English](README.md) · [安装说明](docs/installation.md) · [架构](docs/architecture.md)

独立的 DSH 插件：通过画图组合工作台，在同一页面比较 Claude Code、Codex、Hermes 和 DSH 的真实回复，统一使用 DeepSeek 模型。

## 功能

- **白板布局**：矩形区域、自由画笔、移动、缩放、撤销，以及布局导入导出。
- **草图识别**：草图加一句说明交给 DeepSeek Flash，先预览草案，再采用、修改和保存。
- **可操作组件**：聊天、文件列表、文本预览/编辑和便笺。文件可附加到共享问题。
- **四栏真实运行**：四个原生 CLI、四份文件副本、四个独立会话；支持连续对话、停止及同一浏览器会话内的刷新恢复。
- **主架构隔离**：通过 DSH overlay 加载，使用独立 profile home；不修改 DSH 核心循环。

当前是 Linux + Docker 实验项目。Windows 可以使用 WSL2 或 Linux 服务器作为执行主机。四栏的模型相同，但工具、系统指令、思考策略和协议不同，因此页面用于交互观察，不能直接当作严格公平的能力榜单。

## 安装

需要 Node 24 独立运行时、Docker、Git、uv，以及安装好依赖的 [DSH 源码](https://github.com/deepseek-ai/deepseek-harness)。

```bash
git clone https://github.com/ckqqqq/dsh-studio.git
cd dsh-studio
npm run install:harnesses
docker build -t dsh-studio-runtime:0.2 deploy
docker image inspect --format '{{.Id}}' dsh-studio-runtime:0.2
cp examples/config.json settings.json
```

编辑 `settings.json`，填写 DSH 路径、Node 运行时路径和镜像摘要。安装器会把 Python 运行时放进本项目的 `python-runtimes/`，通常不用再配置。不要把 `/usr` 等整个系统目录作为运行时挂载。

第一次配置时，通过环境变量提供密钥：

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm run configure -- settings.json
unset DEEPSEEK_API_KEY
npm start
```

首次配置会创建仅当前用户可读的密钥文件，后续配置复用它；重配时不要再次设置密钥环境变量。工具不会覆盖已有密钥文件。

打开 `http://127.0.0.1:3081/`，输入 `data/access.token` 中的访问码。跨机器访问可用 SSH 隧道，或显式配置 UI 监听地址。详细参数、Docker 网桥、systemd 和依赖版本见[安装说明](docs/installation.md)。

## 使用

**四栏对比**：新建对话时，公共输入文件被复制四份；发送同一条任务后，各栏独立运行并保留自己的历史和文件。四栏发送会产生四次独立模型运行的费用。

**白板工作台**：可以直接画矩形并指定组件，也可以先画草图、写一句说明，再点“识别草图”。识别只发送线条、组件标题、布局和说明，不包含对话、文件正文或便笺内容。关闭草案不会改布局；“采用到白板”只改当前草案，“保存并使用布局”才会保存。

识别结果只使用四种预置组件，不执行模型生成的 HTML 或脚本。草图笔迹和便笺保存在浏览器中；布局导出包含笔迹。

## 测试与数据

```bash
npm test
npm run check
```

测试不需要 API Key，也不启动真实模型。GitHub Actions 使用 Node 24/Linux 执行相同检查。此前原型的真实调用验证见[验证记录](docs/validation.md)，私人对话、密钥、访问码及现场配置不进入仓库。

`data/conversations/` 保存各栏会话、文件和原生事件；`data/proposals/` 保存成功的草图识别输入和输出。不要提交这些目录。容器只持有当前任务有效的转发凭据，真实 DeepSeek Key 留在服务端。

MIT 许可证仅适用于本项目代码，下游 harness 遵循各自许可证和服务条款。生产部署边界见 [SECURITY.md](SECURITY.md)。
