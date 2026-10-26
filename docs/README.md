# Documentation

Studio is an independent DSH/Cordis plugin. It composes native harness execution, a whiteboard and bounded artifact viewers; it does not replace DSH's agent loop.

| Start here | Purpose |
| --- | --- |
| [User guide](user-guide.md) | Conversations, whiteboard, artifacts and saved case reports |
| [Installation](installation.md) | Linux host, runtime mounts, key provisioning and configuration |
| [Troubleshooting](troubleshooting.md) | Startup failures, request limits, previews and native completion |
| [Architecture](architecture.md) | Runtime ownership, relay boundary and artifact snapshots |
| [Development](development.md) | Source map, build, tests and compatibility expectations |
| [Plugin development](plugins.md) | DSH entrypoint and the Studio model-case service |
| [HTTP API](api.md) | Auth, endpoint payloads, durable history and transient jobs |
| [Video editing cases](video-cases.md) | Shared synthetic inputs, four editing tasks and metadata inspection |
| [3D validation](3d-validation.md) | Six real cases, measurement scope and retained failures |
| [Validation history](validation.md) | Automated and real integration evidence |

The organization follows DSH's separation of user documentation, development references and extension cookbooks. DSH's own service names, generated API catalogs and contribution requirements belong to [the upstream project](https://github.com/deepseek-ai/deepseek-harness); Studio documents only the seams it actually implements. Integration references are pinned in [third-party notices](../THIRD_PARTY_NOTICES.md).

See [Security](../SECURITY.md) before exposing an execution host and [Contributing](../CONTRIBUTING.md) before changing its lifecycle or protocol adapters.
