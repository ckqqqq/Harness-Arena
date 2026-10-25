# Third-party software

This repository contains the Studio plugin, not the downstream harness implementations.

DSH, Codex, Claude Code and Hermes are installed or supplied separately. Their own licenses, service terms and authentication requirements apply. The Studio MIT license does not relicense those tools, models, trademarks or the runtime image dependencies.

The initial integration was tested with DSH revision `22ddee3792402c3e70ec5f86a63c3e3e895a2f60`, Codex CLI `0.164.0`, Claude Code `2.1.310`, and Hermes revision `4ea8d23cc9f527332ccb1d55359b27741b6ea51b`. Version pins are integration references, not an endorsement or a promise of compatibility with later versions.

The checked-in model viewer bundle includes Three.js 0.180.0 (MIT, copyright Three.js authors), built using esbuild 0.25.10 (MIT). The complete Three.js license is included in `docs/licenses/three.txt`. Blender is supplied by the runtime image under its own GPL license and is not bundled into this JavaScript plugin.
