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

From the Studio repository, start with the extra overlay:

```sh
npm start -- --patch data/overlays/ring.json
```

Repeat `--patch PATH` to load more overlays in order after Studio's generated overlay. Quote paths containing spaces. Relative paths resolve from the directory where you invoke the launcher. `npm start -- --help` shows usage without requiring a configured Linux host.

The launcher checks that each additional file is readable JSON containing an array before spawning DSH. DSH validates the patch operations and loads the plugins. Overlays can execute trusted host code; review them before loading. Stop the existing host before starting its replacement; this overlay adds a consumer, not a second Studio provider. The launcher preserves the configured `DSH_HOME`, carrier port and runtime paths.

Refresh case records in Studio. The ring appears in the model-case picker. Selecting it only fills a task; submitting runs the selected harnesses. Remove the extra patch and restart to unload it. Programmatic Cordis consumers can dispose the plugin fiber directly.

The [service reference](../../../docs/plugins.md) defines ownership, validation and duplicate behavior. This example demonstrates plugin integration; it is not an additional measured success case.
