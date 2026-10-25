# 3D multi-case validation

Validated on 2026-10-25 with the pinned harness revisions in THIRD_PARTY_NOTICES.md, DeepSeek Flash, and Blender 4.0.2 on Linux ARM64. Six declarative tasks were each broadcast to all four real native CLIs. Models were not replaced or manually repaired for this comparison.

| Case | Claude Code | Codex | Hermes | DSH |
| --- | --- | --- | --- | --- |
| 带孔机械支架 | Pass | Pass | Pass | Pass |
| 家具与尺度 | Pass | Pass | Pass | Pass |
| 空心曲面花瓶 | Pass | Pass | Pass | Pass; native budget exhausted |
| 关节装配台灯 | Pass | Pass | Pass | Fail: height |
| 多部件探测车 | Pass | Pass | Pass | Pass |
| 室内多物体场景 | Pass | Pass | Pass | Pass |

All 24 artifacts passed model admission and rendered in the same generic viewer. Browser automation dragged each of the 24 models and independently observed changed rendered pixels; wireframe, bounds and part selection controls worked without page script errors. Twenty-three artifacts passed the listed geometric predicates. Twenty-three native runs ended as completed. The DSH vase artifact passed geometry predicates while its native run exhausted the request budget; its failure history remains intact. The DSH lamp measured about 0.38416 m high against the declared 0.45–0.75 m interval.

The first exact-boundary comparison flagged two room heights of approximately 2.50000009 m against an upper bound of 2.5 m. The generic numerical comparison was corrected to use a relative tolerance of 1e-6 with an absolute minimum of 1e-7 m. Original measurements and prior reports were retained. Reinspection of all 24 immutable model snapshots, without further model calls, produced the table above. This tolerance does not admit the substantive lamp height error.

Predicates cover only the declared dimensions, mesh/material counts and selected ray segments. They do not establish every visual, semantic, manufacturing or engineering requirement. In particular, mesh counts cannot by themselves prove correct assembly, and a few clear rays cannot prove an entire surface is correct. These six cases demonstrate adapter coverage across varied inputs, not a universal model-quality guarantee or a rigorous harness ranking.

The case manifest and generic inspector are separate from the viewer. Adding a brief and supported geometric predicates requires no viewer code changes. Inspection runs outside generative workspaces in non-root, networkless containers. The final runner reads immutable preview snapshots rather than following workspace files on the host.

Additional evidence: 16 keyless JavaScript tests, 3 Python numerical tests, Linux rebuilding with a byte-identical pinned viewer bundle, an off-origin self-contained glTF fixture with changed pixels after orbit interaction, and blocked parent/storage/chat-API access inside the viewer. Synthetic solid-plate and solid-vase controls failed the void predicates as expected. Native traces, model files, access codes and deployment configuration remain private.
