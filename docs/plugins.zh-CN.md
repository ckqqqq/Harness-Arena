# 插件开发与加载

[English reference](plugins.md) · [文档导航](README.zh-CN.md)

Studio 通过 DSH 的 Cordis 插件机制加载，入口为 `src/index.mjs`，依赖 `webServer`，提供 `studioModelCases`。其他插件可以消费这个服务，添加独立的建模任务包，不需要修改 DSH 核心循环或 Studio 内置案例。

目前开放的扩展接口是案例注册服务。它不能注册任意前端组件、工具或验收函数；白板仍使用聊天、文件、预览和便笺四种内置组件。

## 编写案例插件

可直接参考仓库中的 [ring 示例](../examples/plugins/model-case/README.md)。一个最小插件如下：

```js
export const name = 'my-model-cases';
export const inject = ['studioModelCases'];

export function apply(ctx) {
  ctx.effect(() => ctx.studioModelCases.register('my-pack', [{
    id: 'my-ring',
    title: '圆环',
    brief: '创建一个圆环，中心位于 x=y=0，底部 z=0，高度 0.02 米。',
    checks: { dimensions: { z: [0.019, 0.021] }, minMeshes: 1 }
  }]));
}
```

`register(owner, cases)` 会先验证整个任务包，再原子注册，返回可重复调用的清理函数。通过 `ctx.effect` 交给 Cordis 管理后，卸载插件会删除该插件的案例；服务替换时，依赖方会卸载并重新注入。

owner 和案例 ID 使用最长 64 字符的小写 slug。案例 ID 在所有任务包之间唯一，重复时拒绝注册；不能覆盖其他插件的案例。每包最多 64 个案例，服务总计最多 256 个。`list()` 返回独立副本，修改副本不会改变注册内容。

## 通过 overlay 加载

完成 Studio 配置后，在仓库下创建不进入 Git 的 `data/overlays/ring.json`，将路径替换为当前机器上的绝对路径：

```json
[
  {
    "insert": [
      {
        "id": "studio-example-model-case",
        "name": "/ABSOLUTE/PATH/dsh-studio/examples/plugins/model-case/index.mjs"
      }
    ]
  }
]
```

先等待当前任务结束并停止已有 Studio，再从仓库启动：

```sh
npm start -- --patch data/overlays/ring.json
```

可以重复传入 `--patch PATH`。额外 overlay 按参数顺序应用在自动生成的 Studio overlay 之后；相对路径以运行命令时的目录为准，带空格的路径应加引号。启动器在创建 DSH 子进程前检查文件可读、JSON 可解析且顶层是数组；具体操作由 DSH 验证。`npm start -- --help` 不需要 Linux 主机或已生成的配置。

打开页面并刷新案例记录，示例圆环会出现在案例选择器中。选择案例只填入任务，发送才会运行所选 harness 并消耗模型额度。移除对应 `--patch` 参数并重启即可卸载；程序内也可以直接 dispose 对应 Cordis fiber。

## systemd 用户服务

使用 [服务模板](../deploy/dsh-studio.service.example) 时，可通过 `systemctl --user edit dsh-studio.service` 增加 override。下面两个路径均需替换：

```ini
[Service]
WorkingDirectory=/ABSOLUTE/PATH/dsh-studio
ExecStart=
ExecStart=/ABSOLUTE/PATH/node-runtime/bin/node scripts/start.mjs --patch data/overlays/ring.json
```

空的 `ExecStart=` 用于清除原启动命令。确认运行中的任务已结束后再应用：

```sh
systemctl --user daemon-reload
systemctl --user restart dsh-studio.service
journalctl --user -u dsh-studio.service -n 80 --no-pager
```

服务用户仍需 Docker 权限，配置文件和独立的 `host-home/` 仍由原启动器使用。不要为额外插件再启动第二个 Studio provider。

## 验收条件与验证边界

支持 `dimensions.x/y/z: [min, max]`、`minMeshes`、`minMaterials` 和 `rays`。尺寸采用米制、Blender Z-up 坐标；射线需要有限的三维 `origin`、`target` 和 `expect: "clear"` 或 `"blocked"`，起终点不能相同。未知条件、反向区间和非有限数值都会被拒绝。完整限制见 [接口参考](plugins.md#case-contract)。

案例注册成功只说明插件接入成功，不代表模型通过几何验收。浏览器查看器的格式准入、原生 harness 的完成状态、独立几何检查结果分别记录。批量运行器读取显式的版本 1 JSON 案例文件。示例插件直接读取同目录的 `cases.json`；运行 `node scripts/run-3d-cases.mjs --config config.local.json --cases examples/plugins/model-case/cases.json` 可复用同一份定义，无需先在网页宿主中加载插件。该命令会调用真实模型；注册插件本身不会启动批量运行。

开发时可执行不调用模型的检查：

```sh
npm test
npm run check
npm run check:cordis -- /ABSOLUTE/PATH/to/built-dsh
```

最后一条需要已准备好的 DSH checkout，验证真实 Cordis 的加载、卸载、服务替换及重新注入，不需要 API Key 或 Docker。它不验证真实四栏生成效果。

外部插件和 overlay 可以执行宿主机代码，必须由操作者审阅安装。将生成作品放入工作区不会安装插件；不要把访问码、密钥、现场 overlay 或私人模型记录提交到仓库。
