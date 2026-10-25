# Security and deployment

Studio is an experimental coding-agent execution interface. Anyone holding its access code can submit tasks, edit files in its private workspaces and consume the configured DeepSeek account's API quota. The access code is a bearer credential, not an account-management system.

Default to loopback or an authenticated SSH tunnel. The HTTP prototype does not provide TLS, multiple users, per-user authorization, egress filtering or comprehensive abuse controls. Do not publish the UI, relay or Docker socket to the public internet as a turnkey hosted service.

Keep `private/`, `data/`, generated configuration, logs, native sessions and successful sketch requests out of Git. Do not put secrets in runtime code trees or public input files: containers can read their mounted trees. Use only trusted runtime paths, CLIs and images. Docker access on the host is privileged access even though individual task containers drop capabilities and run as a non-root user.

Successful sketch records include the drawn image and description. Native session records include prompts, answers, tool inputs/outputs and workspace files. Review this private data before sharing diagnostic material.

For a security report, do not open an issue containing credentials or private traces. If the repository's private vulnerability-reporting feature is available, use it; otherwise open a minimal issue requesting a private reporting channel without including exploit-sensitive details.
