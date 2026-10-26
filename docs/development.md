# Development

## Source map

| Boundary | Files |
| --- | --- |
| DSH/Cordis entry and HTTP listeners | `src/index.mjs` |
| Native sessions, jobs, containers and cleanup | `src/runtime.mjs` |
| Model request accounting | `src/budget.mjs` |
| Workspace confinement and layouts | `src/files.mjs`, `src/layout.mjs` |
| Snapshot admission and serving | `src/artifacts.mjs` |
| Pure 3D admission and trusted viewer | `src/model.mjs`, `src/viewer/` |
| Owned model-case registrations | `src/model-case-registry.mjs` |
| 3D instructions and built-in cases | `src/model-cases.mjs`, `examples/3d-cases.json` |
| Independent geometry inspection | `scripts/inspect-model.py`, `scripts/model_checks.py` |

## Build and check

Use Node 24; Python 3 is needed for numerical tests. From the repository root:

```sh
npm ci
npm run build:viewer
npm test
python3 -m unittest discover -s test -p '*_test.py'
npm run check
```

The viewer bundle is checked in so execution hosts need no frontend build dependencies. Rebuild it whenever its source or shared model admission changes. CI rebuilds and checks the generated file for drift. Backend modules use Node built-ins; the development dependencies do not belong in model workspaces.

Keyless tests do not invoke real models or require Docker. Blender negative controls are a separate optional integration test described in [3D validation](3d-validation.md). Actual harness runs incur model usage and require a configured Linux host.

## Change ownership

Keep model execution in the runtime, admission policy in pure modules, HTTP serialization in the entrypoint and browser rendering in the frontend. Add a model-case consumer through the [plugin service](plugins.md) rather than editing the built-in list in a request handler. Do not add model-specific names to the viewer.

Changes to native CLI flags, JSONL projection, relay protocols or container cleanup require focused real integration evidence. Save raw events privately; document the platform, pinned revisions, image identity and limitations. A mock, a clean exit code or a generated screenshot alone does not establish native completion.

## Compatibility and releases

DSH is pre-stable. The revisions in `THIRD_PARTY_NOTICES.md` identify tested integrations, not compatibility promises for arbitrary newer releases. Regenerate ignored configuration when defaults or required fields change; build a new immutable runtime image when system packages change.

The local development tree may be ahead of GitHub and the deployed host. Report each state explicitly. Run release checks against the actual candidate files before publishing; never stage runtime data, model sessions, private configurations or access codes.

Release scope and deployment milestones are recorded in [the changelog](../CHANGELOG.md). An Unreleased entry is not a published version.

To exercise the actual Cordis lifecycle without a key, Docker or inference, run `npm run check:cordis -- /absolute/path/to/built-dsh`. This is an optional integration test against the installed DSH runtime, separate from the keyless unit suite.

Deployment path and credential checks live in `src/deployment.mjs`; scalar configuration validation is shared by generated configs and direct overlays in `src/configuration.mjs`. Changes must preserve canonical path isolation before provisioning and private-file checks before reading a key. The doctor reports metadata and fixed diagnostics, never credential values or raw child-process errors.
