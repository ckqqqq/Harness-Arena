# HTTP API

## Authentication and errors

Send `x-studio-token: <access code>` for every `/api/` request. Read that credential from the operator's private token file; do not include it in URLs or model prompts. POST bodies are JSON. When an Origin header is present it must match the configured HTTP host origin.

The current prototype returns 401 for missing/invalid credentials, 403 for a rejected Origin, 404 for unknown routes and 400 for most validation/state errors. Do not infer retryability from 400 alone; inspect the JSON `error` string. This interface has no versioned compatibility guarantee yet.

## Execution and history

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /api/status` | none | Model, harness names, request limit and timeout |
| `POST /api/conversations` | `{}` | `{id}` for four newly copied workspaces |
| `GET /api/conversation?id=<UUID>` | none | Saved lane histories and native session IDs |
| `POST /api/run` | `{conversation, prompt, targets?}` | Initial public job record |
| `GET /api/job?id=<UUID>` | none | Current job and lane states |
| `POST /api/cancel` | `{id: jobId}` | Cancellation acknowledgement |

Targets are `claude`, `codex`, `hermes`, `dsh`; omission selects all four. Jobs are transient handles in one server process. Histories and native sessions persist separately. There is currently one active comparison job per Studio runtime, not an unlimited task queue.

A lane may be queued, starting, running, completed, failed, cancelled, timeout, budget_exhausted, output_limit or cleanup_failed. A completed job means its selected lanes stopped; it does not mean all lanes succeeded. Preserve errors, partial text and artifact availability separately. Do not turn an exit code into a fabricated native answer.

## Whiteboard and files

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /api/layout` | none | Saved declarative version-1 layout |
| `POST /api/layout` | `{version:1, components:[...]}` | Validated saved layout |
| `POST /api/sketch` | `{image, instruction, layout}` | An unsaved layout proposal and explanation |
| `GET /api/files?target=...&conversation=...&path=...` | none | Confined directory entries |
| `GET /api/file?target=...&conversation=...&path=...` | none | `{path,text}` for a supported text file |
| `POST /api/file?target=...&conversation=...&path=...` | `{text,create?}` | Write acknowledgement |

File target `seed` selects public input for future conversations; a harness target selects that lane's workspace. Paths are workspace-relative and symlinks are rejected. Lane file editing is unavailable while its conversation runs. Layout component types remain chat, files, preview and note; arbitrary component scripts are not accepted.

## Artifacts and model cases

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /api/artifacts?conversation=...&target=...` | none | Supported artifact paths, types and sizes |
| `POST /api/preview` | `{conversation,target,path}` | `{src}`: one expiring snapshot URL |
| `GET /api/model-cases` | none | Current validated case registrations and composed prompts |
| `GET /api/model-runs` | none | Up to ten stored case-run summaries |

`GET /artifact/<capability>` uses the single-artifact capability instead of the Studio access code. Range requests are supported; `?download=1` returns an attachment. The capability grants one immutable file, not a workspace or directory. It may expire or be evicted. Treat it as private.

Trusted model-viewer assets are public, but receive only an artifact capability. Self-contained model admission, iframe sandboxing, response CSP and resource bounds remain enforced. The [security boundary](../SECURITY.md) and [plugin service](plugins.md) document which code is trusted.

Case-run summaries describe historical measurements. Reinspection creates a separate run with `recheckedFrom`; it does not create another model-generation attempt. The UI deduplicates case conversations while retaining private original reports.
