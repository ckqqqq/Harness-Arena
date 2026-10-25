# Model-case consumer plugin

This native Cordis plugin consumes `studioModelCases` from Studio and contributes one parametric-ring task. It requires no extra package dependencies. Its registration is disposed automatically when the plugin unloads.

After configuring Studio, create an ignored local overlay under `data/overlays/ring.json`:

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

Use the existing DSH launcher command from `scripts/start.mjs`, with the extra `--patch /ABSOLUTE/PATH/dsh-studio/data/overlays/ring.json` after Studio's generated `--patch` argument. Keep the configured `DSH_HOME`, carrier port and runtime paths. Stop the existing host before starting its replacement; this overlay adds a consumer, not a second Studio provider.

Refresh case records in Studio. The ring appears in the model-case picker. Selecting it only fills a task; submitting runs the selected harnesses. Remove the extra patch and restart to unload it. Programmatic Cordis consumers can dispose the plugin fiber directly.

The [service reference](../../../docs/plugins.md) defines ownership, validation and duplicate behavior. This example demonstrates plugin integration; it is not an additional measured success case.
