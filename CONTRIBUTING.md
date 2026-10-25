# Contributing

Use Node 24. Run `npm test` and `npm run check` before proposing changes. Unit tests must not require API credentials, installed harnesses or a running DSH host. Mark any mocked provider responses explicitly; do not describe them as real model evidence.

Keep deployment settings in generated configuration. Do not commit private prompts, access codes, native-session fixtures or machine-specific paths. Keep Studio changes behind its plugin seam instead of modifying the DSH core loop.

For a runtime integration change, record the operating system/architecture, DSH revision, CLI versions, image identity, commands actually run and limitations. Preserve raw evidence privately; publish only deliberately sanitized diagnostics.
