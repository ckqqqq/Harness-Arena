# Installation

## Host prerequisites

Use Linux with Docker access for a non-root current user, Git, uv, and Node 24. Task containers inherit that user's UID; do not run the execution host as root. Install Node in a dedicated prefix such as `/opt/node-runtime`, rather than mounting all of `/usr` into containers. Windows/macOS browsers can connect to a Linux host; native Windows/macOS execution hosts are not supported.

Prepare a DSH source checkout with its dependencies installed using that repository's instructions. The integration reference is commit `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` of `deepseek-ai/deepseek-harness`. This project does not modify that checkout. Cordis APIs are pre-stable, so a different DSH revision may require adapter changes.

`npm run install:harnesses` installs Codex CLI `0.164.0` and Claude Code `2.1.310` using the checked-in npm lockfile. It checks out Hermes revision `4ea8d23cc9f527332ccb1d55359b27741b6ea51b` and prepares its locked environment with Python 3.14. uv-managed Python files stay under `python-runtimes/`. This step downloads external software; no downstream source or binaries are committed here.

Build `deploy/Dockerfile` locally and use the image ID from `docker image inspect`. The generated configuration requires a sha256 image ID, not a mutable tag. The image supplies common command-line tools; Node, DSH, Hermes and the CLI packages are mounted from their dedicated runtime directories when a task runs.

## Configure

Copy `examples/config.json` to `settings.json` and edit its required fields. `npm run configure -- settings.json` validates paths, checks that referenced runtime files exist, provisions a key from `DEEPSEEK_API_KEY` only when the key file does not already exist, then writes ignored owner-only configuration files. It rejects a key file placed under a container runtime mount.

| Field | Default / meaning |
| --- | --- |
| `dshDir` | Required absolute path to the prepared DSH checkout |
| `nodeDir` | Required dedicated prefix containing `bin/node` |
| `image` | Required local Docker image `sha256:...` |
| `pythonDir` | Checkout-local `python-runtimes/`; contains Hermes' interpreter targets |
| `dataDir` | Checkout-local `data/` |
| `keyFile` | Checkout-local `private/deepseek.key` |
| `dockerPath` | `/usr/bin/docker` |
| `host`, `port` | UI bind address `127.0.0.1` and port `3081` |
| `hostPort` | Dedicated DSH carrier on loopback, port `3082` |
| `gatewayHost`, `gatewayPort` | Docker bridge address `172.17.0.1`, port `3083` |
| `model` | `deepseek-flash` in all four lanes |
| `timeoutSeconds`, `maxTurns` | `240` seconds and `16` admitted POST model requests per lane/turn |
| `sketchModel` | `deepseek-flash` |
| `sketchTimeoutSeconds` | `90` seconds |
| `sketchMaxImageBytes` | `2097152` bytes |
| `sketchMaxOutputTokens` | `4096` |

Inspect the default bridge with `docker network inspect bridge`. If its gateway differs from the example, configure that actual address. Docker containers must reach the relay; browsers must not need direct access to it. Port values must be distinct. Keep the real key outside the four read-only runtime mounts and the private workspaces.

`npm start` launches DSH's supported `web` profile with the generated overlay and a separate `host-home/`. Studio owns its UI/relay listeners and task containers. It does not restart another DSH deployment.

## Remote access and systemd

For loopback-only deployment, forward the UI port:

```bash
ssh -L 3081:127.0.0.1:3081 YOUR_SERVER
```

For LAN access, explicitly change `host` and regenerate configuration. Do not expose the bridge relay or Docker socket. The current prototype's origin validation expects plain HTTP; use a trusted network or an authenticated SSH tunnel. HTTPS reverse-proxy deployment needs deliberate origin-handling changes rather than simply forwarding a different Origin header.

`deploy/dsh-studio.service.example` is an optional **user** service template. Replace its checkout and Node paths before installing it under the user's systemd configuration. The service process must have Docker access. After adding a Docker group, refresh the user's login/service manager group membership; do not change Docker socket permissions to make an old service session work.

## Upgrades and rollback

Stop new sends, wait for active tasks to finish, stop Studio, back up the private data directory, update code/runtimes, run tests and regenerate configuration. Preserve the key file and native histories. The prototype does not migrate downstream CLI session formats. Retain a known-working code revision and dependency set when changing CLI versions.
