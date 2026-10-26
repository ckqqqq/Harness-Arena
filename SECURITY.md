# Security and deployment

Studio is an experimental coding-agent execution interface. Anyone holding its access code can submit tasks, edit files in its private workspaces and consume the configured DeepSeek account's API quota. The access code is a bearer credential, not an account-management system.

Default to loopback or an authenticated SSH tunnel. The HTTP prototype does not provide TLS, multiple users, per-user authorization, egress filtering or comprehensive abuse controls. Do not publish the UI, relay or Docker socket to the public internet as a turnkey hosted service.

Keep `private/`, `data/`, generated configuration, logs, native sessions and successful sketch requests out of Git. Do not put secrets in runtime code trees or public input files: containers can read their mounted trees. Use only trusted runtime paths, CLIs and images. Docker access on the host is privileged access even though individual task containers drop capabilities and run as a non-root user.

Successful sketch records include the drawn image and description. Native session records include prompts, answers, tool inputs/outputs and workspace files. Review this private data before sharing diagnostic material.

For a security report, do not open an issue containing credentials or private traces. If the repository's private vulnerability-reporting feature is available, use it; otherwise open a minimal issue requesting a private reporting channel without including exploit-sensitive details.

Generated HTML executes only in an opaque-origin sandbox with a restrictive CSP. Its scripts cannot read Studio storage, parent DOM or network resources. Artifact capability links are bearer URLs: anyone holding one can access that single snapshot until expiry. Downloads contain model-generated code; review them before opening outside Studio's sandbox. Preview snapshots are bounded to 32 active grants and 100 MiB per file; a crashed process may leave private snapshot files on disk for operator cleanup.

The 3D viewer is trusted plugin code inside an opaque-origin iframe. It receives only a single expiring artifact capability, never the Studio access credential. Its CSP permits artifact fetches and embedded resources, while denying chat APIs and external networking. Models are admitted on both server and viewer before GLTFLoader parsing; no model-provided JavaScript runs. Model admission is a bounded preview policy, not complete glTF specification conformance or a defense against every browser/GPU vulnerability. Blender inspection uses separate non-root containers with read-only roots, no network and no API key. Case criteria stay outside generative workspaces.

Configuration and startup resolve key and runtime paths before accepting them, reject data/runtime overlap, and require a private readable regular key file. These checks assume operator-owned configuration and directories; they do not make a host tree writable by an adversarial host user safe. The doctor inspects key metadata only and suppresses raw child-process diagnostics.
