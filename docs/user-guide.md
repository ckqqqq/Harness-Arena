# User guide

## Start a conversation

Open the configured Studio UI and enter the access code from the host's private `data/access.token`. The access code permits execution against the configured model account. It is separate from the DeepSeek API key.

Create a new conversation to copy the current public input seed into four independent workspaces. In comparison mode, one submission reaches Claude Code, Codex, Hermes and DSH; in whiteboard mode, it reaches DSH. Follow-up turns resume each selected lane's native session. Tools and thinking policies remain native to their harnesses.

Use **Stop** to cancel the active turn. The status, error and generated files are preserved. A request budget or timeout is a failure condition even when a usable partial artifact exists. Continue the conversation to work on that artifact; request counters reset for the new turn.

Saved conversations can be opened with `/?conversation=<UUID>`, after authentication. An active job can be recovered by the same browser session; after a server restart its transient job handle is unavailable, while saved native histories and workspaces remain.

## Compose a whiteboard

Draw a rectangle and assign chat, files, text preview/editor or note. Move or resize regions, preview interaction, then explicitly save the layout. Freehand sketches and an instruction can produce a layout proposal. Adoption changes the browser draft; saving persists it. Recognition sends the sketch, layout and instruction, not chat or file contents.

The public input seed is copied only when creating a conversation. Editing it later does not change existing lane workspaces. Select a lane's file workspace to inspect or edit its own text files once execution ends.

## Inspect generated work

Each lane has **Conversation**, **Artifact** and **Expand** controls. Finished lanes discover supported files and create private snapshots for previews. Refreshing an artifact creates a new link; links expire after the configured interval. Downloads contain the generated file.

- HTML: self-contained inline scripts/styles inside an opaque-origin sandbox; networking and access to Studio are blocked.
- Video: MP4/WebM playback, seeking and download.
- Images: PNG/JPEG/WebP.
- 3D: uncompressed GLB or self-contained glTF 2.0; orbit, pan, zoom, wireframe, bounds, part highlighting and auto-fit. Original dimensions use glTF's meter/Y-up convention.

**Presentation mode** expands the four panes. Use its exit button to return to the composer. Esc also works while the parent Studio page has focus; keyboard events inside isolated artifacts do not propagate to it.

## Model cases and measurements

Selecting a model case fills the composer; it does not automatically run a model. The saved-case selector opens existing comparison conversations. Refresh records after a case runner finishes or a model-case plugin changes.

Geometry reports describe historical snapshots inspected by a separate Blender process. They use Blender's Z-up convention. Native completion, model-format admission and listed geometric predicates are separate results. Later edits require reinspection; an earlier report does not certify the current file. See [the case evidence](3d-validation.md) for the exact measured scope.
