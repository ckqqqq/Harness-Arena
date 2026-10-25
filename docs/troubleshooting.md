# Troubleshooting

## The UI is unavailable

Check the configured bind address and UI port first. The DSH carrier, Studio UI and model relay use distinct ports. A reachable original DSH UI does not prove Studio loaded. Check the dedicated service's startup error and confirm its overlay points to the intended source checkout. Do not start a second host over the same data directory.

Docker must be accessible by the service user, not just an interactive login shell. Dedicated runtime paths and the configured image digest must exist. A user service created before Docker group membership may need its execution-group setup refreshed. Follow the installation guide rather than making the task containers privileged.

## A lane has no final answer

Read its recorded status and error. A budget cap, native output truncation, timeout, cancellation or provider error can leave useful files without a final assistant message. Continue that native session explicitly. Raising the request cap does not repair missing tools or a failed command; use an image with the required tools.

Request counters cover admitted inference calls, not rejected retries or token estimates. Older imported histories may reflect the original version's accounting. Four harnesses may use different tools and thinking behavior even with the same model ID.

## Artifacts are missing or expired

Wait for the owning container to finish cleanup, then refresh artifacts. Only supported nonempty files within size limits are discovered. Hidden/dependency directories and symlinks are skipped. A preview uses a copy; editing the original does not update an existing snapshot.

For 3D, export uncompressed GLB or self-contained glTF. External buffers/images and unsupported required decoder extensions are rejected. A `.blend` file is not itself a browser preview. Model scenes need finite nonzero bounds. If WebGL is unavailable, inspect the viewer's error instead of assuming generation failed.

## A model opens but fails checks

Format admission and geometric predicates are separate. Inspect the saved measurement, expected interval and numerical tolerance. The viewer uses glTF/Y-up dimensions; the Blender inspector uses Z-up. A visual approximation or material-colored hole is not proof of a real opening. Reports describe historical snapshots; use `--recheck` after changing a model or predicate.

## A case plugin does not appear

Confirm the consumer overlay is loaded into the same Cordis scope as Studio and injects `studioModelCases`. Check for duplicate owner/case IDs or an unsupported predicate. Refresh case records after a plugin change. Registering a case does not start a model run, add a browser component type, or install another executable.

## Reporting a problem

Include the Studio revision, host platform, pinned DSH/harness revisions, image identity, lane status and a minimal reproduction. Remove access codes, API keys, native session content and host-specific paths before sharing. Preserve raw evidence privately when needed; the [contribution guide](../CONTRIBUTING.md) explains the verification standard.
