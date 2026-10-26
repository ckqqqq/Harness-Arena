# Plugin development

[中文指南](plugins.zh-CN.md)

## DSH plugin boundary

Studio's entrypoint exports `name`, `inject`, `provide` and `apply(ctx, config)`. It consumes DSH's `webServer` lifecycle and provides `studioModelCases`. Its own HTTP listener, relay, active containers and snapshots are owned by the Studio fiber and disposed with it. The original DSH agent loop and web application remain separate.

Configure Studio through the generated overlay. DSH's launcher supports repeatable `--patch` arguments, so a second local overlay can install sibling plugins. Use `npm start -- --patch data/overlays/my-plugin.json` (repeat `--patch` for additional overlays in order). Paths resolve from the invoking directory; quote paths containing spaces. The launcher rejects unreadable files, invalid JSON and non-array overlays before spawning DSH; DSH validates the operations. Use the same dedicated profile home and DSH source launcher as `scripts/start.mjs`; do not start two Studio providers on the same ports or data directory.

## `studioModelCases` service

This service owns currently supported 3D task registrations. It is not a general-purpose tool registry and does not execute contributed code in the browser.

```js
export const name = 'my-model-cases';
export const inject = ['studioModelCases'];

export function apply(ctx) {
  ctx.effect(() => ctx.studioModelCases.register('my-pack', [{
    id: 'my-ring',
    title: 'Ring',
    brief: 'Create a ring centered at x=y=0, bottom z=0...',
    checks: { dimensions: { z: [0.019, 0.021] }, minMeshes: 1 }
  }]));
}
```

`register(owner, cases)` validates the whole pack before changing the registry and returns an idempotent disposer. Owners and case IDs are lowercase slug identifiers, up to 64 characters. Case IDs are globally unique across packs; duplicates fail instead of overriding another provider. Unloading the consumer removes its own registrations. Replacing the service unloads and reinjects dependent Cordis plugins.

`list()` returns independent copies. Mutating a returned case does not mutate registrations. The registry accepts at most 64 cases per pack and 256 total. `close()` is owned by the host and prevents further registration during disposal.

## Case contract

Each case has `id`, `title`, `brief` and optional `checks`. The supported predicates are:

| Field | Meaning |
| --- | --- |
| `dimensions.x/y/z: [min, max]` | Nonnegative meter intervals in Blender/Z-up space |
| `minMeshes` | Minimum imported mesh-object count |
| `minMaterials` | Minimum distinct used material count |
| `rays: [{origin, target, expect}]` | Nonzero 3D segments expected to be `clear` or `blocked` |

Unknown predicates, reversed intervals, nonfinite coordinates and zero-length rays are rejected. Registration does not prove geometric quality. Independent inspection evaluates the supported predicates; the viewer only loads admitted model data.

The authenticated `GET /api/model-cases` reflects live registrations. Refresh the page's records to refresh available cases. The batch runner currently reads an explicit JSON manifest; to benchmark a plugin's cases, export its `list()` result as a version-1 case manifest. The runnable example shares its version-1 `cases.json` between registration and the batch runner; see its README for the command. Native plugin registration by itself does not start a benchmark or call an LLM.

## Runnable example

See [the example plugin](../examples/plugins/model-case/README.md). Its ring case is an extension example, separate from the six measured built-in cases. It has not been added to the published six-case performance results.

External Cordis plugins run trusted host code. Review and install them as an operator. Studio does not automatically install modules mentioned by a model, and generated artifact scripts cannot register host plugins.
