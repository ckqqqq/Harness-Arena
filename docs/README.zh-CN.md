# 文档导航

Studio 是独立的 DSH/Cordis 插件。四栏调度、白板、作品预览与几何验收各自有边界，DSH 的 agent 核心循环由上游维护。

| 主题 | 入口 |
| --- | --- |
| 操作方式与数据含义 | [用户指南](user-guide.md) |
| 运行主机、配置与密钥 | [安装说明](installation.md) |
| 失败、额度和预览排查 | [故障排查](troubleshooting.md) |
| 模块与资源生命周期 | [架构](architecture.md) |
| 构建、测试与贡献边界 | [开发指南](development.md) |
| 注册独立扩展插件 | [中文插件指南](plugins.zh-CN.md) · [接口参考](plugins.md) |
| HTTP 请求和持久化语义 | [API 参考](api.md) |
| 六类 3D 案例的真实结果 | [3D 验证记录](3d-validation.md) |

技术参考目前以英文为主。文档布局参考 DSH 的用户指南、开发参考与扩展 cookbook，但只记录 Studio 已实现的接口，不将上游的全部插件能力描述成 Studio 自己的能力。

扩展入口分为两层：Studio 自身作为 DSH 插件加载；其他受信任 Cordis 插件可消费 Studio 提供的 `studioModelCases` 服务。案例是数据，查看器是受信任代码，生成模型不能自行安装宿主机插件。可运行示例见 [model-case 插件](../examples/plugins/model-case/README.md)。
