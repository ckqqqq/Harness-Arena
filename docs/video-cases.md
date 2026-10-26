# Video editing cases

Four reusable tasks live in [the video catalog](../examples/video-cases.json): beat-aligned cuts, vertical reframing, timed subtitles and picture-in-picture. These are new task designs, not published harness performance results. The gallery marks them as pending runs.

## Prepare shared inputs

On a Linux host with FFmpeg, generate deterministic test-pattern clips and synthetic sound:

```sh
python3 scripts/make-video-inputs.py --output data/video-inputs
```

The script refuses to overwrite existing files. Use a new directory for another set. These inputs contain no downloaded footage, private conversation data or model-generated outputs. Record your FFmpeg version with any published results; bitwise output can differ between versions.

Copy all four input files into Studio's shared input seed using the existing file workflow before creating a fresh conversation. Attach them to the task. For each case, broadcast the catalog's prompt unchanged to the selected harnesses. Keep each case in its own conversation so edits from earlier tasks do not affect later tasks. The beat track is one pulse per second; the clips themselves carry a constant tone.

Alternatively, `node scripts/run-video-cases.mjs --config config.local.json --inputs data/video-inputs` creates a fresh conversation per case and copies the four inputs into each new lane before sending. It requires the configured Studio web host to be running and makes real model requests. `--ids beat-cut` selects one case. The runner requests `output.mp4`, snapshots available outputs after each job stops and stores native statuses separately under private `data/video-runs/`. A saved MP4 is not a metadata or editing-quality pass. Do not launch the same batch twice while its process is still running.

## Inspect each output

```sh
python3 scripts/inspect-video.py --case beat-cut /PATH/TO/output.mp4
```

The check requires ffprobe and returns JSON plus exit 0 for a metadata pass or 1 for a failed constraint. It checks duration (±0.15 seconds), dimensions, average frame rate (±0.01 fps), H.264 and presence of an audio stream. Missing, nonfinite or malformed metadata cannot pass. Audio presence does not prove audible sound.

Review actual cut timing, subtitle content, safe areas, framing, beat alignment and sound separately. A metadata pass cannot establish those properties. Keep native completion, media checks and human review separate in reports. These video catalogs are not accepted by the geometry-only `run-3d-cases.mjs` runner.

## Public gallery

The buildless gallery lives under `site/`. It uses only explicitly curated public data and images; it never scans private runtime directories. The static image wall shows only cases with four actual captures. It contains six measured 3D rows; the four pending video tasks remain in the catalog until real images exist. Run `npm run build:gallery` after updating the curated image map. The page needs no JavaScript or JSON fetch; thumbnails have fixed dimensions and normal lazy loading. Existing 3D measurements link to their documented methodology. Video tasks remain marked pending until actual reviewed outputs and run evidence are added.

GitHub Pages deploys `site/` through the Pages workflow. In repository settings, select **Pages → Source → GitHub Actions**. The site is static: it does not require an API key, run harnesses or expose the live execution host.

An optional [Railway showcase service](../deploy/railway/README.md) serves the same public files with video byte-range support. It does not move native harness execution into Railway.
